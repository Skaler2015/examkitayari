import { env } from "@/lib/env";

/**
 * Serves the IndexNow key at a fixed path. We pass this as `keyLocation` when
 * submitting URLs, so the key file name does not need to match the key.
 */
export async function GET() {
  if (!env.indexNowKey) return new Response("", { status: 404 });
  return new Response(env.indexNowKey, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
