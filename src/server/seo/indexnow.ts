import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const log = logger.child("indexnow");

export function isIndexNowEnabled(): boolean {
  return Boolean(env.indexNowKey);
}

/**
 * Notify IndexNow (Bing, Yandex, Naver, Seznam — and Google reads the protocol)
 * that URLs were added/updated. Best-effort and non-blocking.
 */
export async function submitToIndexNow(urls: string[]): Promise<{ ok: boolean; status?: number }> {
  if (!isIndexNowEnabled() || urls.length === 0) return { ok: false };
  const base = env.siteUrl.replace(/\/$/, "");
  let host: string;
  try {
    host = new URL(base).host;
  } catch {
    return { ok: false };
  }

  const payload = {
    host,
    key: env.indexNowKey,
    keyLocation: `${base}/indexnow.txt`,
    urlList: urls.slice(0, 10000),
  };

  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    // IndexNow returns 200/202 on success.
    const ok = res.status === 200 || res.status === 202;
    if (!ok) log.warn("IndexNow non-success", { status: res.status });
    return { ok, status: res.status };
  } catch (err) {
    log.warn("IndexNow submit failed", { err: String(err) });
    return { ok: false };
  }
}
