import { NotificationChannel, NotificationStatus } from "@prisma/client";
import type { Article } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";

const log = logger.child("notify");

/**
 * When a published article relates to an exam users follow, queue web
 * notifications for those users. Email/push delivery is best-effort and only
 * attempted when configured; otherwise the WEB notification remains for the
 * in-app bell.
 */
export async function notifyForArticle(article: Article): Promise<number> {
  const examId = await resolveExamId(article);
  if (!examId) return 0;

  const followers = await prisma.examFollow.findMany({
    where: { examId },
    select: { userId: true },
  });
  if (followers.length === 0) return 0;

  const url = `/${categoryPath(article.category)}/${article.slug}`;
  const data = followers.map((f) => ({
    userId: f.userId,
    channel: NotificationChannel.WEB,
    status: NotificationStatus.SENT,
    title: article.title,
    body: article.shortSummary ?? null,
    url,
  }));
  await prisma.notification.createMany({ data });

  // Fire email if SMTP configured (non-blocking best-effort).
  if (env.email.host) {
    void sendEmails(followers.map((f) => f.userId), article, url).catch((e) =>
      log.warn("Email notify failed", { err: String(e) })
    );
  }

  log.info("Queued notifications", { article: article.slug, count: data.length });
  return data.length;
}

async function sendEmails(_userIds: string[], _article: Article, _url: string): Promise<void> {
  // Placeholder for SMTP integration (nodemailer). Kept out of the hot path so
  // notifications never block publishing. Wire your transport here.
  log.debug("SMTP configured — email delivery would run here");
}

function categoryPath(category: string): string {
  const map: Record<string, string> = {
    JOB: "jobs",
    ADMIT_CARD: "admit-card",
    RESULT: "results",
    ANSWER_KEY: "answer-key",
    NOTICE: "notices",
  };
  return map[category] ?? "updates";
}

async function resolveExamId(article: Article): Promise<string | null> {
  if (article.jobId) return (await prisma.job.findUnique({ where: { id: article.jobId }, select: { examId: true } }))?.examId ?? null;
  if (article.admitCardId) return (await prisma.admitCard.findUnique({ where: { id: article.admitCardId }, select: { examId: true } }))?.examId ?? null;
  if (article.resultId) return (await prisma.result.findUnique({ where: { id: article.resultId }, select: { examId: true } }))?.examId ?? null;
  if (article.answerKeyId) return (await prisma.answerKey.findUnique({ where: { id: article.answerKeyId }, select: { examId: true } }))?.examId ?? null;
  return null;
}
