import type { Metadata } from "next";
import Link from "next/link";
import type { Article } from "@prisma/client";
import { EmptyState } from "@/components/ui";
import { ArticleListCard } from "@/components/article/ArticleListCard";
import { getLatestByCategory } from "@/server/queries";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    title: "Syllabus & Exam Pattern",
    description: "Latest syllabus and exam pattern updates for government and competitive exams.",
  };
}

export default async function SyllabusPage() {
  const [syllabus, patterns] = await Promise.all([
    getLatestByCategory("SYLLABUS", 20),
    getLatestByCategory("EXAM_PATTERN", 20),
  ]);
  const items: Article[] = [...syllabus, ...patterns].sort(
    (a, b) =>
      (b.publishedAt ?? b.createdAt).getTime() - (a.publishedAt ?? a.createdAt).getTime()
  );

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Syllabus & Exam Pattern</h1>
        <p className="mt-1.5 text-muted-foreground">
          Detailed syllabus and exam pattern updates. Looking for a specific exam?{" "}
          <Link href="/exams" className="font-medium text-primary underline underline-offset-2">
            Browse all exams
          </Link>
          .
        </p>
      </header>

      {items.length === 0 ? (
        <EmptyState
          title="No syllabus updates yet"
          description="Syllabus and exam pattern updates will be published here as they are verified. Meanwhile, explore full exam profiles on the Exams page."
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
