export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardTitle, CardContent, SectionTitle, EmptyState } from "@/components/ui";

export default async function AdminAnalyticsPage() {
  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const sevenDays = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7);
  const fourteenDays = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 14);

  const [today, week, total, topPages, recent] = await Promise.all([
    prisma.pageView.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.pageView.count({ where: { createdAt: { gte: sevenDays } } }),
    prisma.pageView.count(),
    prisma.pageView.groupBy({ by: ["path"], _count: { path: true }, orderBy: { _count: { path: "desc" } }, take: 12, where: { createdAt: { gte: sevenDays } } }),
    prisma.pageView.findMany({ where: { createdAt: { gte: fourteenDays } }, select: { createdAt: true } }),
  ]);

  // Daily buckets (last 14 days).
  const buckets = new Map<string, number>();
  for (const r of recent) {
    const k = r.createdAt.toISOString().slice(0, 10);
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now.getTime() - 1000 * 60 * 60 * 24 * (13 - i));
    const k = d.toISOString().slice(0, 10);
    return { day: k.slice(5), count: buckets.get(k) ?? 0 };
  });
  const maxCount = Math.max(1, ...days.map((d) => d.count));

  return (
    <div className="space-y-6">
      <SectionTitle title="Analytics" />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{today}</p><p className="text-sm text-muted-foreground">Views today</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{week}</p><p className="text-sm text-muted-foreground">Views (7 days)</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{total}</p><p className="text-sm text-muted-foreground">Total views</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Page views — last 14 days</CardTitle></CardHeader>
        <CardContent>
          {total === 0 ? (
            <EmptyState title="No data yet" description="Page views are collected as visitors browse the public site." />
          ) : (
            <div className="flex h-40 items-end gap-1.5">
              {days.map((d) => (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full items-end justify-center" style={{ height: "120px" }}>
                    <div
                      className="w-full rounded-t bg-primary/80"
                      style={{ height: `${(d.count / maxCount) * 100}%` }}
                      title={`${d.count} views`}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{d.day}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Top pages (7 days)</CardTitle></CardHeader>
        <CardContent>
          {topPages.length === 0 ? (
            <EmptyState title="No data yet" />
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {topPages.map((p) => (
                  <tr key={p.path} className="border-b last:border-0">
                    <td className="py-2">
                      <a href={p.path} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{p.path}</a>
                    </td>
                    <td className="py-2 text-right font-medium">{p._count.path}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        First-party analytics (privacy-friendly, no cookies). For richer reports, connect Google Analytics / Search
        Console (see Admin → SEO).
      </p>
    </div>
  );
}
