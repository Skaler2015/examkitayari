import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** First-party page-view beacon. Ignores admin/api/auth paths. */
export async function POST(req: NextRequest) {
  try {
    const { path, referrer } = (await req.json()) as { path?: string; referrer?: string };
    if (!path || typeof path !== "string") return new NextResponse(null, { status: 204 });
    if (/^\/(admin|api|dashboard|login|register)/.test(path)) return new NextResponse(null, { status: 204 });
    await prisma.pageView.create({
      data: { path: path.slice(0, 512), referrer: referrer ? String(referrer).slice(0, 512) : null },
    });
  } catch {
    /* best-effort */
  }
  return new NextResponse(null, { status: 204 });
}
