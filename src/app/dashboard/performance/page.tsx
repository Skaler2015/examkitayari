export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { Card, CardContent, SectionTitle, EmptyState, Badge } from "@/components/ui";

function label(subject: string | null, topic: string | null): string {
  return [subject, topic].filter(Boolean).join(" · ") || "General";
}

export default async function PerformancePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const rows = await prisma.userPerformance.findMany({
    where: { userId: user.id },
    orderBy: { accuracy: "asc" },
  });

  const weak = rows.filter((r) => r.isWeak);

  return (
    <div className="space-y-6">
      <SectionTitle title="Performance" />

      {rows.length === 0 ? (
        <EmptyState
          title="No performance data yet"
          description="Take a few mock tests and your subject-wise accuracy will appear here."
        />
      ) : (
        <>
          {weak.length > 0 && (
            <Card className="border-amber-300 dark:border-amber-500/40">
              <CardContent className="p-4">
                <p className="text-sm font-semibold">Weak topics to focus on</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {weak.map((r) => (
                    <Badge key={r.id} variant="warning">
                      {label(r.subject, r.topic)}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            {rows.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{label(r.subject, r.topic)}</p>
                      {r.isWeak && <Badge variant="warning">Weak</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.correct}/{r.attempts} correct
                    </p>
                  </div>
                  <Badge variant={r.accuracy >= 0.6 ? "success" : "secondary"} className="shrink-0">
                    {Math.round(r.accuracy * 100)}%
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
