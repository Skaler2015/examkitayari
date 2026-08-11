export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { toggleBookmark } from "@/server/actions/student";
import { categoryPath } from "@/lib/format";
import { Card, CardContent, Button, SectionTitle, EmptyState, Badge } from "@/components/ui";

export default async function BookmarksPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  // Resolve article bookmarks to titles/links.
  const articleIds = bookmarks
    .filter((b) => b.entityType === "article")
    .map((b) => b.articleId ?? b.entityId);
  const articles = articleIds.length
    ? await prisma.article.findMany({
        where: { id: { in: articleIds } },
        select: { id: true, title: true, slug: true, category: true },
      })
    : [];
  const articleMap = new Map(articles.map((a) => [a.id, a]));

  return (
    <div className="space-y-6">
      <SectionTitle title="Bookmarks" />

      {bookmarks.length === 0 ? (
        <EmptyState
          title="No bookmarks yet"
          description="Bookmark jobs, results and articles to find them quickly here."
        />
      ) : (
        <div className="space-y-2">
          {bookmarks.map((b) => {
            const article = articleMap.get(b.articleId ?? b.entityId);
            return (
              <Card key={b.id}>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    {article ? (
                      <Link
                        href={categoryPath(article.category, article.slug)}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {article.title}
                      </Link>
                    ) : (
                      <p className="truncate font-medium">Saved item</p>
                    )}
                    <div className="mt-1">
                      <Badge variant="secondary">{b.entityType}</Badge>
                    </div>
                  </div>
                  <form action={toggleBookmark.bind(null, b.entityType, b.entityId)}>
                    <Button type="submit" variant="outline" size="sm">
                      Remove
                    </Button>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
