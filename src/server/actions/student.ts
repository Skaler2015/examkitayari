"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";

export async function followExam(examId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!examId) return;

  await prisma.examFollow.upsert({
    where: { userId_examId: { userId: user.id, examId } },
    create: { userId: user.id, examId },
    update: {},
  });

  revalidatePath("/dashboard/exams");
  revalidatePath("/dashboard");
}

export async function unfollowExam(examId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!examId) return;

  await prisma.examFollow.deleteMany({ where: { userId: user.id, examId } });

  revalidatePath("/dashboard/exams");
  revalidatePath("/dashboard");
}

export async function toggleBookmark(entityType: string, entityId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!entityType || !entityId) return;

  const existing = await prisma.bookmark.findUnique({
    where: { userId_entityType_entityId: { userId: user.id, entityType, entityId } },
  });

  if (existing) {
    await prisma.bookmark.delete({ where: { id: existing.id } });
  } else {
    await prisma.bookmark.create({
      data: {
        userId: user.id,
        entityType,
        entityId,
        articleId: entityType === "article" ? entityId : undefined,
      },
    });
  }

  revalidatePath("/dashboard/bookmarks");
  revalidatePath("/dashboard");
}

export async function markNotificationsRead(): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { status: "READ", readAt: new Date() },
  });

  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
}

export async function saveAttempt(args: {
  mockTestId?: string;
  score?: number;
  totalScore?: number;
}): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;

  await prisma.userAttempt.create({
    data: {
      userId: user.id,
      mockTestId: args.mockTestId,
      score: args.score,
      totalScore: args.totalScore,
    },
  });

  revalidatePath("/dashboard/history");
}
