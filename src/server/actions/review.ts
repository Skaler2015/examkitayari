"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/rbac";
import { getSessionUser } from "@/lib/auth/session";
import { PublishStatus, VerificationStatus, ProcessingStage } from "@prisma/client";
import { publishArticle } from "@/server/pipeline/publish";
import { writeAudit } from "./audit";

const editSchema = z.object({
  articleId: z.string(),
  title: z.string().min(3),
  shortSummary: z.string().optional(),
  body: z.string().optional(),
});

/** Approve & publish an article after human review. */
export async function approveAndPublish(articleId: string) {
  await requirePermission("articles:publish");
  const user = await getSessionUser();
  await prisma.article.update({
    where: { id: articleId },
    data: { verificationStatus: VerificationStatus.HUMAN_VERIFIED, lastVerifiedAt: new Date() },
  });
  await publishArticle(articleId, user?.id);
  await prisma.reviewAction.create({ data: { articleId, reviewerId: user?.id, action: "APPROVE" } });
  await writeAudit("review.approve", "Article", articleId);
  revalidatePath("/admin/review");
  revalidatePath("/admin");
}

export async function rejectArticle(articleId: string, note?: string) {
  await requirePermission("review:act");
  const user = await getSessionUser();
  const article = await prisma.article.findUnique({ where: { id: articleId } });
  await prisma.article.update({ where: { id: articleId }, data: { status: PublishStatus.REJECTED } });
  if (article?.sourceItemId) {
    await prisma.sourceItem.update({ where: { id: article.sourceItemId }, data: { stage: ProcessingStage.REJECTED } });
  }
  await prisma.reviewAction.create({ data: { articleId, reviewerId: user?.id, action: "REJECT", note } });
  await writeAudit("review.reject", "Article", articleId, { note });
  revalidatePath("/admin/review");
}

export async function markDuplicate(articleId: string) {
  await requirePermission("review:act");
  const user = await getSessionUser();
  const article = await prisma.article.findUnique({ where: { id: articleId } });
  await prisma.article.update({ where: { id: articleId }, data: { status: PublishStatus.ARCHIVED } });
  if (article?.sourceItemId) {
    await prisma.sourceItem.update({ where: { id: article.sourceItemId }, data: { stage: ProcessingStage.DUPLICATE } });
  }
  await prisma.reviewAction.create({ data: { articleId, reviewerId: user?.id, action: "MARK_DUPLICATE" } });
  await writeAudit("review.duplicate", "Article", articleId);
  revalidatePath("/admin/review");
}

/** Take a published article offline (back to DRAFT). Removes it from the public site. */
export async function unpublishArticle(articleId: string) {
  await requirePermission("articles:publish");
  const article = await prisma.article.findUnique({ where: { id: articleId } });
  if (!article) return;
  await prisma.article.update({ where: { id: articleId }, data: { status: PublishStatus.DRAFT } });
  await writeAudit("article.unpublish", "Article", articleId);
  revalidatePath("/admin/articles");
  revalidatePath(`/admin/articles/${articleId}`);
  revalidatePath("/");
  // Refresh the public category page it was on.
  revalidatePath(`/${categoryPathFor(article.category)}/${article.slug}`);
}

/** Permanently delete an article (and its versions/SEO/links via cascade). */
export async function deleteArticle(articleId: string) {
  await requirePermission("articles:publish");
  const article = await prisma.article.findUnique({ where: { id: articleId } });
  if (!article) return;
  await prisma.article.delete({ where: { id: articleId } });
  await writeAudit("article.delete", "Article", articleId, { title: article.title });
  revalidatePath("/admin/articles");
  revalidatePath("/");
  revalidatePath(`/${categoryPathFor(article.category)}/${article.slug}`);
}

/** Take ALL published articles offline (→ DRAFT). Clears the public site fast. */
export async function unpublishAllPublished() {
  await requirePermission("articles:publish");
  const res = await prisma.article.updateMany({
    where: { status: PublishStatus.PUBLISHED },
    data: { status: PublishStatus.DRAFT },
  });
  await writeAudit("article.bulk_unpublish", "Article", undefined, { count: res.count });
  revalidatePath("/admin/articles");
  revalidatePath("/");
  return res.count;
}

/**
 * Permanently delete every article matching a status filter (or ALL articles
 * when no valid status is given). Use with care — cascades versions/SEO/links.
 */
export async function deleteArticlesByStatus(status?: string) {
  await requirePermission("articles:publish");
  const valid = status && (Object.values(PublishStatus) as string[]).includes(status);
  const where = valid ? { status: status as PublishStatus } : {};
  const res = await prisma.article.deleteMany({ where });
  await writeAudit("article.bulk_delete", "Article", undefined, { status: valid ? status : "ALL", count: res.count });
  revalidatePath("/admin/articles");
  revalidatePath("/");
  return res.count;
}

function categoryPathFor(category: string): string {
  const map: Record<string, string> = {
    JOB: "jobs",
    ADMIT_CARD: "admit-card",
    RESULT: "results",
    ANSWER_KEY: "answer-key",
    NOTICE: "notices",
  };
  return map[category] ?? "updates";
}

export async function saveArticleEdits(_prev: { error?: string; ok?: boolean }, formData: FormData) {
  await requirePermission("articles:write");
  const parsed = editSchema.safeParse({
    articleId: formData.get("articleId"),
    title: formData.get("title"),
    shortSummary: formData.get("shortSummary") ?? "",
    body: formData.get("body") ?? "",
  });
  if (!parsed.success) return { error: "Invalid input." };
  const user = await getSessionUser();
  await prisma.article.update({
    where: { id: parsed.data.articleId },
    data: {
      title: parsed.data.title,
      shortSummary: parsed.data.shortSummary || null,
      body: parsed.data.body || null,
      verificationStatus: VerificationStatus.HUMAN_VERIFIED,
    },
  });
  await prisma.reviewAction.create({ data: { articleId: parsed.data.articleId, reviewerId: user?.id, action: "EDIT" } });
  await writeAudit("review.edit", "Article", parsed.data.articleId);

  // One-click "Save & Publish".
  const publishAfter = formData.get("publishAfter") === "on";
  if (publishAfter) {
    await prisma.article.update({
      where: { id: parsed.data.articleId },
      data: { verificationStatus: VerificationStatus.HUMAN_VERIFIED, lastVerifiedAt: new Date() },
    });
    await publishArticle(parsed.data.articleId, user?.id);
    await prisma.reviewAction.create({ data: { articleId: parsed.data.articleId, reviewerId: user?.id, action: "APPROVE" } });
    await writeAudit("review.approve", "Article", parsed.data.articleId);
    revalidatePath("/admin/review");
    revalidatePath("/admin/articles");
  }

  revalidatePath(`/admin/review/${parsed.data.articleId}`);
  revalidatePath(`/admin/articles/${parsed.data.articleId}`);
  return { ok: true };
}
