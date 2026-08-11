import Link from "next/link";
import { categoryPath, timeAgo } from "@/lib/format";
import type { ContentCategory } from "@prisma/client";

export type Row = { slug: string; title: string; category: ContentCategory; publishedAt: Date | null };

const HEADER_TONE: Record<string, string> = {
  primary: "bg-primary text-primary-foreground",
  accent: "bg-accent text-accent-foreground",
  green: "bg-emerald-600 text-white",
  purple: "bg-purple-600 text-white",
};

function isNew(d: Date | null): boolean {
  if (!d) return false;
  return Date.now() - new Date(d).getTime() < 1000 * 60 * 60 * 72; // 3 days
}

export function SectionTable({
  title,
  tone = "primary",
  items,
  viewAllHref,
}: {
  title: string;
  tone?: keyof typeof HEADER_TONE;
  items: Row[];
  viewAllHref: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className={`flex items-center justify-between px-4 py-2.5 ${HEADER_TONE[tone]}`}>
        <h2 className="text-sm font-bold uppercase tracking-wide">{title}</h2>
        <Link href={viewAllHref} className="text-xs font-medium underline-offset-2 hover:underline">
          View All
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">No updates yet.</p>
      ) : (
        <ul className="divide-y">
          {items.map((it) => (
            <li key={it.slug} className="px-4 py-2.5 text-sm transition hover:bg-secondary/40">
              <Link href={categoryPath(it.category, it.slug)} className="flex items-start gap-2">
                <span className="mt-1 text-accent">›</span>
                <span className="flex-1 leading-snug hover:text-primary">
                  {it.title}
                  {isNew(it.publishedAt) && (
                    <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-600 dark:bg-red-500/15 dark:text-red-400">
                      New
                    </span>
                  )}
                </span>
                <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{timeAgo(it.publishedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
