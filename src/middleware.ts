import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

/**
 * Lightweight edge guard for /admin and /dashboard. It only verifies the JWT
 * signature (no DB access on the edge); full role/session checks happen in the
 * respective server-component layouts. This just short-circuits obvious
 * unauthenticated access early.
 */
const SESSION_COOKIE = "ekt_session";
const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-insecure-secret-change-me");

const PROTECTED = [/^\/admin(\/|$)/, /^\/dashboard(\/|$)/];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED.some((re) => re.test(pathname))) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return redirectToLogin(req);

  try {
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    return redirectToLogin(req);
  }
}

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*"],
};
