import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { CATEGORY_META } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Google News sitemap — only articles published in the last 48 hours, per
 * Google News requirements. Helps eligible fresh content get indexed fast.
 */
export async function GET() {
  const base = env.siteUrl.replace(/\/$/, "");
  const since = new Date(Date.now() - 1000 * 60 * 60 * 48);

  const articles = await prisma.article
    .findMany({
      where: { status: "PUBLISHED", publishedAt: { gte: since } },
      orderBy: { publishedAt: "desc" },
      take: 1000,
      select: { slug: true, title: true, category: true, publishedAt: true },
    })
    .catch(() => []);

  const urls = articles
    .map((a) => {
      const loc = `${base}/${CATEGORY_META[a.category].path}/${a.slug}`;
      return `<url>
  <loc>${loc}</loc>
  <news:news>
    <news:publication><news:name>${escapeXml(env.siteName)}</news:name><news:language>en</news:language></news:publication>
    <news:publication_date>${(a.publishedAt ?? new Date()).toISOString()}</news:publication_date>
    <news:title>${escapeXml(a.title)}</news:title>
  </news:news>
</url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=600" },
  });
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string));
}
