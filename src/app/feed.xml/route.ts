import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { CATEGORY_META } from "@/lib/format";

export const dynamic = "force-dynamic";

/** RSS feed of the latest published updates. */
export async function GET() {
  const base = env.siteUrl.replace(/\/$/, "");
  const articles = await prisma.article.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });

  const items = articles
    .map((a) => {
      const url = `${base}/${CATEGORY_META[a.category].path}/${a.slug}`;
      return `<item>
  <title>${escapeXml(a.title)}</title>
  <link>${url}</link>
  <guid>${url}</guid>
  <pubDate>${(a.publishedAt ?? a.createdAt).toUTCString()}</pubDate>
  <description>${escapeXml(a.shortSummary ?? "")}</description>
  <category>${CATEGORY_META[a.category].label}</category>
</item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${env.siteName} — Latest Updates</title>
  <link>${base}</link>
  <description>Latest government jobs, admit cards, results and answer keys.</description>
  <language>en-in</language>
  ${items}
</channel>
</rss>`;

  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string));
}
