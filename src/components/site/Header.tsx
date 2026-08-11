import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { isStaff } from "@/lib/auth/rbac";

const NAV = [
  { label: "Latest Jobs", href: "/jobs" },
  { label: "Admit Card", href: "/admit-card" },
  { label: "Results", href: "/results" },
  { label: "Answer Key", href: "/answer-key" },
  { label: "Exams", href: "/exams" },
  { label: "Syllabus", href: "/syllabus" },
  { label: "Mock Tests", href: "/mock-tests" },
  { label: "Current Affairs", href: "/current-affairs" },
];

export async function Header() {
  const user = await getSessionUser();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="container flex h-16 items-center gap-4">
        <Link href="/" className="flex items-center gap-2 font-extrabold">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">Ek</span>
          <span className="hidden text-lg sm:inline">
            Exams<span className="text-accent">Ki</span>Tayari
          </span>
        </Link>

        <form action="/search" className="hidden flex-1 md:block">
          <input
            name="q"
            placeholder="Search Exam, Job, Result, Admit Card..."
            className="h-10 w-full rounded-md border border-input bg-secondary/50 px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </form>

        <nav className="ml-auto flex items-center gap-3 text-sm font-medium">
          {isStaff(user) && (
            <Link href="/admin" className="rounded-md bg-secondary px-3 py-1.5">
              Admin
            </Link>
          )}
          {user ? (
            <Link href="/dashboard" className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground">
              Dashboard
            </Link>
          ) : (
            <Link href="/login" className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground">
              Login
            </Link>
          )}
        </nav>
      </div>

      <div className="border-t bg-secondary/30">
        <div className="container flex h-11 items-center gap-4 overflow-x-auto text-sm font-medium">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap text-muted-foreground hover:text-foreground">
              {n.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
