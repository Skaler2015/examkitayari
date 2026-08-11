export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDashboardStats, getDailyDiscovery } from "@/server/queries";
import { Card, CardContent, CardHeader, CardTitle, Badge, SectionTitle } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import type { SourceStatus, CrawlStatus } from "@prisma/client";

const statusVariant: Record<SourceStatus, "success" | "warning" | "danger" | "secondary"> = {
  ACTIVE: "success",
  WARNING: "warning",
  ERROR: "danger",
  BLOCKED: "danger",
  DISABLED: "secondary",
};

const crawlVariant: Record<CrawlStatus, "success" | "warning" | "danger" | "secondary"> = {
  SUCCESS: "success",
  PARTIAL: "warning",
  FAILED: "danger",
  SKIPPED: "secondary",
};

function StatTile({
  label,
  value,
  href,
  accent,
}: {
  label: string;
  value: number;
  href?: string;
  accent?: boolean;
}) {
  const inner = (
    <Card className={accent ? "border-primary/40" : undefined}>
      <CardContent className="p-4 sm:p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="block transition-transform hover:-translate-y-0.5">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export default async function AdminDashboardPage() {
  const [stats, discovery, attentionSources, recentCrawls] = await Promise.all([
    getDashboardStats(),
    getDailyDiscovery(14),
    prisma.source.findMany({
      where: { status: { in: ["ERROR", "WARNING", "BLOCKED"] } },
      take: 8,
      orderBy: { consecutiveFailures: "desc" },
    }),
    prisma.sourceCrawl.findMany({
      orderBy: { startedAt: "desc" },
      take: 8,
      include: { source: true },
    }),
  ]);

  const maxDiscovery = Math.max(1, ...discovery.map((d) => d.count));

  return (
    <div className="space-y-8">
      <SectionTitle title="Dashboard" />

      {/* Primary stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="New Updates (today)" value={stats.newToday} href="/admin/articles" />
        <StatTile label="Pending Review" value={stats.pendingReview} href="/admin/review" accent />
        <StatTile label="Published Today" value={stats.publishedToday} href="/admin/articles?status=PUBLISHED" />
        <StatTile label="Failed Sources" value={stats.sourceErrors} href="/admin/sources" />
      </div>

      {/* Secondary tiles */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="New Jobs" value={stats.newJobs} />
        <StatTile label="New Admit Cards" value={stats.newAdmitCards} />
        <StatTile label="New Results" value={stats.newResults} />
        <StatTile label="New Answer Keys" value={stats.newAnswerKeys} />
      </div>

      {/* Discovery chart */}
      <section>
        <SectionTitle title="Discovery (last 14 days)" />
        <Card>
          <CardContent className="p-4 sm:p-5">
            {discovery.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items discovered in this window.</p>
            ) : (
              <div className="flex h-48 items-end gap-2 overflow-x-auto">
                {discovery.map((d) => (
                  <div key={d.date} className="flex min-w-[24px] flex-1 flex-col items-center gap-1">
                    <span className="text-xs font-medium text-muted-foreground">{d.count}</span>
                    <div
                      className="w-full rounded-t bg-primary"
                      style={{ height: `${Math.round((d.count / maxDiscovery) * 150) + 2}px` }}
                      title={`${d.date}: ${d.count}`}
                    />
                    <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                      {d.date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sources needing attention */}
        <Card>
          <CardHeader>
            <CardTitle>Sources needing attention</CardTitle>
          </CardHeader>
          <CardContent>
            {attentionSources.length === 0 ? (
              <p className="text-sm text-muted-foreground">All sources healthy.</p>
            ) : (
              <ul className="divide-y">
                {attentionSources.map((s) => (
                  <li key={s.id} className="py-2.5">
                    <Link
                      href={`/admin/sources/${s.id}`}
                      className="flex items-start justify-between gap-3 hover:underline"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{s.name}</p>
                        {s.lastError && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{s.lastError}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant={statusVariant[s.status]}>{s.status}</Badge>
                        <span className="text-xs text-muted-foreground">{s.consecutiveFailures} fails</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent crawls */}
        <Card>
          <CardHeader>
            <CardTitle>Recent crawls</CardTitle>
          </CardHeader>
          <CardContent>
            {recentCrawls.length === 0 ? (
              <p className="text-sm text-muted-foreground">No crawls yet.</p>
            ) : (
              <ul className="divide-y">
                {recentCrawls.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.source.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.itemsFound} items · {c.responseMs ?? "—"}ms · {timeAgo(c.startedAt)}
                      </p>
                    </div>
                    <Badge variant={crawlVariant[c.status]}>{c.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
