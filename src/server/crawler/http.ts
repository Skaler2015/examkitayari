import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { assertPublicUrl } from "@/lib/ssrf";

const log = logger.child("http");

// Per-host politeness state (last request time + parsed robots rules).
const hostLastRequest = new Map<string, number>();
const robotsCache = new Map<string, { rules: RobotRule[]; fetchedAt: number }>();
const ROBOTS_TTL_MS = 60 * 60 * 1000; // 1h

type RobotRule = { path: string; allow: boolean };

export type FetchResult = {
  ok: boolean;
  status: number;
  url: string;
  finalUrl: string;
  body: string;
  buffer?: Buffer;
  headers: Record<string, string>;
  responseMs: number;
  fromCache: boolean;
  error?: string;
};

export type ConditionalHeaders = {
  etag?: string | null;
  lastModified?: string | null;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function throttleHost(host: string) {
  const last = hostLastRequest.get(host) ?? 0;
  const elapsed = Date.now() - last;
  const delay = env.crawler.defaultDelayMs;
  if (elapsed < delay) await sleep(delay - elapsed);
  hostLastRequest.set(host, Date.now());
}

// --- robots.txt ---------------------------------------------------------

function parseRobots(txt: string): RobotRule[] {
  const lines = txt.split(/\r?\n/);
  const rules: RobotRule[] = [];
  let appliesToUs = false;
  for (const raw of lines) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      appliesToUs = value === "*" || env.crawler.userAgent.toLowerCase().includes(value.toLowerCase());
    } else if (appliesToUs && (key === "disallow" || key === "allow")) {
      if (value) rules.push({ path: value, allow: key === "allow" });
    }
  }
  return rules;
}

async function getRobots(origin: string): Promise<RobotRule[]> {
  const cached = robotsCache.get(origin);
  if (cached && Date.now() - cached.fetchedAt < ROBOTS_TTL_MS) return cached.rules;
  let rules: RobotRule[] = [];
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": env.crawler.userAgent },
      signal: AbortSignal.timeout(env.crawler.timeoutMs),
    });
    if (res.ok) rules = parseRobots(await res.text());
  } catch {
    rules = [];
  }
  robotsCache.set(origin, { rules, fetchedAt: Date.now() });
  return rules;
}

export async function isAllowedByRobots(targetUrl: string): Promise<boolean> {
  if (!env.crawler.respectRobots) return true;
  let u: URL;
  try {
    u = new URL(targetUrl);
  } catch {
    return false;
  }
  const rules = await getRobots(u.origin);
  // Longest-match wins.
  let decision = true;
  let matchLen = -1;
  for (const rule of rules) {
    if (u.pathname.startsWith(rule.path) && rule.path.length > matchLen) {
      matchLen = rule.path.length;
      decision = rule.allow;
    }
  }
  return decision;
}

// --- optional scraping proxy (JS render / WAF bypass) -------------------

/**
 * If a scraping provider is configured, wrap the target URL in the provider's
 * fetch endpoint. Returns { url, active }. Keys live only in server env.
 */
export function wrapWithScraper(target: string): { url: string; active: boolean } {
  const s = env.scraper;
  const enc = encodeURIComponent(target);
  switch (s.provider) {
    case "scraperapi":
      if (!s.apiKey) return { url: target, active: false };
      return {
        url:
          `https://api.scraperapi.com/?api_key=${s.apiKey}&url=${enc}` +
          `${s.renderJs ? "&render=true" : ""}${s.premium ? "&premium=true" : ""}`,
        active: true,
      };
    case "scrapingbee":
      if (!s.apiKey) return { url: target, active: false };
      return {
        url:
          `https://app.scrapingbee.com/api/v1/?api_key=${s.apiKey}&url=${enc}` +
          `&render_js=${s.renderJs ? "true" : "false"}${s.premium ? "&premium_proxy=true" : ""}`,
        active: true,
      };
    case "custom":
      if (!s.urlTemplate) return { url: target, active: false };
      return { url: s.urlTemplate.replace("{key}", s.apiKey).replace("{url}", enc), active: true };
    default:
      return { url: target, active: false };
  }
}

// --- fetch with retries, backoff, conditional requests ------------------

export async function politeFetch(
  url: string,
  opts: {
    conditional?: ConditionalHeaders;
    binary?: boolean;
    maxRetries?: number;
    checkRobots?: boolean;
  } = {}
): Promise<FetchResult> {
  const maxRetries = opts.maxRetries ?? 3;
  let host = "";
  try {
    host = new URL(url).host;
  } catch {
    return emptyResult(url, "Invalid URL");
  }

  // SSRF guard: never fetch admin-supplied URLs that point at internal hosts.
  try {
    await assertPublicUrl(url);
  } catch (err) {
    log.warn("SSRF blocked", { url, err: String(err) });
    return { ...emptyResult(url, err instanceof Error ? err.message : "Blocked host"), status: 998 };
  }

  if (opts.checkRobots !== false) {
    const allowed = await isAllowedByRobots(url);
    if (!allowed) {
      log.warn("Blocked by robots.txt", { url });
      return { ...emptyResult(url, "Blocked by robots.txt"), status: 999 };
    }
  }

  // Route HTML/text fetches through the scraping proxy when configured.
  // Binary (PDF) fetches always go direct.
  const { url: fetchUrl, active: scraperUsed } = opts.binary
    ? { url, active: false }
    : wrapWithScraper(url);
  const timeoutMs = scraperUsed ? env.scraper.timeoutMs : env.crawler.timeoutMs;

  let attempt = 0;
  let lastError = "";
  while (attempt <= maxRetries) {
    await throttleHost(host);
    const started = Date.now();
    try {
      const headers: Record<string, string> = {
        "User-Agent": env.crawler.userAgent,
        Accept: opts.binary
          ? "application/pdf,application/octet-stream,*/*"
          : "text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
      };
      // Conditional headers only make sense on a direct fetch to the origin.
      if (!scraperUsed && opts.conditional?.etag) headers["If-None-Match"] = opts.conditional.etag;
      if (!scraperUsed && opts.conditional?.lastModified) headers["If-Modified-Since"] = opts.conditional.lastModified;

      const res = await fetch(fetchUrl, {
        headers,
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
      });
      const responseMs = Date.now() - started;

      const outHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => (outHeaders[k] = v));

      // 304 Not Modified — nothing changed.
      if (res.status === 304) {
        return {
          ok: true,
          status: 304,
          url,
          finalUrl: res.url || url,
          body: "",
          headers: outHeaders,
          responseMs,
          fromCache: true,
        };
      }

      // Retry on transient server errors / rate limiting.
      if ([429, 500, 502, 503, 504].includes(res.status) && attempt < maxRetries) {
        const backoff = Math.min(2000 * 2 ** attempt, 16000);
        log.warn("Transient error, backing off", { url, status: res.status, backoff });
        await sleep(backoff);
        attempt++;
        continue;
      }

      let body = "";
      let buffer: Buffer | undefined;
      if (opts.binary) {
        buffer = Buffer.from(await res.arrayBuffer());
      } else {
        body = await res.text();
      }

      return {
        ok: res.ok,
        status: res.status,
        url,
        // When proxied, res.url points at the scraper endpoint — keep the real
        // target so relative links resolve correctly.
        finalUrl: scraperUsed ? url : res.url || url,
        body,
        buffer,
        headers: outHeaders,
        responseMs,
        fromCache: false,
        error: res.ok ? undefined : `HTTP ${res.status}${scraperUsed ? " (via scraper)" : ""}`,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < maxRetries) {
        const backoff = Math.min(2000 * 2 ** attempt, 16000);
        await sleep(backoff);
        attempt++;
        continue;
      }
      return { ...emptyResult(url, lastError), responseMs: Date.now() - started };
    }
  }
  return emptyResult(url, lastError || "Exhausted retries");
}

function emptyResult(url: string, error: string): FetchResult {
  return {
    ok: false,
    status: 0,
    url,
    finalUrl: url,
    body: "",
    headers: {},
    responseMs: 0,
    fromCache: false,
    error,
  };
}
