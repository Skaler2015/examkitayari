export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { CATEGORY_META, VERIFICATION_META, formatDateTime } from "@/lib/format";
import ReviewActions from "./ReviewActions";
import EditForm from "./EditForm";

function KeyVal({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export default async function ReviewDetailPage({ params }: { params: { id: string } }) {
  const article = await prisma.article.findUnique({
    where: { id: params.id },
    include: {
      job: true,
      admitCard: true,
      result: true,
      answerKey: true,
      notice: true,
      sourceItem: { include: { source: true, document: true } },
      articleSources: true,
    },
  });

  if (!article) notFound();

  const cat = CATEGORY_META[article.category];
  const ver = VERIFICATION_META[article.verificationStatus];
  const item = article.sourceItem;
  const doc = item?.document;
  const rawText = item?.rawContent ?? "";
  const rawTruncated = rawText.length > 4000 ? rawText.slice(0, 4000) + "\n… [truncated]" : rawText;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link href="/admin/review" className="text-sm text-muted-foreground hover:underline">
            ← Back to review queue
          </Link>
          <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{article.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={cat.badge}>{cat.label}</Badge>
            <Badge variant={ver.badge}>{ver.label}</Badge>
            {article.aiGenerated && <Badge variant="accent">AI generated</Badge>}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <Card>
        <CardContent className="p-4">
          <ReviewActions articleId={article.id} />
        </CardContent>
      </Card>

      {/* Two columns */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* LEFT — Official Source */}
        <Card>
          <CardHeader>
            <CardTitle>Official Source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {item ? (
              <>
                <div className="space-y-1.5 text-sm">
                  <KeyVal label="Source" value={item.source.name} />
                  <KeyVal label="Published" value={formatDateTime(item.publishedAt)} />
                  <div className="flex justify-between gap-4 py-1.5">
                    <span className="shrink-0 text-muted-foreground">URL</span>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-right text-primary hover:underline"
                    >
                      {item.url}
                    </a>
                  </div>
                </div>

                {doc && (
                  <div className="rounded-md border bg-secondary/40 p-3 text-sm">
                    <p className="mb-1 font-medium">PDF document</p>
                    <KeyVal label="SHA-256" value={<code className="text-xs">{doc.sha256.slice(0, 16)}…</code>} />
                    <KeyVal label="Pages" value={doc.pageCount ?? "—"} />
                    <KeyVal
                      label="File size"
                      value={doc.fileSize ? `${(doc.fileSize / 1024).toFixed(0)} KB` : "—"}
                    />
                  </div>
                )}

                <div>
                  <p className="mb-1.5 text-sm font-medium">Extracted raw text</p>
                  <pre className="max-h-96 overflow-auto rounded-md border bg-muted/30 p-3 text-xs leading-relaxed whitespace-pre-wrap">
                    {rawTruncated || "— no raw content —"}
                  </pre>
                </div>

                {item.extractedData != null && (
                  <div>
                    <p className="mb-1.5 text-sm font-medium">Extracted data (JSON)</p>
                    <pre className="max-h-72 overflow-auto rounded-md border bg-muted/30 p-3 text-xs">
                      {JSON.stringify(item.extractedData, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No linked source item.</p>
            )}
          </CardContent>
        </Card>

        {/* RIGHT — Generated Article */}
        <Card>
          <CardHeader>
            <CardTitle>Generated Article</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-semibold">{article.title}</p>
              {article.shortSummary && (
                <p className="mt-1 text-sm text-muted-foreground">{article.shortSummary}</p>
              )}
            </div>

            {article.importantPoints.length > 0 && (
              <div>
                <p className="mb-1.5 text-sm font-medium">Important points</p>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {article.importantPoints.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Typed record key fields */}
            {article.job && (
              <div className="rounded-md border p-3">
                <p className="mb-1 text-sm font-medium">Job details</p>
                <KeyVal label="Post" value={article.job.postName} />
                <KeyVal label="Vacancies" value={article.job.vacancyCount} />
                <KeyVal label="Qualification" value={article.job.qualification} />
                <KeyVal label="Application start" value={formatDateTime(article.job.applicationStart)} />
                <KeyVal label="Application end" value={formatDateTime(article.job.applicationEnd)} />
                <KeyVal label="Salary" value={article.job.salary} />
              </div>
            )}
            {article.admitCard && (
              <div className="rounded-md border p-3">
                <p className="mb-1 text-sm font-medium">Admit card details</p>
                <KeyVal label="Exam name" value={article.admitCard.examName} />
                <KeyVal label="Release date" value={formatDateTime(article.admitCard.releaseDate)} />
                <KeyVal label="Exam date" value={formatDateTime(article.admitCard.examDate)} />
              </div>
            )}
            {article.result && (
              <div className="rounded-md border p-3">
                <p className="mb-1 text-sm font-medium">Result details</p>
                <KeyVal label="Exam name" value={article.result.examName} />
                <KeyVal label="Release date" value={formatDateTime(article.result.releaseDate)} />
                <KeyVal label="Type" value={article.result.resultType} />
              </div>
            )}
            {article.answerKey && (
              <div className="rounded-md border p-3">
                <p className="mb-1 text-sm font-medium">Answer key details</p>
                <KeyVal label="Exam name" value={article.answerKey.examName} />
                <KeyVal label="Key type" value={article.answerKey.keyType} />
                <KeyVal label="Objection end" value={formatDateTime(article.answerKey.objectionEnd)} />
              </div>
            )}

            <div>
              <p className="mb-1.5 text-sm font-medium">Body preview</p>
              <div
                className="prose-article max-h-[28rem] overflow-auto rounded-md border p-3"
                dangerouslySetInnerHTML={{ __html: article.body ?? "" }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit form */}
      <Card>
        <CardHeader>
          <CardTitle>Edit article</CardTitle>
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
