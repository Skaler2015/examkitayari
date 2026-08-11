import { ContentCategory } from "@prisma/client";

/**
 * Category-specific required fields. Publishing gate: an item is only
 * auto-publishable when its required fields are present (non-empty).
 */
const REQUIRED_FIELDS: Partial<Record<ContentCategory, string[]>> = {
  JOB: ["postName", "officialNotificationUrl"],
  ADMIT_CARD: ["examName", "downloadUrl"],
  RESULT: ["examName", "resultUrl"],
  ANSWER_KEY: ["examName", "answerKeyUrl"],
};

export type RequiredCheck = { ok: boolean; missing: string[] };

export function validateRequired(category: ContentCategory, data: Record<string, unknown>): RequiredCheck {
  const required = REQUIRED_FIELDS[category] ?? [];
  const missing = required.filter((f) => {
    const v = data[f];
    return v == null || v === "";
  });
  return { ok: missing.length === 0, missing };
}

function hasAnyUrl(data: Record<string, unknown>): boolean {
  return Object.entries(data).some(
    ([k, v]) => /url$/i.test(k) && typeof v === "string" && /^https?:\/\//.test(v)
  );
}

function datesLookValid(data: Record<string, unknown>): boolean {
  const dateVals = Object.entries(data)
    .filter(([k]) => /date|start|end|objection/i.test(k))
    .map(([, v]) => v)
    .filter((v): v is string | Date => v instanceof Date || (typeof v === "string" && /\d{4}-\d{2}-\d{2}T/.test(v)));
  if (dateVals.length === 0) return true; // no dates to validate
  const now = Date.now();
  const tenYears = 1000 * 60 * 60 * 24 * 365 * 10;
  return dateVals.every((v) => {
    const t = new Date(v as string).getTime();
    // Reject obviously wrong dates (>10y in the past or future).
    return !isNaN(t) && t > now - tenYears && t < now + tenYears;
  });
}

export type QualityBreakdown = {
  sourceReliability: number; // /25
  extractionAccuracy: number; // /25
  requiredFields: number; // /20
  duplicateSafety: number; // /10
  dateValidation: number; // /10
  urlValidation: number; // /5
  contentQuality: number; // /5
};

export type QualityResult = {
  score: number; // 0..100
  breakdown: QualityBreakdown;
  requiredOk: boolean;
  missing: string[];
  reasons: string[];
};

/**
 * Compute a 0..100 quality score used by the auto-publish decision. Pure and
 * deterministic — no AI required.
 */
export function computeQualityScore(input: {
  category: ContentCategory;
  data: Record<string, unknown>;
  sourceReliability: number; // 0..100
  categoryConfidence: number; // 0..1
  isDuplicate: boolean;
  aiValidationConfidence?: number | null; // 0..1 (null = not run)
  hasConflict?: boolean;
  textLength?: number;
}): QualityResult {
  const reasons: string[] = [];
  const req = validateRequired(input.category, input.data);

  const sourceReliability = Math.round((Math.min(100, Math.max(0, input.sourceReliability)) / 100) * 25);

  // Extraction accuracy blends classifier confidence and (if present) AI validation.
  const extractionBase = input.aiValidationConfidence != null
    ? (input.categoryConfidence + input.aiValidationConfidence) / 2
    : input.categoryConfidence;
  const extractionAccuracy = Math.round(Math.min(1, extractionBase) * 25);

  const requiredFields = req.ok ? 20 : Math.max(0, 20 - req.missing.length * 10);
  if (!req.ok) reasons.push(`Missing required fields: ${req.missing.join(", ")}`);

  const duplicateSafety = input.isDuplicate ? 0 : 10;
  if (input.isDuplicate) reasons.push("Possible duplicate");

  const dateValidation = datesLookValid(input.data) ? 10 : 0;
  if (dateValidation === 0) reasons.push("Suspicious dates");

  const urlValidation = hasAnyUrl(input.data) ? 5 : 0;
  if (urlValidation === 0) reasons.push("No official URL extracted");

  const textLen = input.textLength ?? 0;
  const contentQuality = textLen > 600 ? 5 : textLen > 200 ? 3 : 1;

  if (input.hasConflict) reasons.push("Source conflict detected");

  const breakdown: QualityBreakdown = {
    sourceReliability,
    extractionAccuracy,
    requiredFields,
    duplicateSafety,
    dateValidation,
    urlValidation,
    contentQuality,
  };
  let score = Object.values(breakdown).reduce((a, b) => a + b, 0);
  if (input.hasConflict) score = Math.min(score, 60); // conflicts never auto-publish

  return { score, breakdown, requiredOk: req.ok, missing: req.missing, reasons };
}
