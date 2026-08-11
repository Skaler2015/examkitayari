import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { enqueue } from "@/server/queue";
import { runJob } from "@/server/queue/runner";
import { claimNextJob, completeJob } from "@/server/queue";
import { isAutomationEnabled } from "@/server/automation/settings";
import { SourceStatus } from "@prisma/client";

export const dynamic = "force-dynamic";
// Allow headroom for scraping-proxy requests that render JavaScript (slow).
// 300s is the Vercel Pro function limit; harmless on other hosts.
export const maxDuration = 300;

/**
 * Serverless-friendly cron endpoint. Call this on a schedule (e.g. Vercel Cron,
 * GitHub Actions, or `curl`) when you can't run the long-lived worker process.
 * It (1) enqueues due source crawls and (2) drains a bounded number of jobs.
 * Protected by the AUTH_SECRET bearer token.
 */
async function authorize(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  // Accept either the app AUTH_SECRET or a dedicated CRON_SECRET (which Vercel
  // Cron sends automatically as a Bearer token when configured).
  const accepted = [env.authSecret, process.env.CRON_SECRET].filter(Boolean) as string[];
  return accepted.includes(token);
}

async function runTick(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const enabled = env.automation.enabled && (await isAutomationEnabled());
  let enqueued = 0;
  if (enabled) {
    const now = new Date();
    const due = await prisma.source.findMany({
      where: {
        isActive: true,
        status: { notIn: [SourceStatus.DISABLED, SourceStatus.BLOCKED] },
        OR: [{ nextCrawlAt: null }, { nextCrawlAt: { lte: now } }],
      },
      orderBy: [{ priority: "asc" }, { nextCrawlAt: "asc" }],
      take: 25,
    });
    for (const s of due) {
      await enqueue("CRAWL_SOURCE", { sourceId: s.id }, { dedupeKey: `crawl:${s.id}` });
      await prisma.source.update({
        where: { id: s.id },
        data: { nextCrawlAt: new Date(now.getTime() + s.frequencyMinutes * 60 * 1000) },
      });
      enqueued++;
    }
  }

  // Drain jobs within the request budget (kept under maxDuration).
  let processed = 0;
  const budgetMs = 250000;
  const started = Date.now();
  while (processed < 30 && Date.now() - started < budgetMs) {
    const job = await claimNextJob();
    if (!job) break;
    try {
      await runJob(job);
      await completeJob(job.id, true);
    } catch (err) {
      await completeJob(job.id, false, err instanceof Error ? err.message : String(err));
    }
    processed++;
  }

  return NextResponse.json({ ok: true, enabled, enqueued, processed });
}

// Vercel Cron issues GET requests; external cron / manual triggers may use POST.
export async function GET(req: NextRequest) {
  return runTick(req);
}

export async function POST(req: NextRequest) {
  return runTick(req);
}
