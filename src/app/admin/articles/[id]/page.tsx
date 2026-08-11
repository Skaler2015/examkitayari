export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@/components/ui";
import { CATEGORY_META, VERIFICATION_META, categoryPath, formatDateTime } from "@/lib/format";
import EditForm from "@/app/admin/review/[id]/EditForm";
import { ArticleAdminActions } from "./ArticleAdminActions";
import { ScheduleForm } from "./ScheduleForm";
import { TranslateButton } from "./TranslateButton";

export default async function ManageArticlePage({ params }: { params: { id: string } }) {
  const article = await prisma.article.findUnique({
    where: { id: params.id },
    include: { sourceItem: { include: { source: true } } },
  });
  if (!article) notFound();

  const cat = CATEGORY_META[article.category];
  const ver = VERIFICATION_META[article.verificationStatus];
  const liveUrl = categoryPath(article.category, article.slug);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/articles" className="text-sm text-muted-foreground hover:underline">
          ← Back to articles
        </Link>
        <h1 className="mt-2 text-xl font-bold">{article.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant={cat.badge}>{cat.label}</Badge>
          <Badge variant={article.status === "PUBLISHED" ? "success" : "warning"}>{article.status}</Badge>
          <Badge variant={ver.badge}>{ver.label}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ArticleAdminActions articleId={article.id} status={article.status} liveUrl={liveUrl} />
          <TranslateButton articleId={article.id} hasHindi={Boolean(article.bodyHi)} />
          {article.status !== "PUBLISHED" && (
            <div className="rounded-md border p-3">
              <p className="mb-2 text-sm font-medium">Schedule publish</p>
              <ScheduleForm
                articleId={article.id}
                scheduledFor={article.scheduledFor ? article.scheduledFor.toISOString() : null}
              />
            </div>
          )}
          <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            <Row label="Quality score" value={article.qualityScore != null ? `${article.qualityScore} / 100` : "—"} />
            {article.reviewReason && <Row label="Review reason" value={article.reviewReason} />}
            <Row label="Official source" value={article.officialSource ?? "—"} />
            <Row label="Published" value={formatDateTime(article.publishedAt)} />
            <Row label="Last verified" value={formatDateTime(article.lastVerifiedAt)} />
            <Row label="Public URL" value={article.status === "PUBLISHED" ? liveUrl : "(not published)"} />
          </dl>
          {article.officialSourceUrl && (
            <p className="text-sm">
              <span className="text-muted-foreground">Source link: </span>
              <a href={article.officialSourceUrl} target="_blank" rel="nofollow noopener noreferrer" className="text-primary underline">
                {article.officialSourceUrl}
              </a>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Edit content</CardTitle>
          <p className="text-sm text-muted-foreground">
            Changes save immediately. For a published post, edits go live right away; use “Unpublish” above to take it
            offline first if you prefer.
          </p>
        </CardHeader>
        <CardContent>
          <EditForm
            articleId={article.id}
            title={article.title}
            shortSummary={article.shortSummary ?? ""}
            body={article.body ?? ""}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 border-b py-1.5 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
