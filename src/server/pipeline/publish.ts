import { PublishStatus, ProcessingStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { buildInternalLinks } from "./linking";
import { notifyForArticle } from "@/server/notifications";
import { getEffectiveSettings } from "@/server/automation/settings";
import { articleJsonLd, faqJsonLd } from "@/server/seo/schema";
import { isIndexNowEnabled, submitToIndexNow } from "@/server/seo/indexnow";
import { truncate } from "@/lib/utils";

const log = logger.child("publish");

const CATEGORY_PATH: Record<string, string> = {
  JOB: "jobs",
  ADMIT_CARD: "admit-card",
  RESULT: "results",
  ANSWER_KEY: "answer-key",
  NOTICE: "notices",
};

export function articlePath(category: string, slug: string): string {
  return `/${CATEGORY_PATH[category] ?? "updates"}/${slug}`;
}

/**
 * Publish an article: set status, snapshot a version, generate SEO metadata,
 * build internal links, and dispatch notifications. Idempotent-ish: safe to
 * call again to refresh SEO/links.
 */
export async function publishArticle(articleId: string, reviewerId?: string): Promise<void> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { seo: true },
  });
  if (!article) throw new Error("Article not found");

  const settings = await getEffectiveSettings(article.category);
  const path = articlePath(article.category, article.slug);

  await prisma.article.update({
    where: { id: articleId },
    data: {
      status: PublishStatus.PUBLISHED,
      publishedAt: article.publishedAt ?? new Date(),
      lastVerifiedAt: reviewerId ? new Date() : article.lastVerifiedAt,
    },
  });

  // Move the source item to PUBLISHED.
  if (article.sourceItemId) {
    await prisma.sourceItem.update({
      where: { id: article.sourceItemId },
      data: { stage: ProcessingStage.PUBLISHED },
    });
  }

  // Version snapshot.
  const lastVersion = await prisma.articleVersion.findFirst({
    where: { articleId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  await prisma.articleVersion.create({
    data: {
      articleId,
      version: (lastVersion?.version ?? 0) + 1,
      title: article.title,
      body: article.body,
      editedById: reviewerId,
      snapshot: JSON.parse(JSON.stringify(article)),
    },
  });

  // SEO metadata.
  if (settings.autoSeo) {
    const faq = (article.faq as { q: string; a: string }[] | null) ?? [];
    const jsonLd = [
      articleJsonLd({
        title: article.title,
        description: article.shortSummary,
        path,
        publishedAt: article.publishedAt ?? new Date(),
        updatedAt: article.updatedAt,
        sourceUrl: article.officialSourceUrl,
      }),
      faqJsonLd(faq),
    ].filter(Boolean);

    const ogImage = `${env.siteUrl.replace(/\/$/, "")}/api/og?title=${encodeURIComponent(
      truncate(article.title, 120)
    )}&category=${article.category}`;

    const seoData = {
      title: truncate(article.title, 65),
      description: article.shortSummary ?? truncate(article.title, 160),
      canonical: `${env.siteUrl}${path}`,
      ogTitle: article.title,
      ogDescription: article.shortSummary,
      ogImage,
      jsonLd,
    };
    await prisma.seoMetadata.upsert({
      where: { path },
      create: { articleId, path, ...seoData },
      update: seoData,
    });
  }

  // Internal linking.
  const fresh = await prisma.article.findUnique({ where: { id: articleId } });
  if (fresh) {
    await buildInternalLinks(fresh);
    if (settings.notifications) {
      await notifyForArticle(fresh);
    }
  }

  // Instant indexing (IndexNow) — best-effort, non-blocking.
  if (isIndexNowEnabled()) {
    void submitToIndexNow([`${env.siteUrl.replace(/\/$/, "")}${path}`]).catch(() => {});
  }

  log.info("Published article", { slug: article.slug, category: article.category });
}

/** Publish any SCHEDULED articles whose time has arrived. Returns the count. */
export async function publishDueScheduled(): Promise<number> {
  const due = await prisma.article.findMany({
    where: { status: PublishStatus.SCHEDULED, scheduledFor: { lte: new Date() } },
    select: { id: true },
    take: 50,
  });
  let n = 0;
  for (const a of due) {
    try {
      await publishArticle(a.id);
      n++;
    } catch (err) {
      log.error("Scheduled publish failed", { id: a.id, err: String(err) });
    }
  }
  if (n) log.info("Published scheduled articles", { count: n });
  return n;
}
