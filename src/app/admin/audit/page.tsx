export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { Card, SectionTitle, EmptyState } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

export default async function AuditPage() {
  const user = await getSessionUser();
  if (!can(user, "audit:read")) {
    return (
      <div className="space-y-4">
        <SectionTitle title="Audit Logs" />
        <EmptyState title="Not authorized" description="You do not have permission to view audit logs." />
      </div>
    );
  }

  const logs = await prisma.auditLog.findMany({
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <SectionTitle title={`Audit Logs (${logs.length})`} />

      {logs.length === 0 ? (
        <EmptyState title="No audit entries" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-3 font-medium">Time</th>
                <th className="p-3 font-medium">Actor</th>
                <th className="p-3 font-medium">Action</th>
                <th className="p-3 font-medium">Entity</th>
                <th className="p-3 font-medium">Entity ID</th>
                <th className="p-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b">
                  <td className="p-3 whitespace-nowrap text-muted-foreground">{formatDateTime(l.createdAt)}</td>
                  <td className="p-3">{l.actor?.email ?? "system"}</td>
                  <td className="p-3 font-medium">{l.action}</td>
                  <td className="p-3 text-muted-foreground">{l.entity}</td>
                  <td className="p-3">
                    <code className="text-xs text-muted-foreground">{l.entityId ?? "—"}</code>
                  </td>
                  <td className="p-3 text-muted-foreground">{l.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
