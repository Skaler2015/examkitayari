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
  revalidatePath(`/admin/review/${parsed.data.articleId}`);
  return { ok: true };
}
