export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, Badge, SectionTitle, Button, EmptyState } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import type { SourceStatus } from "@prisma/client";

const statusVariant: Record<SourceStatus, "success" | "warning" | "danger" | "secondary"> = {
  ACTIVE: "success",
  WARNING: "warning",
  ERROR: "danger",
  BLOCKED: "danger",
  DISABLED: "secondary",
};

export default async function SourcesPage() {
  const sources = await prisma.source.findMany({
    include: { organization: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <SectionTitle
        title={`Sources (${sources.length})`}
        action={
          <Link href="/admin/sources/new">
            <Button size="sm">Add Source</Button>
          </Link>
        }
      />

      {sources.length === 0 ? (
        <EmptyState title="No sources yet" description="Add an official source to start monitoring." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Organization</th>
                <th className="p-3 font-medium">Type</th>
                <th className="p-3 font-medium">Priority</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Freq</th>
                <th className="p-3 font-medium">Last checked</th>
                <th className="p-3 font-medium">Items</th>
                <th className="p-3 font-medium">Fails</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id} className="border-b transition-colors hover:bg-secondary/40">
                  <td className="p-3">
                    <Link href={`/admin/sources/${s.id}`} className="font-medium text-primary hover:underline">
                      {s.name}
                    </Link>
                  </td>
                  <td className="p-3 text-muted-foreground">{s.organization?.name ?? "—"}</td>
                  <td className="p-3">
                    <Badge variant="outline">{s.type}</Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">{s.priority}</td>
                  <td className="p-3">
                    <Badge variant={statusVariant[s.status]}>{s.status}</Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">{s.frequencyMinutes}m</td>
                  <td className="p-3 text-muted-foreground">{timeAgo(s.lastCheckedAt)}</td>
                  <td className="p-3 text-muted-foreground">{s.lastItemsFound ?? 0}</td>
                  <td className="p-3 text-muted-foreground">{s.consecutiveFailures}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
