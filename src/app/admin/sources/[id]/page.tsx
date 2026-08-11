export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, Badge, EmptyState } from "@/components/ui";
import { formatDateTime, timeAgo } from "@/lib/format";
import type { SourceStatus, CrawlStatus, ChangeType } from "@prisma/client";
import SourceControls from "./SourceControls";
import SourceForm from "../SourceForm";

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

const changeVariant: Record<ChangeType, "success" | "warning" | "danger" | "secondary" | "default"> = {
  NEW: "success",
  UPDATED: "warning",
  UNCHANGED: "secondary",
  REMOVED: "danger",
  ERROR: "danger",
};

function HealthRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value ?? "—"}</span>
    </div>
  );
}

export default async function SourceDetailPage({ params }: { params: { id: string } }) {
  const source = await prisma.source.findUnique({
    where: { id: params.id },
    include: { organization: true },
  });
  if (!source) notFound();

  const [crawls, changes, items] = await Promise.all([
    prisma.sourceCrawl.findMany({ where: { sourceId: source.id }, orderBy: { startedAt: "desc" }, take: 15 }),
    prisma.sourceChange.findMany({
      where: { sourceId: source.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { item: true },
    }),
    prisma.sourceItem.findMany({ where: { sourceId: source.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/sources" className="text-sm text-muted-foreground hover:underline">
          ← Back to sources
        </Link>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{source.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant[source.status]}>{source.status}</Badge>
              <Badge variant="outline">{source.type}</Badge>
              <span className="text-sm text-muted-foreground">{source.organization?.name}</span>
            </div>
          </div>
          <SourceControls id={source.id} isActive={source.isActive} />
        </div>
      </div>

      {/* Health */}
      <Card>
        <CardHeader>
          <CardTitle>Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-x-8 sm:grid-cols-2">
            <div>
              <HealthRow label="Last checked" value={formatDateTime(source.lastCheckedAt)} />
              <HealthRow label="Last success" value={formatDateTime(source.lastSuccessAt)} />
              <HealthRow label="Next crawl" value={formatDateTime(source.nextCrawlAt)} />
              <HealthRow label="Last HTTP status" value={source.lastHttpStatus} />
            </div>
            <div>
              <HealthRow label="Last response" value={source.lastResponseMs ? `${source.lastResponseMs} ms` : "—"} />
              <HealthRow label="Last items found" value={source.lastItemsFound ?? 0} />
              <HealthRow label="Consecutive failures" value={source.consecutiveFailures} />
              <HealthRow label="Monitor URL" value={<span className="break-all">{source.monitorUrl}</span>} />
            </div>
          </div>
          {source.lastError && (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
              {source.lastError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent crawls */}
      <Card className="overflow-x-auto">
        <CardHeader>
          <CardTitle>Recent crawls</CardTitle>
        </CardHeader>
        <CardContent>
          {crawls.length === 0 ? (
            <EmptyState title="No crawls yet" />
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-2 font-medium">Started</th>
                  <th className="p-2 font-medium">Status</th>
                  <th className="p-2 font-medium">HTTP</th>
                  <th className="p-2 font-medium">Response</th>
                  <th className="p-2 font-medium">Found</th>
                  <th className="p-2 font-medium">New</th>
                  <th className="p-2 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {crawls.map((c) => (
                  <tr key={c.id} className="border-b">
                    <td className="p-2 text-muted-foreground">{timeAgo(c.startedAt)}</td>
                    <td className="p-2">
                      <Badge variant={crawlVariant[c.status]}>{c.status}</Badge>
                    </td>
                    <td className="p-2 text-muted-foreground">{c.httpStatus ?? "—"}</td>
                    <td className="p-2 text-muted-foreground">{c.responseMs ? `${c.responseMs}ms` : "—"}</td>
                    <td className="p-2 text-muted-foreground">{c.itemsFound}</td>
                    <td className="p-2 text-muted-foreground">{c.itemsNew}</td>
                    <td className="p-2 text-muted-foreground">{c.itemsUpdated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent changes */}
        <Card>
          <CardHeader>
            <CardTitle>Recent changes</CardTitle>
          </CardHeader>
          <CardContent>
            {changes.length === 0 ? (
              <EmptyState title="No changes recorded" />
            ) : (
              <ul className="divide-y">
                {changes.map((ch) => (
                  <li key={ch.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate">{ch.url ?? ch.item?.title ?? ch.field ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(ch.createdAt)}</p>
                    </div>
                    <Badge variant={changeVariant[ch.type]}>{ch.type}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent items */}
        <Card>
          <CardHeader>
            <CardTitle>Recent discovered items</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <EmptyState title="No items discovered" />
            ) : (
              <ul className="divide-y">
                {items.map((it) => (
                  <li key={it.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{it.title ?? it.url}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(it.createdAt)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant="outline">{it.stage}</Badge>
                      {it.category && <span className="text-xs text-muted-foreground">{it.category}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit source */}
      <Card>
        <CardHeader>
          <CardTitle>Edit source</CardTitle>
        </CardHeader>
        <CardContent>
          <details>
            <summary className="cursor-pointer text-sm font-medium text-primary">Show edit form</summary>
            <div className="mt-4">
              <SourceForm source={source} />
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
