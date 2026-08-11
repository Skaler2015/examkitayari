import { NextRequest, NextResponse } from "next/server";
import { search } from "@/server/queries";
import { categoryPath } from "@/lib/format";
import { ContentCategory } from "@prisma/client";

export const dynamic = "force-dynamic";

/** Instant-search JSON endpoint used by the global search box. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const cat = req.nextUrl.searchParams.get("category") as ContentCategory | null;
  const results = await search(q, cat ?? undefined, 15);
  return NextResponse.json({
    query: q,
    results: results.map((r) => ({
      title: r.title,
      category: r.category,
      url: categoryPath(r.category, r.slug),
      summary: r.shortSummary,
      publishedAt: r.publishedAt,
    })),
  });
}
