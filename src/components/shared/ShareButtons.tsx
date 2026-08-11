"use client";

import { useEffect, useState } from "react";

/** WhatsApp / Telegram / X / Copy share buttons for an article. */
export function ShareButtons({ title }: { title: string }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => setUrl(window.location.href), []);

  const text = encodeURIComponent(title);
  const u = encodeURIComponent(url);

  const links = [
    { label: "WhatsApp", href: `https://wa.me/?text=${text}%20${u}`, tone: "bg-emerald-500 hover:bg-emerald-600" },
    { label: "Telegram", href: `https://t.me/share/url?url=${u}&text=${text}`, tone: "bg-sky-500 hover:bg-sky-600" },
    { label: "X", href: `https://twitter.com/intent/tweet?text=${text}&url=${u}`, tone: "bg-neutral-800 hover:bg-neutral-900" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">Share:</span>
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white ${l.tone}`}
        >
          {l.label}
        </a>
      ))}
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* ignore */
          }
        }}
        className="rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}
