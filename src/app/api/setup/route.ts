import { NextRequest, NextResponse } from "next/server";
import { runSeed } from "@/server/setup/bootstrap";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * One-time bootstrap endpoint. Runs the idempotent seed (admin user, categories,
 * states, automation defaults, example sources) so a fresh deploy can be
 * finished without shell access.
 *
 * Protected by SETUP_TOKEN. Call once after the first deploy:
 *   GET  /api/setup?token=YOUR_SETUP_TOKEN
 *   POST /api/setup   with header  Authorization: Bearer YOUR_SETUP_TOKEN
 * Safe to run again (upserts) but intended as a one-time step.
 */
async function handle(token: string | null) {
  const expected = process.env.SETUP_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "SETUP_TOKEN is not configured on the server." }, { status: 500 });
  }
  if (token !== expected) {
    return NextResponse.json({ error: "Invalid or missing setup token." }, { status: 401 });
  }
  try {
    const result = await runSeed();
    return NextResponse.json({
      ok: true,
      message: "Setup complete. You can now log in at /login with the admin account, then open /admin.",
      result,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req.nextUrl.searchParams.get("token"));
}

export async function POST(req: NextRequest) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  const token = bearer ?? req.nextUrl.searchParams.get("token");
  return handle(token);
}
