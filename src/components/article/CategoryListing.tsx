import Link from "next/link";
import type { ContentCategory } from "@prisma/client";
import { EmptyState } from "@/components/ui";
import { getPublishedByCategory } from "@/server/queries";
import { ArticleListCard } from "@/components/article/ArticleListCard";

export async function CategoryListing({
  category,
  title,
  description,
  page,
  basePath,
}: {
  category: ContentCategory;
  title: string;
  description?: string;
  page: number;
  basePath: string;
}) {
  const { items, pages, page: current, total } = await getPublishedByCategory(category, page);

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 text-muted-foreground">{description}</p>}
        {total > 0 && <p className="mt-1 text-sm text-muted-foreground">{total} updates published</p>}
      </header>

      {items.length === 0 ? (
        <EmptyState
          title="No updates published yet"
          description="Our monitoring engine is watching official sources. Verified updates will appear here as soon as they are published."
        />
      ) : (
        <>
          <div className="grid gap-4">
            {items.map((article) => (
              <ArticleListCard key={article.id} article={article} />
            ))}
          </div>

          {pages > 1 && (
            <nav className="mt-8 flex items-center justify-between gap-4">
              {current > 1 ? (
                <Link
                  href={`${basePath}?page=${current - 1}`}
                  className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-secondary"
                >
                  ← Previous
                </Link>
              ) : (
                <span className="rounded-md border px-4 py-2 text-sm text-muted-foreground opacity-50">← Previous</span>
              )}
              <span className="text-sm text-muted-foreground">
                Page {current} of {pages}
              </span>
              {current < pages ? (
                <Link
                  href={`${basePath}?page=${current + 1}`}
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
