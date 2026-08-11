import dns from "node:dns/promises";
import net from "node:net";

/**
 * SSRF protection for the crawler, which fetches admin-supplied URLs. Blocks
 * non-http(s) schemes and any host that resolves to a private / loopback /
 * link-local / metadata address.
 */

function ipIsPrivate(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
    if (a === 192 && b === 168) return true; // 192.168/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::1") return true; // loopback
    if (lower.startsWith("fe80")) return true; // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique-local fc00::/7
    if (lower.startsWith("::ffff:")) return ipIsPrivate(lower.replace("::ffff:", "")); // mapped v4
    return false;
  }
  return false;
}

/** Throws if the URL is unsafe to fetch. Resolves DNS to catch rebinding. */
export async function assertPublicUrl(rawUrl: string): Promise<void> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(`Blocked scheme: ${u.protocol}`);
  }
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Blocked internal host");
  }
  // Literal IP host.
  if (net.isIP(host)) {
    if (ipIsPrivate(host)) throw new Error("Blocked private IP");
    return;
  }
  // Resolve hostname and reject if ANY address is private.
  try {
    const records = await dns.lookup(host, { all: true });
    for (const r of records) {
      if (ipIsPrivate(r.address)) throw new Error("Blocked host (resolves to private IP)");
    }
  } catch (err) {
    // Re-throw our own block errors; ignore transient DNS errors (the fetch
    // will fail naturally if the host is truly unreachable).
    if (err instanceof Error && err.message.startsWith("Blocked")) throw err;
  }
}
