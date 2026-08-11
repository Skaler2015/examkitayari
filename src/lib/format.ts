import { ContentCategory, VerificationStatus } from "@prisma/client";

export const CATEGORY_META: Record<
  ContentCategory,
  { label: string; path: string; badge: "default" | "success" | "warning" | "danger" | "accent" | "secondary" }
> = {
  JOB: { label: "Job", path: "jobs", badge: "default" },
  ADMIT_CARD: { label: "Admit Card", path: "admit-card", badge: "accent" },
  RESULT: { label: "Result", path: "results", badge: "success" },
  ANSWER_KEY: { label: "Answer Key", path: "answer-key", badge: "warning" },
  EXAM_DATE: { label: "Exam Date", path: "exam-dates", badge: "secondary" },
  CUTOFF: { label: "Cut Off", path: "cutoffs", badge: "secondary" },
  MERIT_LIST: { label: "Merit List", path: "merit-list", badge: "secondary" },
  NOTICE: { label: "Notice", path: "notices", badge: "secondary" },
  SYLLABUS: { label: "Syllabus", path: "syllabus", badge: "secondary" },
  EXAM_PATTERN: { label: "Exam Pattern", path: "exam-pattern", badge: "secondary" },
  COUNSELLING: { label: "Counselling", path: "counselling", badge: "secondary" },
  DOCUMENT_VERIFICATION: { label: "Doc Verification", path: "document-verification", badge: "secondary" },
  CURRENT_AFFAIRS: { label: "Current Affairs", path: "current-affairs", badge: "secondary" },
  OTHER: { label: "Update", path: "updates", badge: "secondary" },
};

export function categoryPath(category: ContentCategory, slug: string): string {
  return `/${CATEGORY_META[category].path}/${slug}`;
}

export const VERIFICATION_META: Record<
  VerificationStatus,
  { label: string; badge: "default" | "success" | "warning" | "danger" | "secondary" }
> = {
  UNVERIFIED: { label: "Unverified", badge: "secondary" },
  AUTO_EXTRACTED: { label: "Auto-extracted", badge: "warning" },
  AI_ASSISTED: { label: "AI-assisted draft", badge: "warning" },
  AI_VERIFIED: { label: "AI verified", badge: "success" },
  HUMAN_VERIFIED: { label: "Human verified", badge: "success" },
  SOURCE_CONFLICT: { label: "Source conflict", badge: "danger" },
  NOT_AVAILABLE: { label: "Not available", badge: "secondary" },
};

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "Not Available in Official Source";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function timeAgo(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}
