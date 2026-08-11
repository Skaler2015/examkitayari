import type { Metadata } from "next";
import { Card, CardContent, EmptyState, Badge } from "@/components/ui";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    title: "Mock Tests",
    description: "Practice free mock tests for government and competitive exams.",
  };
}

export default async function MockTestsPage() {
  const tests = await prisma.mockTest.findMany({
    where: { isPublished: true },
    include: { exam: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Mock Tests</h1>
        <p className="mt-1.5 text-muted-foreground">
          Timed practice tests to sharpen your exam preparation.
        </p>
      </header>

      {tests.length === 0 ? (
        <EmptyState
          title="No mock tests published yet"
          description="Practice tests will be available here soon. Check back shortly."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tests.map((t) => (
            <Card key={t.id} className="h-full">
              <CardContent className="pt-5">
                <h2 className="text-base font-semibold leading-snug tracking-tight">{t.title}</h2>
                {t.exam && <p className="mt-1 text-xs text-muted-foreground">{t.exam.name}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{t.durationMin} min</Badge>
                  {t.totalMarks > 0 && <Badge variant="outline">{t.totalMarks} marks</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
