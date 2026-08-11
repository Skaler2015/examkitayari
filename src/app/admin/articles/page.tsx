export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, Badge, SectionTitle, EmptyState } from "@/components/ui";
import { CATEGORY_META, VERIFICATION_META, categoryPath, formatDate } from "@/lib/format";
import { PublishStatus, type Prisma } from "@prisma/client";

const statusVariant: Record<PublishStatus, "success" | "warning" | "danger" | "secondary" | "default"> = {
  DRAFT: "secondary",
  PENDING_REVIEW: "warning",
  SCHEDULED: "default",
  PUBLISHED: "success",
  ARCHIVED: "secondary",
  REJECTED: "danger",
};

const STATUS_FILTERS = ["ALL", ...Object.values(PublishStatus)];

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const statusParam = searchParams.status;
  const isValid =
    statusParam && (Object.values(PublishStatus) as string[]).includes(statusParam);
  const where: Prisma.ArticleWhereInput = isValid
    ? { status: statusParam as PublishStatus }
    : {};

  const articles = await prisma.article.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <SectionTitle title={`Articles (${articles.length})`} />

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => {
          const active = s === "ALL" ? !isValid : statusParam === s;
          const href = s === "ALL" ? "/admin/articles" : `/admin/articles?status=${s}`;
          return (
            <Link
              key={s}
              href={href}
              className={
                active
                  ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                  : "rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary"
              }
            >
              {s}
            </Link>
          );
        })}
      </div>

      {articles.length === 0 ? (
        <EmptyState title="No articles" description="No articles match this filter." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-3 font-medium">Title</th>
                <th className="p-3 font-medium">Category</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Verification</th>
                <th className="p-3 font-medium">Published</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => {
                const cat = CATEGORY_META[a.category];
                const ver = VERIFICATION_META[a.verificationStatus];
                const titleNode =
                  a.status === PublishStatus.PUBLISHED ? (
                    <Link
                      href={categoryPath(a.category, a.slug)}
                      className="font-medium text-primary hover:underline"
                    >
                      {a.title}
                    </Link>
                  ) : (
                    <Link
                      href={`/admin/review/${a.id}`}
                      className="font-medium hover:underline"
                    >
                      {a.title}
                    </Link>
                  );
                return (
                  <tr key={a.id} className="border-b transition-colors hover:bg-secondary/40">
                    <td className="p-3">{titleNode}</td>
                    <td className="p-3">
                      <Badge variant={cat.badge}>{cat.label}</Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant={statusVariant[a.status]}>{a.status}</Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant={ver.badge}>{ver.label}</Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {a.publishedAt ? formatDate(a.publishedAt) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
