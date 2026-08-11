import type { UserRole } from "@prisma/client";
import { getSessionUser, type SessionUser } from "./session";

// Role hierarchy: ADMIN > EDITOR > REVIEWER > STUDENT
const RANK: Record<UserRole, number> = {
  ADMIN: 40,
  EDITOR: 30,
  REVIEWER: 20,
  STUDENT: 10,
};

export type Permission =
  | "sources:read"
  | "sources:write"
  | "review:read"
  | "review:act"
  | "articles:write"
  | "articles:publish"
  | "automation:manage"
  | "users:manage"
  | "audit:read";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: [
    "sources:read",
    "sources:write",
    "review:read",
    "review:act",
    "articles:write",
    "articles:publish",
    "automation:manage",
    "users:manage",
    "audit:read",
  ],
  EDITOR: [
    "sources:read",
    "sources:write",
    "review:read",
    "review:act",
    "articles:write",
    "articles:publish",
  ],
  REVIEWER: ["sources:read", "review:read", "review:act", "articles:write"],
  STUDENT: [],
};

export function hasRole(user: SessionUser | null, min: UserRole): boolean {
  if (!user) return false;
  return RANK[user.role] >= RANK[min];
}

export function can(user: SessionUser | null, permission: Permission): boolean {
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role].includes(permission);
}

export function isStaff(user: SessionUser | null): boolean {
  return hasRole(user, "REVIEWER");
}

/** Guard for server components / route handlers. Throws if unauthorized. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("UNAUTHENTICATED");
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user, permission)) throw new AuthError("FORBIDDEN");
  return user;
}

export async function requireRole(min: UserRole): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasRole(user, min)) throw new AuthError("FORBIDDEN");
  return user;
}

export class AuthError extends Error {
  constructor(public code: "UNAUTHENTICATED" | "FORBIDDEN") {
    super(code);
    this.name = "AuthError";
  }
}
