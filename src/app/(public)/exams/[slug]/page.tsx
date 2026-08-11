import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Article } from "@prisma/client";
import { Badge, Card, CardContent } from "@/components/ui";
import { CATEGORY_META, categoryPath } from "@/lib/format";
import { getExamBySlug } from "@/server/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const exam = await getExamBySlug(params.slug);
  if (!exam) return { title: "Exam not found" };
  return {
    title: exam.name,
    description:
      exam.description ??
      `${exam.name} — eligibility, exam pattern, syllabus and the latest jobs, admit cards, results and answer keys.`,
  };
}

function LinkedList({ title, rows }: { title: string; rows: { article: Article | null }[] }) {
  const items = rows.map((r) => r.article).filter((a): a is Article => a != null);
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold tracking-tight">{title}</h2>
      <ul className="space-y-2">
        {items.map((a) => (
          <li key={a.id}>
            <Link
              href={categoryPath(a.category, a.slug)}
              className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm hover:border-primary/40"
            >
              <span className="font-medium">{a.title}</span>
              <Badge variant={CATEGORY_META[a.category].badge}>{CATEGORY_META[a.category].label}</Badge>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <h3 className="text-sm font-bold tracking-tight">{label}</h3>
      <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{value}</p>
    </div>
  );
}

export default async function ExamDetailPage({ params }: { params: { slug: string } }) {
  const exam = await getExamBySlug(params.slug);
  if (!exam) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{exam.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {exam.organization && <span>{exam.organization.name}</span>}
          {exam.state && <Badge variant="secondary">{exam.state}</Badge>}
        </div>
        {exam.officialWebsite && (
          <a
            href={exam.officialWebsite}
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="mt-2 inline-block text-sm font-medium text-primary underline underline-offset-2"
          >
            Visit official website
          </a>
        )}
      </header>

      {exam.description && (
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">{exam.description}</CardContent>
        </Card>
      )}

      <div className="space-y-6">
        <Field label="Eligibility / Qualification" value={exam.qualification} />
        <Field label="Age Criteria" value={exam.ageCriteria} />
        {exam.subjects.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-bold tracking-tight">Subjects</h3>
            <div className="flex flex-wrap gap-2">
              {exam.subjects.map((s) => (
                <Badge key={s} variant="outline">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        )}
        <Field label="Exam Pattern" value={exam.examPattern} />
        <Field label="Syllabus" value={exam.syllabus} />
      </div>

      <div className="space-y-6">
        <LinkedList title="Related Jobs" rows={exam.jobs} />
        <LinkedList title="Admit Cards" rows={exam.admitCards} />
        <LinkedList title="Results" rows={exam.results} />
        <LinkedList title="Answer Keys" rows={exam.answerKeys} />
      </div>

      {exam.mockTests.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold tracking-tight">Mock Tests</h2>
          <ul className="space-y-2">
            {exam.mockTests.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm"
              >
                <span className="font-medium">{m.title}</span>
                <span className="text-xs text-muted-foreground">{m.durationMin} min</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
