export const dynamic = "force-dynamic";

import Link from "next/link";
import { ContentCategory } from "@prisma/client";
import { getLatestByCategory } from "@/server/queries";
import { CategoryGrid } from "@/components/site/CategoryGrid";
import { SectionTable, type Row } from "@/components/site/SectionTable";
import { ImportantLinksBox } from "@/components/site/ImportantLinksBox";

function toRows(items: { slug: string; title: string; category: ContentCategory; publishedAt: Date | null }[]): Row[] {
  return items.map((i) => ({ slug: i.slug, title: i.title, category: i.category, publishedAt: i.publishedAt }));
}

export default async function HomePage() {
  const [jobs, results, admit, answer, notices] = await Promise.all([
    getLatestByCategory(ContentCategory.JOB, 8),
    getLatestByCategory(ContentCategory.RESULT, 8),
    getLatestByCategory(ContentCategory.ADMIT_CARD, 8),
    getLatestByCategory(ContentCategory.ANSWER_KEY, 8),
    getLatestByCategory(ContentCategory.NOTICE, 6),
  ]);

  const empty = jobs.length + results.length + admit.length + answer.length === 0;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-accent/10 p-6 text-center sm:p-10">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-4xl">
          Prepare Smarter. <span className="text-accent">Crack Your Exam.</span>
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Latest government jobs, admit cards, results and answer keys — sourced from official websites with verified
          source links.
        </p>
        <form action="/search" className="mx-auto mt-5 flex max-w-xl gap-2">
          <input
            name="q"
            placeholder="Search Exam, Job, Result, Admit Card…"
            className="h-11 flex-1 rounded-md border border-input bg-card px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button className="h-11 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            Search
          </button>
        </form>
      </section>

      {/* Category grid */}
      <CategoryGrid />

      {empty ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">Updates will appear here automatically.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The monitoring engine is discovering official updates. New jobs, results and admit cards will show up shortly.
          </p>
        </div>
      ) : (
        <>
          {/* Classic three-column layout */}
          <div className="grid gap-5 lg:grid-cols-3">
            <SectionTable title="Latest Jobs" tone="primary" items={toRows(jobs)} viewAllHref="/jobs" />
            <SectionTable title="Results" tone="green" items={toRows(results)} viewAllHref="/results" />
            <SectionTable title="Admit Cards" tone="accent" items={toRows(admit)} viewAllHref="/admit-card" />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <SectionTable title="Answer Keys" tone="purple" items={toRows(answer)} viewAllHref="/answer-key" />
            <SectionTable title="Notices" tone="primary" items={toRows(notices)} viewAllHref="/notices" />
            <ImportantLinksBox />
          </div>
        </>
      )}

      {/* CTA strip */}
      <section className="flex flex-col items-center justify-between gap-3 rounded-xl border bg-secondary/40 p-5 sm:flex-row">
        <div>
          <p className="font-semibold">Never miss an update</p>
          <p className="text-sm text-muted-foreground">Create a free account, follow your exams and get notified.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/register" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Create account
          </Link>
          <Link href="/exams" className="rounded-md border px-4 py-2 text-sm font-semibold">
            Browse exams
          </Link>
        </div>
      </section>
    </div>
  );
}
