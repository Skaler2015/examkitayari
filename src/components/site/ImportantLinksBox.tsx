import Link from "next/link";

const LINKS = [
  { label: "All Latest Jobs", href: "/jobs" },
  { label: "All Results", href: "/results" },
  { label: "Admit Cards", href: "/admit-card" },
  { label: "Answer Keys", href: "/answer-key" },
  { label: "Exam Calendar", href: "/exams" },
  { label: "Syllabus", href: "/syllabus" },
  { label: "Previous Papers", href: "/mock-tests" },
  { label: "Current Affairs", href: "/current-affairs" },
  { label: "Search", href: "/search" },
  { label: "RSS Feed", href: "/feed.xml" },
];

export function ImportantLinksBox() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="bg-accent px-4 py-2.5 text-accent-foreground">
        <h2 className="text-sm font-bold uppercase tracking-wide">Important Links</h2>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-4 text-sm">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="flex items-center gap-1.5 hover:text-primary">
            <span className="text-accent">▸</span>
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
