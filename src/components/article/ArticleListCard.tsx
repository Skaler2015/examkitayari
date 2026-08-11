import Link from "next/link";
import type { Article } from "@prisma/client";
import { Badge, Card, CardContent } from "@/components/ui";
import { CATEGORY_META, categoryPath, timeAgo } from "@/lib/format";

export function ArticleListCard({ article }: { article: Article }) {
  const meta = CATEGORY_META[article.category];
  return (
    <Card className="transition-colors hover:border-primary/40">
      <CardContent className="pt-5">
        <Link href={categoryPath(article.category, article.slug)} className="block">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant={meta.badge}>{meta.label}</Badge>
            <span className="text-xs text-muted-foreground">{timeAgo(article.publishedAt ?? article.createdAt)}</span>
          </div>
          <h3 className="text-base font-semibold leading-snug tracking-tight hover:text-primary sm:text-lg">
            {article.title}
          </h3>
          {article.shortSummary && (
            <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{article.shortSummary}</p>
          )}
          {article.officialSource && (
            <p className="mt-2 text-xs text-muted-foreground">
              Official source: <span className="font-medium text-foreground">{article.officialSource}</span>
            </p>
          )}
        </Link>
      </CardContent>
    </Card>
  );
}
