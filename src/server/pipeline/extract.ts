import { ContentCategory } from "@prisma/client";

/**
 * Deterministic, rule-based field extraction from source text.
 * These are best-effort heuristics over official text; missing fields are left
 * null so the UI can render "Not Available in Official Source" rather than guess.
 * AI is NEVER used to invent factual fields — only to format verified data.
 */

export type ExtractedJob = {
  organization?: string;
  postName?: string;
  vacancyCount?: number;
  qualification?: string;
  ageLimit?: string;
  applicationStart?: Date;
  applicationEnd?: Date;
  applicationFee?: string;
  examDate?: Date;
  importantDates?: { label: string; date: string }[];
  officialNotificationUrl?: string;
  applyOnlineUrl?: string;
};

const MONTHS =
  "(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)";

function parseDateNear(text: string, labelRegex: RegExp): Date | undefined {
  const idx = text.search(labelRegex);
  if (idx === -1) return undefined;
  const window = text.slice(idx, idx + 120);
  return extractFirstDate(window);
}

export function extractFirstDate(text: string): Date | undefined {
  // dd/mm/yyyy or dd-mm-yyyy
  const numeric = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (numeric) {
    const [, d, m, y] = numeric;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const date = new Date(year, Number(m) - 1, Number(d));
    if (!isNaN(date.getTime())) return date;
  }
  // 12 March 2026 / March 12, 2026
  const named = new RegExp(`\\b(\\d{1,2})\\s+${MONTHS}\\.?\\s+(\\d{4})\\b`, "i").exec(text);
  if (named) {
    const date = new Date(`${named[1]} ${named[2]} ${named[3]}`);
    if (!isNaN(date.getTime())) return date;
  }
  const named2 = new RegExp(`\\b${MONTHS}\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, "i").exec(text);
  if (named2) {
    const date = new Date(`${named2[1]} ${named2[2]} ${named2[3]}`);
    if (!isNaN(date.getTime())) return date;
  }
  return undefined;
}

function extractVacancy(text: string): number | undefined {
  const m =
    text.match(/(\d[\d,]{1,7})\s*(?:vacanc|posts?|seats?)/i) ||
    text.match(/(?:total\s*(?:vacanc\w*|posts?)[:\s]*)(\d[\d,]{1,7})/i) ||
    text.match(/(?:vacanc\w*|posts?)[:\s]*(\d[\d,]{1,7})/i);
  if (m) {
    const n = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0 && n < 10_000_000) return n;
  }
  return undefined;
}

function extractFee(text: string): string | undefined {
  const m = text.match(/(?:fee|शुल्क)[:\s].{0,80}?(?:₹|rs\.?|inr)\s*\d[\d,]*/i);
  if (m) return m[0].replace(/\s+/g, " ").trim().slice(0, 200);
  const m2 = text.match(/(?:₹|rs\.?|inr)\s*\d[\d,]*\/-?/i);
  return m2 ? m2[0] : undefined;
}

function extractQualification(text: string): string | undefined {
  const m = text.match(
    /(?:qualification|eligibility|educational)[:\s].{0,180}?(?:\.|$)/i
  );
  if (m) return m[0].replace(/\s+/g, " ").trim().slice(0, 240);
  const deg = text.match(/\b(10th|12th|graduation|graduate|bachelor|master|diploma|b\.?tech|b\.?e\.?|b\.?sc|m\.?sc|iti|degree)\b/i);
  return deg ? `Requires ${deg[0]} (see official notification)` : undefined;
}

function extractAge(text: string): string | undefined {
  const m = text.match(/age\s*(?:limit)?[:\s].{0,80}?\d{1,2}\s*(?:to|-|–)\s*\d{1,2}\s*(?:years|yrs)?/i);
  if (m) return m[0].replace(/\s+/g, " ").trim().slice(0, 160);
  const m2 = text.match(/\d{1,2}\s*(?:to|-|–)\s*\d{1,2}\s*years/i);
  return m2 ? m2[0] : undefined;
}

function extractUrls(text: string): { notification?: string; apply?: string } {
  const urls = text.match(/https?:\/\/[^\s"'<>)]+/gi) ?? [];
  let notification: string | undefined;
  let apply: string | undefined;
  for (const u of urls) {
    if (/\.pdf/i.test(u) && !notification) notification = u;
    if (/apply|registration|online-?form|onlineform|recruit/i.test(u) && !apply) apply = u;
  }
  return { notification, apply };
}

export function extractJob(text: string, title?: string): ExtractedJob {
  const t = text || "";
  const urls = extractUrls(t);
  const importantDates: { label: string; date: string }[] = [];
  const start = parseDateNear(t, /(application|registration|apply|online form).{0,30}(start|begin|opening|from)/i);
  const end = parseDateNear(t, /(last date|closing|end date|apply before|last day)/i);
  const exam = parseDateNear(t, /(exam date|examination.{0,10}date|written (exam|test))/i);
  if (start) importantDates.push({ label: "Application Start", date: start.toISOString() });
  if (end) importantDates.push({ label: "Last Date to Apply", date: end.toISOString() });
  if (exam) importantDates.push({ label: "Exam Date", date: exam.toISOString() });

  return {
    postName: title,
    vacancyCount: extractVacancy(t),
    qualification: extractQualification(t),
    ageLimit: extractAge(t),
    applicationStart: start,
    applicationEnd: end,
    applicationFee: extractFee(t),
    examDate: exam,
    importantDates: importantDates.length ? importantDates : undefined,
    officialNotificationUrl: urls.notification,
    applyOnlineUrl: urls.apply,
  };
}

export type ExtractedAdmitCard = {
  examName?: string;
  releaseDate?: Date;
  examDate?: Date;
  examShift?: string;
  downloadUrl?: string;
};

export function extractAdmitCard(text: string, title?: string): ExtractedAdmitCard {
  const t = text || "";
  const urls = extractUrls(t);
  return {
    examName: title,
    releaseDate: parseDateNear(t, /(admit card|hall ticket|call letter).{0,30}(released|available|download|out)/i) ?? extractFirstDate(t),
    examDate: parseDateNear(t, /(exam date|examination.{0,10}date)/i),
    examShift: t.match(/shift[:\s].{0,40}/i)?.[0]?.trim(),
    downloadUrl: urls.apply ?? urls.notification,
  };
}

export type ExtractedResult = {
  examName?: string;
  releaseDate?: Date;
  resultType?: string;
  resultUrl?: string;
};

export function extractResult(text: string, title?: string): ExtractedResult {
  const t = text || "";
  const urls = extractUrls(t);
  return {
    examName: title,
    releaseDate: parseDateNear(t, /(result).{0,30}(declared|released|out|available)/i) ?? extractFirstDate(t),
    resultType: t.match(/\b(final|provisional|tier[- ]?\d|prelims?|mains?)\b/i)?.[0],
    resultUrl: urls.apply ?? urls.notification,
  };
}

export type ExtractedAnswerKey = {
  examName?: string;
  examDate?: Date;
  keyType?: string;
  isFinal?: boolean;
  objectionStart?: Date;
  objectionEnd?: Date;
  answerKeyUrl?: string;
};

export function extractAnswerKey(text: string, title?: string): ExtractedAnswerKey {
  const t = text || "";
  const urls = extractUrls(t);
  const isFinal = /\bfinal\b/i.test(t) && !/provisional/i.test(t);
  return {
    examName: title,
    examDate: parseDateNear(t, /(exam date|held on|examination date)/i),
    keyType: isFinal ? "Final" : /provisional/i.test(t) ? "Provisional" : undefined,
    isFinal,
    objectionStart: parseDateNear(t, /(objection|challenge).{0,30}(start|from|between)/i),
    objectionEnd: parseDateNear(t, /(objection|challenge).{0,30}(last|end|till|until|up to)/i),
    answerKeyUrl: urls.notification ?? urls.apply,
  };
}

/** Dispatch extraction based on classified category. Returns a plain object. */
export function extractFor(category: ContentCategory, text: string, title?: string): Record<string, unknown> {
  switch (category) {
    case ContentCategory.JOB:
      return extractJob(text, title) as Record<string, unknown>;
    case ContentCategory.ADMIT_CARD:
      return extractAdmitCard(text, title) as Record<string, unknown>;
    case ContentCategory.RESULT:
      return extractResult(text, title) as Record<string, unknown>;
    case ContentCategory.ANSWER_KEY:
      return extractAnswerKey(text, title) as Record<string, unknown>;
    default:
      return {};
  }
}
