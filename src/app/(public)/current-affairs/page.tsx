import type { Metadata } from "next";
import type { Article } from "@prisma/client";
import { EmptyState } from "@/components/ui";
import { ArticleListCard } from "@/components/article/ArticleListCard";
import { getLatestByCategory } from "@/server/queries";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    title: "Current Affairs",
    description: "Latest current affairs and notices relevant to competitive exam aspirants.",
  };
}

export default async function CurrentAffairsPage() {
  const [others, notices] = await Promise.all([
    getLatestByCategory("OTHER", 20),
    getLatestByCategory("NOTICE", 20),
  ]);
  const items: Article[] = [...others, ...notices].sort(
    (a, b) =>
      (b.publishedAt ?? b.createdAt).getTime() - (a.publishedAt ?? a.createdAt).getTime()
  );

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Current Affairs</h1>
        <p className="mt-1.5 text-muted-foreground">
          Stay updated with the latest notices and exam-relevant current affairs.
        </p>
      </header>

      {items.length === 0 ? (
        <EmptyState
          title="No updates yet"
          description="Current affairs and notices will be published here as they are verified from official sources."
        />
      ) : (
        <div className="grid gap-4">
          {items.map((a) => (
            <ArticleListCard key={a.id} article={a} />
          ))}
        </div>
      )}
    </div>
  );
}
