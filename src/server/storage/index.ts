import fs from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const log = logger.child("storage");

/**
 * Object storage abstraction. Uses local disk in dev; S3-compatible in prod.
 * The S3 path uses fetch against a presigned/public endpoint-free approach is
 * intentionally omitted here — wire an S3 SDK when STORAGE_DRIVER=s3. Local
 * driver is fully functional out of the box.
 */
export async function putObject(key: string, data: Buffer, contentType?: string): Promise<string> {
  if (env.storage.driver === "s3" && env.storage.s3Bucket) {
    return putS3(key, data, contentType);
  }
  return putLocal(key, data);
}

async function putLocal(key: string, data: Buffer): Promise<string> {
  const dir = path.resolve(env.storage.localDir);
  const full = path.join(dir, key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
  return `/storage/${key}`;
}

async function putS3(key: string, data: Buffer, contentType?: string): Promise<string> {
  // Minimal PUT via fetch to an S3-compatible endpoint using a public base URL.
  // For signed uploads, integrate @aws-sdk/client-s3 here. We keep the interface
  // stable so swapping the implementation requires no caller changes.
  try {
    const url = `${env.storage.s3Endpoint.replace(/\/$/, "")}/${env.storage.s3Bucket}/${key}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: contentType ? { "content-type": contentType } : {},
      body: new Uint8Array(data),
    });
    if (!res.ok) throw new Error(`S3 PUT ${res.status}`);
    return env.storage.s3PublicBaseUrl
      ? `${env.storage.s3PublicBaseUrl.replace(/\/$/, "")}/${key}`
      : url;
  } catch (err) {
    log.error("S3 put failed, falling back to local", { err: String(err) });
    return putLocal(key, data);
  }
}
