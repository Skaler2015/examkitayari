import type { Article } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { titleSimilarity } from "@/lib/utils";

/**
 * Auto-generate internal links for a published article by connecting it to the
 * exam graph (Job → Exam → Syllabus → Result → Admit Card → Answer Key) and to
 * topically similar recent articles.
 */
export async function buildInternalLinks(article: Article): Promise<number> {
  let created = 0;

  // 1. Link to articles sharing the same exam (via typed record → examId).
  const examId = await resolveExamId(article);
  if (examId) {
    const siblings = await prisma.article.findMany({
      where: {
        id: { not: article.id },
        status: "PUBLISHED",
        OR: [
          { job: { examId } },
          { admitCard: { examId } },
          { result: { examId } },
          { answerKey: { examId } },
        ],
      },
      select: { id: true, category: true },
      take: 12,
    });
    for (const s of siblings) {
      created += await link(article.id, s.id, `exam:${s.category}`);
      created += await link(s.id, article.id, `exam:${article.category}`);
    }
  }

  // 2. Link to topically similar recent articles (title similarity).
  const recent = await prisma.article.findMany({
    where: { id: { not: article.id }, status: "PUBLISHED" },
    select: { id: true, title: true },
    orderBy: { publishedAt: "desc" },
    take: 100,
  });
  for (const r of recent) {
    if (titleSimilarity(article.title, r.title) >= 0.55) {
      created += await link(article.id, r.id, "related");
    }
  }

  return created;
}

async function resolveExamId(article: Article): Promise<string | null> {
  if (article.jobId) return (await prisma.job.findUnique({ where: { id: article.jobId }, select: { examId: true } }))?.examId ?? null;
  if (article.admitCardId) return (await prisma.admitCard.findUnique({ where: { id: article.admitCardId }, select: { examId: true } }))?.examId ?? null;
  if (article.resultId) return (await prisma.result.findUnique({ where: { id: article.resultId }, select: { examId: true } }))?.examId ?? null;
  if (article.answerKeyId) return (await prisma.answerKey.findUnique({ where: { id: article.answerKeyId }, select: { examId: true } }))?.examId ?? null;
  return null;
}

async function link(fromId: string, toId: string, relation: string): Promise<number> {
  if (fromId === toId) return 0;
  try {
    await prisma.relatedContent.upsert({
      where: { fromId_toId_relation: { fromId, toId, relation } },
      create: { fromId, toId, relation },
      update: {},
    });
    return 1;
  } catch {
    return 0;
  }
}
