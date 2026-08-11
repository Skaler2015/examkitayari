import type { Source } from "@prisma/client";

/** Convert a simple glob-ish pattern (with * wildcards) to a RegExp. */
function toRegex(pattern: string): RegExp {
  const escaped = pattern
    .trim()
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(escaped, "i");
}

/**
 * Decide whether a discovered URL/title should be kept, based on the source's
 * allowed/excluded URL patterns and keyword list.
 */
export function matchesRules(url: string, title: string, source: Source): boolean {
  const { allowedUrlPatterns, excludedUrlPatterns, keywords } = source;

  // Exclusions take precedence.
  for (const pat of excludedUrlPatterns ?? []) {
    if (pat && toRegex(pat).test(url)) return false;
  }

  // If allowed patterns are configured, the URL must match at least one.
  if (allowedUrlPatterns && allowedUrlPatterns.length > 0) {
    const allowed = allowedUrlPatterns.some((p) => p && toRegex(p).test(url));
    if (!allowed) return false;
  }

  // If keywords are configured, title or URL should contain at least one.
  if (keywords && keywords.length > 0) {
    const hay = `${title} ${url}`.toLowerCase();
    const hit = keywords.some((k) => k && hay.includes(k.toLowerCase()));
    if (!hit) return false;
  }

  return true;
}

export function isLikelyPdf(url: string): boolean {
  return /\.pdf(\?|#|$)/i.test(url);
}
