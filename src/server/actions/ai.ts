"use server";

import { requirePermission } from "@/lib/auth/rbac";
import { aiStatus, pingAi } from "@/server/ai/provider";
import { writeAudit } from "./audit";

export type AiTestResult = {
  status: ReturnType<typeof aiStatus>;
  ping: Awaited<ReturnType<typeof pingAi>>;
};

/** Report AI config and run a live health check (staff only). */
export async function testAiConnection(): Promise<AiTestResult> {
  await requirePermission("automation:manage");
  const status = aiStatus();
  const ping = await pingAi();
  await writeAudit("ai.test", "AI", status.provider, { ok: ping.ok, error: ping.error });
  return { status, ping };
}
