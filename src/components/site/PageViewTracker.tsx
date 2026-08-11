"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Fires a lightweight page-view beacon on each route change. */
export function PageViewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    const payload = JSON.stringify({ path: pathname, referrer: document.referrer || undefined });
    try {
      const blob = new Blob([payload], { type: "application/json" });
      if (!navigator.sendBeacon?.("/api/track", blob)) {
        void fetch("/api/track", { method: "POST", body: payload, headers: { "content-type": "application/json" }, keepalive: true });
      }
    } catch {
      /* ignore */
    }
  }, [pathname]);
  return null;
}
