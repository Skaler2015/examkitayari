import { ContentCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type EffectiveSettings = {
  sourceMonitoring: boolean;
  aiProcessing: boolean;
  autoClassification: boolean;
  autoDraft: boolean;
  autoPublish: boolean;
  autoSeo: boolean;
  autoSitemap: boolean;
  notifications: boolean;
};

const DEFAULTS: EffectiveSettings = {
  sourceMonitoring: true,
  aiProcessing: true,
  autoClassification: true,
  autoDraft: true,
  autoPublish: false, // safety: default to manual review
  autoSeo: true,
  autoSitemap: true,
  notifications: true,
};

// Categories that must default to MANUAL REVIEW (never auto-publish).
const MANUAL_REVIEW_CATEGORIES = new Set<ContentCategory>([
  ContentCategory.JOB,
  ContentCategory.ADMIT_CARD,
  ContentCategory.RESULT,
  ContentCategory.ANSWER_KEY,
  ContentCategory.NOTICE,
]);

/**
 * Resolve effective automation settings for a category: category-specific row
 * overrides the GLOBAL row, which overrides hardcoded safe defaults.
 */
export async function getEffectiveSettings(category?: ContentCategory): Promise<EffectiveSettings> {
  const [global, specific] = await Promise.all([
    prisma.automationSetting.findUnique({ where: { scope: "GLOBAL" } }),
    category ? prisma.automationSetting.findUnique({ where: { scope: category } }) : Promise.resolve(null),
  ]);

  const merged: EffectiveSettings = { ...DEFAULTS };
  const apply = (row: typeof global) => {
    if (!row) return;
    merged.sourceMonitoring = row.sourceMonitoring;
    merged.aiProcessing = row.aiProcessing;
    merged.autoClassification = row.autoClassification;
    merged.autoDraft = row.autoDraft;
    merged.autoPublish = row.autoPublish;
    merged.autoSeo = row.autoSeo;
    merged.autoSitemap = row.autoSitemap;
    merged.notifications = row.notifications;
  };
  apply(global);
  apply(specific);

  // Enforce manual review for high-risk categories regardless of config,
  // unless an explicit category-specific override enabled autoPublish.
  if (category && MANUAL_REVIEW_CATEGORIES.has(category) && !specific?.autoPublish) {
    merged.autoPublish = false;
  }

  return merged;
}

export async function isAutomationEnabled(): Promise<boolean> {
  const global = await prisma.automationSetting.findUnique({ where: { scope: "GLOBAL" } });
  return global ? global.sourceMonitoring : DEFAULTS.sourceMonitoring;
}
