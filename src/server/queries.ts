import { ContentCategory, PublishStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Published articles for a category listing (paginated). */
export async function getPublishedByCategory(category: ContentCategory, page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    prisma.article.findMany({
      where: { category, status: PublishStatus.PUBLISHED },
      orderBy: { publishedAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.article.count({ where: { category, status: PublishStatus.PUBLISHED } }),
  ]);
  return { items, total, page, pageSize, pages: Math.ceil(total / pageSize) };
}

/** Latest published across all categories. */
export async function getLatestPublished(limit = 12) {
  return prisma.article.findMany({
    where: { status: PublishStatus.PUBLISHED },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });
}

export async function getLatestByCategory(category: ContentCategory, limit = 8) {
  return prisma.article.findMany({
    where: { category, status: PublishStatus.PUBLISHED },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });
}

export async function getArticleBySlug(slug: string) {
  return prisma.article.findUnique({
    where: { slug },
    include: {
      job: { include: { exam: true, organization: true } },
      admitCard: { include: { exam: true } },
      result: { include: { exam: true } },
      answerKey: { include: { exam: true } },
      notice: true,
      articleSources: true,
      seo: true,
      relatedFrom: { include: { to: true }, take: 8 },
    },
  });
}

export async function getRelatedArticles(articleId: string, limit = 6) {
  const rels = await prisma.relatedContent.findMany({
    where: { fromId: articleId, to: { status: PublishStatus.PUBLISHED } },
    include: { to: true },
    orderBy: { weight: "desc" },
    take: limit,
  });
  return rels.map((r) => r.to);
}

export async function getExams(page = 1, pageSize = 24, state?: string) {
  const skip = (page - 1) * pageSize;
  const where = state ? { state } : {};
  const [items, total] = await Promise.all([
    prisma.exam.findMany({ where, orderBy: { name: "asc" }, skip, take: pageSize }),
    prisma.exam.count({ where }),
  ]);
  return { items, total, page, pages: Math.ceil(total / pageSize) };
}

export async function getExamBySlug(slug: string) {
  return prisma.exam.findUnique({
    where: { slug },
    include: {
      organization: true,
      jobs: { where: { article: { status: "PUBLISHED" } }, include: { article: true }, take: 10, orderBy: { createdAt: "desc" } },
      admitCards: { include: { article: true }, take: 10, orderBy: { createdAt: "desc" } },
      results: { include: { article: true }, take: 10, orderBy: { createdAt: "desc" } },
      answerKeys: { include: { article: true }, take: 10, orderBy: { createdAt: "desc" } },
      mockTests: { where: { isPublished: true }, take: 10 },
    },
  });
}

/** Global full-text-ish search using PostgreSQL. */
export async function search(q: string, category?: ContentCategory, limit = 30) {
  const term = q.trim();
  if (!term) return [];
  return prisma.article.findMany({
    where: {
      status: PublishStatus.PUBLISHED,
      ...(category ? { category } : {}),
      OR: [
        { title: { contains: term, mode: "insensitive" } },
        { shortSummary: { contains: term, mode: "insensitive" } },
        { officialSource: { contains: term, mode: "insensitive" } },
      ],
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });
}

// --- Admin dashboard aggregates ----------------------------------------

export async function getDashboardStats() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    newToday,
    pendingReview,
    publishedToday,
    failedCrawls,
    sourceErrors,
    newJobs,
    newAdmitCards,
    newResults,
    newAnswerKeys,
  ] = await Promise.all([
    prisma.sourceItem.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.article.count({ where: { status: PublishStatus.PENDING_REVIEW } }),
    prisma.article.count({ where: { status: PublishStatus.PUBLISHED, publishedAt: { gte: startOfDay } } }),
    prisma.sourceCrawl.count({ where: { status: "FAILED", startedAt: { gte: startOfDay } } }),
    prisma.source.count({ where: { status: { in: ["ERROR", "WARNING", "BLOCKED"] } } }),
    prisma.job.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.admitCard.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.result.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.answerKey.count({ where: { createdAt: { gte: startOfDay } } }),
  ]);

  return { newToday, pendingReview, publishedToday, failedCrawls, sourceErrors, newJobs, newAdmitCards, newResults, newAnswerKeys };
}

/** Daily discovery counts for the last N days (for charts). */
export async function getDailyDiscovery(days = 14) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const items = await prisma.sourceItem.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true, category: true },
  });
  const buckets = new Map<string, number>();
  for (const it of items) {
    const key = it.createdAt.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}
