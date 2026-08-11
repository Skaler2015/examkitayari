import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { getExams } from "@/server/queries";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    title: "Exams",
    description: "Browse competitive and government exams with eligibility, pattern and syllabus details.",
  };
}

export default async function ExamsPage({
  searchParams,
}: {
  searchParams: { page?: string; state?: string };
}) {
  const page = Number(searchParams.page) || 1;
  const state = searchParams.state || undefined;

  const [{ items, pages, page: current, total }, stateRows] = await Promise.all([
    getExams(page, 24, state),
    prisma.exam.findMany({
      where: { state: { not: null } },
      distinct: ["state"],
      select: { state: true },
      orderBy: { state: "asc" },
    }),
  ]);

  const states = stateRows.map((r) => r.state).filter((s): s is string => Boolean(s));

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Exams</h1>
        <p className="mt-1.5 text-muted-foreground">
          Eligibility, exam pattern and syllabus for major government and competitive exams.
        </p>
      </header>

      {states.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <Link
            href="/exams"
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              !state ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-secondary"
            )}
          >
            All States
          </Link>
          {states.map((s) => (
            <Link
              key={s}
              href={`/exams?state=${encodeURIComponent(s)}`}
              className={cn(
                "rounded-full border px-3 py-1 text-sm",
                state === s ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-secondary"
              )}
            >
              {s}
            </Link>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="No exams listed yet"
          description="Exam profiles will appear here as they are added."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((exam) => (
              <Link key={exam.id} href={`/exams/${exam.slug}`}>
                <Card className="h-full transition-colors hover:border-primary/40">
                  <CardContent className="pt-5">
                    <h2 className="text-base font-semibold leading-snug tracking-tight">{exam.name}</h2>
                    {exam.state && <p className="mt-1 text-xs text-muted-foreground">{exam.state}</p>}
                    {exam.qualification && (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{exam.qualification}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {pages > 1 && (
            <nav className="mt-8 flex items-center justify-between gap-4">
              {current > 1 ? (
                <Link
                  href={`/exams?page=${current - 1}${state ? `&state=${encodeURIComponent(state)}` : ""}`}
                  className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-secondary"
                >
                  ← Previous
                </Link>
              ) : (
                <span className="rounded-md border px-4 py-2 text-sm text-muted-foreground opacity-50">← Previous</span>
              )}
              <span className="text-sm text-muted-foreground">
                Page {current} of {pages} · {total} exams
              </span>
              {current < pages ? (
                <Link
                  href={`/exams?page=${current + 1}${state ? `&state=${encodeURIComponent(state)}` : ""}`}
                  className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-secondary"
                >
                  Next →
                </Link>
              ) : (
                <span className="rounded-md border px-4 py-2 text-sm text-muted-foreground opacity-50">Next →</span>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
