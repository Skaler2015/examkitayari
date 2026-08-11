export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { Card, CardHeader, CardTitle, CardContent, Badge, SectionTitle, EmptyState } from "@/components/ui";
import { CATEGORY_META } from "@/lib/format";
import { isIndexNowEnabled } from "@/server/seo/indexnow";

function auditArticle(a: { title: string; shortSummary: string | null; officialSourceUrl: string | null; faq: unknown; seo: { description: string | null; canonical: string | null; noindex: boolean } | null }): string[] {
  const issues: string[] = [];
  const desc = a.seo?.description || a.shortSummary || "";
  if (!desc) issues.push("No meta description");
  else if (desc.length < 50) issues.push("Meta description too short");
  if (a.title.length > 65) issues.push("Title too long (>65)");
  if (a.title.length < 15) issues.push("Title too short");
  if (!a.seo?.canonical) issues.push("No canonical URL");
  if (!a.officialSourceUrl) issues.push("No official source link");
  if (!Array.isArray(a.faq) || (a.faq as unknown[]).length === 0) issues.push("No FAQ");
  if (a.seo?.noindex) issues.push("noindex set");
  return issues;
}

export default async function AdminSeoPage() {
  const articles = await prisma.article.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: 200,
    select: {
      id: true, slug: true, title: true, category: true, shortSummary: true, officialSourceUrl: true, faq: true,
      seo: { select: { description: true, canonical: true, noindex: true } },
    },
  });

  const audited = articles.map((a) => ({ a, issues: auditArticle(a) }));
  const withIssues = audited.filter((x) => x.issues.length > 0);
  const base = env.siteUrl.replace(/\/$/, "");

  return (
    <div className="space-y-6">
      <SectionTitle title="SEO" />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{articles.length}</p><p className="text-sm text-muted-foreground">Published articles</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{withIssues.length}</p><p className="text-sm text-muted-foreground">With SEO issues</p></CardContent></Card>
        <Card><CardContent className="p-4">{isIndexNowEnabled() ? <Badge variant="success">IndexNow ON</Badge> : <Badge variant="warning">IndexNow OFF</Badge>}<p className="mt-1 text-sm text-muted-foreground">Instant indexing</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Sitemaps & feeds</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3 text-sm">
          {[
            ["Sitemap", `${base}/sitemap.xml`],
            ["News sitemap", `${base}/news-sitemap.xml`],
            ["RSS feed", `${base}/feed.xml`],
            ["Robots", `${base}/robots.txt`],
            ["IndexNow key", `${base}/indexnow.txt`],
          ].map(([label, href]) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="rounded-md border px-3 py-1.5 hover:bg-secondary">
              {label} ↗
            </a>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>SEO audit ({withIssues.length} need attention)</CardTitle></CardHeader>
        <CardContent>
          {withIssues.length === 0 ? (
            <EmptyState title="All good" description="No SEO issues found on published articles." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-2 font-medium">Article</th>
                    <th className="p-2 font-medium">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {withIssues.map(({ a, issues }) => (
                    <tr key={a.id} className="border-b align-top">
                      <td className="p-2">
                        <Link href={`/admin/articles/${a.id}`} className="font-medium hover:underline">{a.title}</Link>
                        <div className="text-xs text-muted-foreground">{CATEGORY_META[a.category].label}</div>
                      </td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          {issues.map((i) => <Badge key={i} variant="warning">{i}</Badge>)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
