"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/rbac";
import { writeAudit } from "./audit";

const FLAGS = [
  "sourceMonitoring",
  "aiProcessing",
  "autoClassification",
  "autoDraft",
  "autoPublish",
  "autoSeo",
  "autoSitemap",
  "notifications",
] as const;

/** Persist automation switches for a scope ("GLOBAL" or a ContentCategory). */
export async function saveAutomationSettings(scope: string, formData: FormData) {
  await requirePermission("automation:manage");
  const data: Record<string, boolean> = {};
  for (const flag of FLAGS) {
    data[flag] = formData.get(flag) === "on" || formData.get(flag) === "true";
  }
  await prisma.automationSetting.upsert({
    where: { scope },
    create: { scope, ...data },
    update: data,
  });
  await writeAudit("automation.update", "AutomationSetting", scope, data);
  revalidatePath("/admin/automation");
}
