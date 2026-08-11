import crypto from "node:crypto";

// Server-only by construction: imported exclusively by server modules
// (crawler, pipeline, auth). Kept out of "@/lib/utils" so client bundles that
// need cn()/slugify() never pull in node:crypto.

/** SHA-256 hex digest. Server-only (uses node:crypto). */
export function sha256(input: string | Buffer): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/** Cheap, stable content fingerprint (normalises whitespace first). */
export function fingerprint(text: string): string {
  const normalised = text.replace(/\s+/g, " ").trim().toLowerCase();
  return sha256(normalised);
}
