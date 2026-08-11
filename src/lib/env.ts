/**
 * Centralised, validated access to environment variables.
 * Server-only values must never be imported into client components.
 */

function str(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

function num(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

export const env = {
  nodeEnv: str("NODE_ENV", "development"),
  isProd: str("NODE_ENV") === "production",

  siteUrl: str("NEXT_PUBLIC_SITE_URL", "http://localhost:3000"),
  siteName: str("NEXT_PUBLIC_SITE_NAME", "ExamsKiTayari"),

  databaseUrl: str("DATABASE_URL"),
  redisUrl: str("REDIS_URL"),

  authSecret: str("AUTH_SECRET", "dev-insecure-secret-change-me"),
  authSessionTtl: num("AUTH_SESSION_TTL", 60 * 60 * 24 * 7),

  ai: {
    provider: str("AI_PROVIDER", "disabled") as "anthropic" | "openai" | "disabled",
    apiKey: str("AI_API_KEY"),
    model: str("AI_MODEL", "claude-sonnet-5"),
    maxTokens: num("AI_MAX_TOKENS", 2048),
  },

  storage: {
    driver: str("STORAGE_DRIVER", "local") as "local" | "s3",
    localDir: str("STORAGE_LOCAL_DIR", "./storage"),
    s3Endpoint: str("S3_ENDPOINT"),
    s3Region: str("S3_REGION", "ap-south-1"),
    s3Bucket: str("S3_BUCKET"),
    s3AccessKeyId: str("S3_ACCESS_KEY_ID"),
    s3SecretAccessKey: str("S3_SECRET_ACCESS_KEY"),
    s3PublicBaseUrl: str("S3_PUBLIC_BASE_URL"),
  },

  crawler: {
    userAgent: str(
      "CRAWLER_USER_AGENT",
      "ExamsKiTayariBot/1.0 (+https://examskitayari.com/bot)"
    ),
    defaultDelayMs: num("CRAWLER_DEFAULT_DELAY_MS", 2000),
    maxConcurrency: num("CRAWLER_MAX_CONCURRENCY", 4),
    timeoutMs: num("CRAWLER_TIMEOUT_MS", 30000),
    respectRobots: bool("CRAWLER_RESPECT_ROBOTS", true),
  },

  // Optional scraping-proxy for JS-rendered / bot-protected (WAF) sites.
  // When configured, HTML/RSS/sitemap fetches route through the provider, which
  // renders JavaScript and rotates IPs. Binary (PDF) fetches stay direct.
  scraper: {
    // "none" | "scraperapi" | "scrapingbee" | "custom"
    provider: str("SCRAPER_PROVIDER", "none") as "none" | "scraperapi" | "scrapingbee" | "custom",
    apiKey: str("SCRAPER_API_KEY"),
    renderJs: bool("SCRAPER_RENDER_JS", true),
    // Premium/residential proxies — needed to bypass tough WAFs (e.g. many
    // govt sites that 403 datacenter IPs). Costs more credits per request.
    premium: bool("SCRAPER_PREMIUM", false),
    // For provider="custom": a URL template containing {key} and {url}
    // (e.g. https://proxy.example.com/?token={key}&url={url}).
    urlTemplate: str("SCRAPER_URL_TEMPLATE"),
    timeoutMs: num("SCRAPER_TIMEOUT_MS", 70000),
  },

  // Optional OCR fallback for scanned PDFs (image-only, no embedded text).
  // Provider-agnostic HTTP OCR. Runs ONLY when pdf-parse yields too little text.
  ocr: {
    // "none" | "ocrspace" | "custom"
    provider: str("OCR_PROVIDER", "none") as "none" | "ocrspace" | "custom",
    apiKey: str("OCR_API_KEY"),
    // OCR.space language code(s): eng, hin, or "eng,hin" behaviour depends on engine.
    language: str("OCR_LANGUAGE", "eng"),
    // For provider="custom": POST endpoint that accepts the PDF and returns text.
    endpoint: str("OCR_ENDPOINT"),
    timeoutMs: num("OCR_TIMEOUT_MS", 60000),
  },

  automation: {
    enabled: bool("AUTOMATION_ENABLED", true),
    schedulerTickSeconds: num("SCHEDULER_TICK_SECONDS", 60),
  },

  email: {
    host: str("SMTP_HOST"),
    port: num("SMTP_PORT", 587),
    user: str("SMTP_USER"),
    password: str("SMTP_PASSWORD"),
    from: str("EMAIL_FROM", "ExamsKiTayari <no-reply@examskitayari.com>"),
  },

  // IndexNow: instantly notify Bing/Yandex/Naver (and Google reads it) when
  // content is published/updated. Set any random string as the key.
  indexNowKey: str("INDEXNOW_KEY"),

  logLevel: str("LOG_LEVEL", "info"),
};
