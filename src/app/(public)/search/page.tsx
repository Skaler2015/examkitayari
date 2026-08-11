import type { Metadata } from "next";
import Link from "next/link";
import { ContentCategory } from "@prisma/client";
import { EmptyState } from "@/components/ui";
import { CATEGORY_META } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ArticleListCard } from "@/components/article/ArticleListCard";
import { search } from "@/server/queries";

export const dynamic = "force-dynamic";

export function generateMetadata({ searchParams }: { searchParams: { q?: string } }): Metadata {
  const q = searchParams.q?.trim();
  return {
    title: q ? `Search: ${q}` : "Search",
    description: "Search verified exam, job, result, admit card and answer key updates.",
    robots: { index: false, follow: true },
  };
}

const FILTERS: { label: string; value: ContentCategory }[] = [
  { label: "Jobs", value: ContentCategory.JOB },
  { label: "Admit Cards", value: ContentCategory.ADMIT_CARD },
  { label: "Results", value: ContentCategory.RESULT },
  { label: "Answer Keys", value: ContentCategory.ANSWER_KEY },
  { label: "Notices", value: ContentCategory.NOTICE },
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string };
}) {
  const q = searchParams.q?.trim() ?? "";
  const category =
    searchParams.category && searchParams.category in ContentCategory
      ? (searchParams.category as ContentCategory)
      : undefined;

  const results = q ? await search(q, category) : [];

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Search</h1>
      </header>

      <form action="/search" className="flex max-w-xl gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search Exam, Job, Result, Admit Card..."
          className="h-11 w-full rounded-md border border-input bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {category && <input type="hidden" name="category" value={category} />}
        <button
          type="submit"
          className="h-11 shrink-0 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Search
        </button>
      </form>

      {q && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/search?q=${encodeURIComponent(q)}`}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              !category ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-secondary"
            )}
          >
            All
          </Link>
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={`/search?q=${encodeURIComponent(q)}&category=${f.value}`}
              className={cn(
                "rounded-full border px-3 py-1 text-sm",
                category === f.value ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-secondary"
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6">
        {!q ? (
          <EmptyState
            title="Start typing to search"
            description="Search across verified jobs, admit cards, results, answer keys and notices."
          />
        ) : results.length === 0 ? (
          <EmptyState
            title={`No results for "${q}"`}
            description={
              category
                ? `Try removing the ${CATEGORY_META[category].label} filter or searching a different term.`
                : "Try a different keyword or check the spelling."
            }
          />
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              {results.length} result{results.length === 1 ? "" : "s"} for &ldquo;{q}&rdquo;
            </p>
            <div className="grid gap-4">
              {results.map((a) => (
                <ArticleListCard key={a.id} article={a} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
