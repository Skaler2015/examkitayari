import Link from "next/link";
import type { Article, ContentCategory } from "@prisma/client";
import { Badge, Card, CardContent, EmptyState } from "@/components/ui";
import { CATEGORY_META, categoryPath, timeAgo } from "@/lib/format";
import { getLatestByCategory } from "@/server/queries";

export const dynamic = "force-dynamic";

const QUICK_LINKS: { label: string; href: string; emoji: string }[] = [
  { label: "Latest Jobs", href: "/jobs", emoji: "💼" },
  { label: "Admit Card", href: "/admit-card", emoji: "🎫" },
  { label: "Results", href: "/results", emoji: "🏆" },
  { label: "Answer Key", href: "/answer-key", emoji: "🔑" },
  { label: "Exams", href: "/exams", emoji: "📝" },
  { label: "Syllabus", href: "/syllabus", emoji: "📚" },
  { label: "Mock Tests", href: "/mock-tests", emoji: "🧪" },
  { label: "Current Affairs", href: "/current-affairs", emoji: "🗞️" },
];

function LatestColumn({
  category,
  title,
  items,
}: {
  category: ContentCategory;
  title: string;
  items: Article[];
}) {
  const meta = CATEGORY_META[category];
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight">{title}</h2>
          <Link href={`/${meta.path}`} className="text-xs font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            The monitoring engine will populate verified updates here soon.
          </p>
        ) : (
          <ul className="divide-y">
            {items.map((a) => (
              <li key={a.id} className="py-2.5 first:pt-0 last:pb-0">
                <Link href={categoryPath(a.category, a.slug)} className="group block">
                  <p className="text-sm font-medium leading-snug group-hover:text-primary">{a.title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant={meta.badge}>{meta.label}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(a.publishedAt ?? a.createdAt)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default async function HomePage() {
  const [jobs, admitCards, results, answerKeys] = await Promise.all([
    getLatestByCategory("JOB", 6),
    getLatestByCategory("ADMIT_CARD", 6),
    getLatestByCategory("RESULT", 6),
    getLatestByCategory("ANSWER_KEY", 6),
  ]);

  const allEmpty =
    jobs.length === 0 && admitCards.length === 0 && results.length === 0 && answerKeys.length === 0;

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-accent/10 px-5 py-10 text-center sm:px-10 sm:py-14">
        <h1 className="mx-auto max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
          Prepare Smarter. <span className="text-primary">Crack Your Exam.</span>
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground sm:text-lg">
          Verified government job, admit card, result and answer key updates — compiled directly from official
          sources, with source links you can trust.
        </p>
        <form action="/search" className="mx-auto mt-6 flex max-w-xl gap-2">
          <input
            name="q"
            placeholder="Search Exam, Job, Result, Admit Card..."
            className="h-12 w-full rounded-md border border-input bg-background px-4 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            className="h-12 shrink-0 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Search
          </button>
        </form>
      </section>

      {/* Quick links */}
      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUICK_LINKS.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition-colors hover:border-primary/40 hover:bg-secondary/40"
            >
              <span className="text-2xl" aria-hidden>
                {q.emoji}
              </span>
              <span className="text-sm font-semibold">{q.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Latest updates */}
      {allEmpty ? (
        <EmptyState
          title="Fresh updates are on the way"
          description="Our monitoring engine continuously watches official exam and recruitment websites. Verified updates will appear here automatically."
        />
      ) : (
        <section>
          <h2 className="mb-4 text-xl font-bold tracking-tight">Latest Updates</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <LatestColumn category="JOB" title="Latest Jobs" items={jobs} />
            <LatestColumn category="ADMIT_CARD" title="Admit Cards" items={admitCards} />
            <LatestColumn category="RESULT" title="Results" items={results} />
            <LatestColumn category="ANSWER_KEY" title="Answer Keys" items={answerKeys} />
          </div>
        </section>
      )}
    </div>
  );
}
