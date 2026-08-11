export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { Card, CardContent, SectionTitle, EmptyState, Badge } from "@/components/ui";

export default async function TestHistoryPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const attempts = await prisma.userAttempt.findMany({
    where: { userId: user.id, mockTestId: { not: null } },
    include: { mockTest: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <SectionTitle title="Test history" />

      {attempts.length === 0 ? (
        <EmptyState
          title="No tests taken yet"
          description="Attempt a mock test to see your scores and progress here."
        />
      ) : (
        <div className="space-y-2">
          {attempts.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.mockTest?.title ?? "Mock test"}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</p>
                </div>
                <Badge variant="default" className="shrink-0">
                  {a.score ?? 0}
                  {a.totalScore != null ? ` / ${a.totalScore}` : ""}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
