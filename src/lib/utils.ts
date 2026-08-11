import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

/** Ensure slug uniqueness by appending a short suffix when needed. */
export function uniqueSlug(base: string, exists: (s: string) => Promise<boolean>) {
  return (async () => {
    const root = slugify(base) || "item";
    let candidate = root;
    let i = 1;
    // eslint-disable-next-line no-await-in-loop
    while (await exists(candidate)) {
      candidate = `${root}-${i++}`;
    }
    return candidate;
  })();
}

/** Normalise a URL for comparison/dedup (strip fragments, tracking params). */
export function normalizeUrl(raw: string, base?: string): string | null {
  try {
    const u = new URL(raw, base);
    u.hash = "";
    const drop = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"];
    drop.forEach((p) => u.searchParams.delete(p));
    // Trailing slash normalisation (keep root slash)
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.replace(/\/+$/, "");
    }
    return u.toString();
  } catch {
    return null;
  }
}

/** Levenshtein-based title similarity (0..1). Good enough for dedup heuristics. */
export function titleSimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase().replace(/\s+/g, " ").trim();
  const s2 = b.toLowerCase().replace(/\s+/g, " ").trim();
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  const dist = levenshtein(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      prev = tmp;
    }
  }
  return dp[n];
}

export function truncate(text: string, len = 160): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= len ? t : t.slice(0, len - 1).trimEnd() + "…";
}

export function absoluteUrl(path: string, siteUrl: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${siteUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
