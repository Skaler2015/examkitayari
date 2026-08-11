"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const COMMANDS: { label: string; href: string; hint?: string }[] = [
  { label: "Dashboard", href: "/admin" },
  { label: "Pending Review", href: "/admin/review" },
  { label: "Add New Post", href: "/admin/articles/new" },
  { label: "Create detailed Job post", href: "/admin/articles/new/job" },
  { label: "Discover from sitemap", href: "/admin/sources/discover" },
  { label: "All Articles", href: "/admin/articles" },
  { label: "Sources", href: "/admin/sources" },
  { label: "Add Source", href: "/admin/sources/new" },
  { label: "Automation Settings", href: "/admin/automation" },
  { label: "AI Provider", href: "/admin/ai" },
  { label: "SEO", href: "/admin/seo" },
  { label: "Analytics", href: "/admin/analytics" },
  { label: "Audit Logs", href: "/admin/audit" },
  { label: "View public site", href: "/" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return COMMANDS;
    return COMMANDS.filter((c) => c.label.toLowerCase().includes(s));
  }, [q]);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg overflow-hidden rounded-xl border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) go(results[0].href);
          }}
          placeholder="Jump to… (type a page)"
          className="w-full border-b bg-transparent px-4 py-3 text-sm focus:outline-none"
        />
        <ul className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted-foreground">No matches</li>
          ) : (
            results.map((c) => (
              <li key={c.href}>
                <button onClick={() => go(c.href)} className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-secondary">
                  <span>{c.label}</span>
                  <span className="text-xs text-muted-foreground">{c.href}</span>
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="border-t px-4 py-2 text-[11px] text-muted-foreground">Ctrl/⌘ K to toggle · Enter to open · Esc to close</div>
      </div>
    </div>
  );
}
