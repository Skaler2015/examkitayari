import Link from "next/link";

const CATS: { label: string; href: string; icon: string; tone: string }[] = [
  { label: "Latest Jobs", href: "/jobs", icon: "💼", tone: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" },
  { label: "Results", href: "/results", icon: "🏆", tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" },
  { label: "Admit Card", href: "/admit-card", icon: "🎫", tone: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" },
  { label: "Answer Key", href: "/answer-key", icon: "🔑", tone: "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300" },
  { label: "Exams", href: "/exams", icon: "📚", tone: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" },
  { label: "Syllabus", href: "/syllabus", icon: "📝", tone: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300" },
  { label: "Mock Tests", href: "/mock-tests", icon: "🧠", tone: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300" },
  { label: "Current Affairs", href: "/current-affairs", icon: "🗞️", tone: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300" },
];

export function CategoryGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {CATS.map((c) => (
        <Link
          key={c.href}
          href={c.href}
          className="group flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className={`grid h-11 w-11 place-items-center rounded-full text-xl ${c.tone}`}>{c.icon}</span>
          <span className="text-sm font-semibold">{c.label}</span>
        </Link>
      ))}
    </div>
  );
}
