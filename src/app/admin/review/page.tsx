export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, Badge, SectionTitle, EmptyState, Button } from "@/components/ui";
import { CATEGORY_META, VERIFICATION_META, timeAgo } from "@/lib/format";

export default async function ReviewQueuePage() {
  const articles = await prisma.article.findMany({
    where: { status: "PENDING_REVIEW" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <SectionTitle
        title={`Pending Review (${articles.length})`}
        action={
          <Link href="/admin/articles">
            <Button variant="outline" size="sm">
              All articles
            </Button>
          </Link>
        }
      />

      {articles.length === 0 ? (
        <EmptyState title="Nothing to review" description="All discovered updates have been processed." />
      ) : (
        <div className="space-y-3">
          {articles.map((a) => {
            const cat = CATEGORY_META[a.category];
            const ver = VERIFICATION_META[a.verificationStatus];
            return (
              <Card key={a.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge variant={cat.badge}>{cat.label}</Badge>
                      <Badge variant={ver.badge}>{ver.label}</Badge>
                      <span className="text-xs text-muted-foreground">{timeAgo(a.createdAt)}</span>
                    </div>
                    <p className="truncate font-medium">{a.title}</p>
                    {a.officialSource && (
                      <p className="truncate text-xs text-muted-foreground">Source: {a.officialSource}</p>
                    )}
                  </div>
                  <Link href={`/admin/review/${a.id}`} className="shrink-0">
                    <Button size="sm">Review</Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
