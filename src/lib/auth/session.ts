import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { sha256 } from "@/lib/hash";
import type { UserRole } from "@prisma/client";

export const SESSION_COOKIE = "ekt_session";

const secret = new TextEncoder().encode(env.authSecret);

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
};

type JwtPayload = {
  sub: string;
  sid: string; // opaque session id (random), hashed in DB
  role: UserRole;
};

/**
 * Create a persistent session: a random opaque token is hashed and stored in
 * the DB (so sessions can be revoked), while a signed JWT carrying the token
 * is placed in an httpOnly cookie.
 */
export async function createSession(
  userId: string,
  role: UserRole,
  meta?: { userAgent?: string; ip?: string }
): Promise<void> {
  const opaque = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(opaque);
  const expiresAt = new Date(Date.now() + env.authSessionTtl * 1000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      userAgent: meta?.userAgent,
      ip: meta?.ip,
    },
  });

  const jwt = await new SignJWT({ sub: userId, sid: opaque, role } satisfies JwtPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret);

  cookies().set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    const sid = payload.sid as string | undefined;
    const sub = payload.sub as string | undefined;
    if (!sid || !sub) return null;

    const tokenHash = sha256(sid);
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date() || !session.user.isActive) return null;

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
    };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret);
      const sid = payload.sid as string | undefined;
      if (sid) {
        await prisma.session.deleteMany({ where: { tokenHash: sha256(sid) } });
      }
    } catch {
      /* ignore */
    }
  }
  cookies().delete(SESSION_COOKIE);
}
