import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { logoutAction } from "@/server/actions/auth";
import { Button } from "@/components/ui";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/exams", label: "Followed Exams" },
  { href: "/dashboard/bookmarks", label: "Bookmarks" },
  { href: "/dashboard/history", label: "Test History" },
  { href: "/dashboard/performance", label: "Performance" },
  { href: "/dashboard/notifications", label: "Notifications" },
];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-card">
        <div className="container flex h-14 items-center justify-between gap-4">
          <Link href="/" className="font-bold tracking-tight">
            Exams<span className="text-primary">Ki</span>Tayari
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm">
                Logout
              </Button>
            </form>
          </div>
        </div>
        <nav className="container flex gap-1 overflow-x-auto border-t py-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="container py-6">{children}</main>
    </div>
  );
}
