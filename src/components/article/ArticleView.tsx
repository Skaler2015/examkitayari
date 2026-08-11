import Link from "next/link";
import { Badge, Card, CardContent } from "@/components/ui";
import { ProvenanceBar } from "@/components/shared/ProvenanceBar";
import { CATEGORY_META, categoryPath, formatDate } from "@/lib/format";
import { sanitizeHtml } from "@/lib/sanitize";
import type { getArticleBySlug } from "@/server/queries";

type FullArticle = NonNullable<Awaited<ReturnType<typeof getArticleBySlug>>>;

type Detail = { label: string; value: string };

function jobDetails(job: NonNullable<FullArticle["job"]>): Detail[] {
  return [
    { label: "Post Name", value: job.postName ?? "Not Available in Official Source" },
    { label: "Recruitment", value: job.recruitmentName ?? "Not Available in Official Source" },
    {
      label: "Total Vacancies",
      value: job.vacancyCount != null ? String(job.vacancyCount) : "Not Available in Official Source",
    },
    { label: "Qualification", value: job.qualification ?? "Not Available in Official Source" },
    { label: "Age Limit", value: job.ageLimit ?? "Not Available in Official Source" },
    { label: "Application Start", value: formatDate(job.applicationStart) },
    { label: "Application End", value: formatDate(job.applicationEnd) },
    { label: "Application Fee", value: job.applicationFee ?? "Not Available in Official Source" },
    { label: "Salary", value: job.salary ?? "Not Available in Official Source" },
    { label: "Selection Process", value: job.selectionProcess ?? "Not Available in Official Source" },
    { label: "Exam Date", value: formatDate(job.examDate) },
    { label: "State", value: job.state ?? "Not Available in Official Source" },
  ];
}

function admitCardDetails(a: NonNullable<FullArticle["admitCard"]>): Detail[] {
  return [
    { label: "Exam Name", value: a.examName ?? "Not Available in Official Source" },
    { label: "Post", value: a.post ?? "Not Available in Official Source" },
    { label: "Release Date", value: formatDate(a.releaseDate) },
    { label: "Exam Date", value: formatDate(a.examDate) },
    { label: "Exam Shift", value: a.examShift ?? "Not Available in Official Source" },
    { label: "Exam City / Centre", value: a.examCityInfo ?? "Not Available in Official Source" },
  ];
}

function resultDetails(r: NonNullable<FullArticle["result"]>): Detail[] {
  return [
    { label: "Exam Name", value: r.examName ?? "Not Available in Official Source" },
    { label: "Release Date", value: formatDate(r.releaseDate) },
    { label: "Result Type", value: r.resultType ?? "Not Available in Official Source" },
  ];
}

function answerKeyDetails(k: NonNullable<FullArticle["answerKey"]>): Detail[] {
  return [
    { label: "Exam Name", value: k.examName ?? "Not Available in Official Source" },
    { label: "Exam Date", value: formatDate(k.examDate) },
    { label: "Key Type", value: k.keyType ?? "Not Available in Official Source" },
    { label: "Final Key", value: k.isFinal ? "Yes" : "Provisional" },
    { label: "Objection Window Start", value: formatDate(k.objectionStart) },
    { label: "Objection Window End", value: formatDate(k.objectionEnd) },
  ];
}

function collectDetails(article: FullArticle): Detail[] {
  if (article.job) return jobDetails(article.job);
  if (article.admitCard) return admitCardDetails(article.admitCard);
  if (article.result) return resultDetails(article.result);
  if (article.answerKey) return answerKeyDetails(article.answerKey);
  return [];
}

function collectLinks(article: FullArticle): { label: string; url: string }[] {
  const links: { label: string; url: string }[] = [];
  const push = (label: string, url?: string | null) => {
    if (url) links.push({ label, url });
  };
  if (article.job) {
    push("Official Notification", article.job.officialNotificationUrl);
    push("Apply Online", article.job.applyOnlineUrl);
    push("Official Website", article.job.officialWebsite);
  }
  if (article.admitCard) push("Download Admit Card", article.admitCard.downloadUrl);
  if (article.result) {
    push("Check Result", article.result.resultUrl);
    push("Download Scorecard", article.result.scorecardUrl);
  }
  if (article.answerKey) {
    push("Download Answer Key", article.answerKey.answerKeyUrl);
    push("Response Sheet", article.answerKey.responseSheetUrl);
  }
  if (article.notice) push("Download Notice", article.notice.fileUrl);
  push("Official Source", article.officialSourceUrl);
  // de-duplicate by url
  const seen = new Set<string>();
  return links.filter((l) => (seen.has(l.url) ? false : (seen.add(l.url), true)));
}

export function ArticleView({ article }: { article: FullArticle }) {
  const meta = CATEGORY_META[article.category];
  const details = collectDetails(article);
  const links = collectLinks(article);
  const faq = (article.faq as { q: string; a: string }[] | null) ?? [];
  const points = article.importantPoints ?? [];
  const related = article.relatedFrom ?? [];

  return (
    <article className="mx-auto max-w-3xl">
      {/* Breadcrumb */}
      <nav className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <span>/</span>
        <Link href={`/${meta.path}`} className="hover:text-foreground">
          {meta.label}
        </Link>
        <span>/</span>
        <span className="truncate text-foreground">{article.title}</span>
      </nav>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant={meta.badge}>{meta.label}</Badge>
      </div>

      <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{article.title}</h1>
      {article.shortSummary && (
        <p className="mt-2 text-base text-muted-foreground">{article.shortSummary}</p>
      )}

      <div className="mt-5">
        <ProvenanceBar
          officialSource={article.officialSource}
          officialSourceUrl={article.officialSourceUrl}
          verificationStatus={article.verificationStatus}
          publishedAt={article.publishedAt}
          lastVerifiedAt={article.lastVerifiedAt}
          aiGenerated={article.aiGenerated}
        />
      </div>

      {/* Key details */}
      {details.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-bold tracking-tight">Key Details</h2>
          <Card>
            <CardContent className="pt-5">
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {details.map((d) => (
                  <div key={d.label} className="flex flex-col gap-0.5 border-b pb-2 last:border-0 sm:last:border-b sm:[&:nth-last-child(-n+1)]:border-0">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{d.label}</dt>
                    <dd className="text-sm font-medium">{d.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Highlights */}
      {points.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-bold tracking-tight">Highlights</h2>
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
            <ul className="list-inside list-disc space-y-1.5 text-sm">
              {points.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Body */}
      {article.body && (
        <section className="mt-6">
          <div
            className="prose-article max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.body) }}
          />
        </section>
      )}

      {/* Important links */}
      {links.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-bold tracking-tight">Important Links</h2>
          <Card>
            <CardContent className="pt-5">
              <ul className="divide-y">
                {links.map((l) => (
                  <li key={l.url} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                    <span className="text-sm font-medium">{l.label}</span>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="nofollow noopener noreferrer"
                      className="text-sm font-semibold text-primary underline underline-offset-2"
                    >
                      Open link
                    </a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      {/* FAQ */}
      {faq.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-bold tracking-tight">Frequently Asked Questions</h2>
          <div className="space-y-2">
            {faq.map((item, i) => (
              <details key={i} className="group rounded-lg border bg-card p-4 [&_summary]:cursor-pointer">
                <summary className="flex items-center justify-between gap-4 font-medium marker:content-['']">
                  <span>{item.q}</span>
                  <span className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold tracking-tight">Related Updates</h2>
          <ul className="space-y-2">
            {related.map((rel) => (
              <li key={rel.to.id}>
                <Link
                  href={categoryPath(rel.to.category, rel.to.slug)}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm hover:border-primary/40"
                >
                  <span className="font-medium">{rel.to.title}</span>
                  <Badge variant={CATEGORY_META[rel.to.category].badge}>{CATEGORY_META[rel.to.category].label}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
