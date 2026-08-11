import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { categoryPath } from "@/lib/format";

/** Scrolling "breaking updates" ticker of the latest published items. */
export async function BreakingBar() {
  let items: { slug: string; title: string; category: import("@prisma/client").ContentCategory }[] = [];
  try {
    items = await prisma.article.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 12,
      select: { slug: true, title: true, category: true },
    });
  } catch {
    return null;
  }
  if (items.length === 0) return null;

  // Duplicate the list so the marquee loops seamlessly (-50% translate).
  const loop = [...items, ...items];

  return (
    <div className="border-b bg-primary text-primary-foreground">
      <div className="container flex h-9 items-center gap-3 overflow-hidden text-sm">
        <span className="shrink-0 rounded bg-accent px-2 py-0.5 text-xs font-bold uppercase text-accent-foreground">
          Latest
        </span>
        <div className="relative flex-1 overflow-hidden">
          <div className="ekt-marquee">
            {loop.map((it, i) => (
              <Link
                key={`${it.slug}-${i}`}
                href={categoryPath(it.category, it.slug)}
                className="mx-4 font-medium hover:underline"
              >
                {it.title}
                <span className="mx-2 opacity-60">•</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
