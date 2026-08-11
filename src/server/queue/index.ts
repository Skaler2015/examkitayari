import { AutomationJobStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const log = logger.child("queue");

export type JobType = "CRAWL_SOURCE" | "PROCESS_ITEM" | "PUBLISH" | "SITEMAP" | "NOTIFY";

/**
 * Database-backed job queue (AutomationJob table). This keeps the platform
 * dependency-light: it works without Redis. A Redis/BullMQ driver can be
 * layered on later behind this same interface.
 */
export async function enqueue(type: JobType, payload: Record<string, unknown>, opts?: { scheduledAt?: Date; dedupeKey?: string }): Promise<string | null> {
  // Optional dedupe: skip if an identical queued job already exists.
  if (opts?.dedupeKey) {
    const existing = await prisma.automationJob.findFirst({
      where: { type, status: AutomationJobStatus.QUEUED, payload: { path: ["dedupeKey"], equals: opts.dedupeKey } },
      select: { id: true },
    });
    if (existing) return existing.id;
    payload.dedupeKey = opts.dedupeKey;
  }
  const job = await prisma.automationJob.create({
    data: { type, payload: payload as Prisma.InputJsonValue, scheduledAt: opts?.scheduledAt ?? new Date() },
  });
  return job.id;
}

/** Atomically claim the next due job (simple optimistic locking). */
export async function claimNextJob() {
  const candidate = await prisma.automationJob.findFirst({
    where: { status: AutomationJobStatus.QUEUED, scheduledAt: { lte: new Date() } },
    orderBy: { scheduledAt: "asc" },
  });
  if (!candidate) return null;

  // Try to claim it; if another worker grabbed it, updateMany count will be 0.
  const claimed = await prisma.automationJob.updateMany({
    where: { id: candidate.id, status: AutomationJobStatus.QUEUED },
    data: { status: AutomationJobStatus.RUNNING, startedAt: new Date(), attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return null;
  return prisma.automationJob.findUnique({ where: { id: candidate.id } });
}

export async function completeJob(id: string, ok: boolean, error?: string) {
  const job = await prisma.automationJob.findUnique({ where: { id } });
  if (!job) return;
  if (ok) {
    await prisma.automationJob.update({
      where: { id },
      data: { status: AutomationJobStatus.SUCCESS, finishedAt: new Date(), error: null },
    });
  } else if (job.attempts < job.maxAttempts) {
    // Requeue with backoff.
    const backoffMs = Math.min(2000 * 2 ** job.attempts, 5 * 60 * 1000);
    await prisma.automationJob.update({
      where: { id },
      data: { status: AutomationJobStatus.QUEUED, scheduledAt: new Date(Date.now() + backoffMs), error },
    });
    log.warn("Job requeued", { id, type: job.type, attempts: job.attempts, error });
  } else {
    await prisma.automationJob.update({
      where: { id },
      data: { status: AutomationJobStatus.FAILED, finishedAt: new Date(), error },
    });
    log.error("Job failed permanently", { id, type: job.type, error });
  }
}

export async function jobLog(jobId: string, level: "info" | "warn" | "error", message: string, meta?: Record<string, unknown>) {
  await prisma.automationLog.create({ data: { jobId, level, message, meta: meta as object } });
}
