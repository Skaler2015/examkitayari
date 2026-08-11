import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { isStaff } from "@/lib/auth/rbac";
import { logoutAction } from "@/server/actions/auth";
import { Button } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { CommandPalette } from "@/components/admin/CommandPalette";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/review", label: "Pending Review" },
  { href: "/admin/articles/new", label: "Add New Post" },
  { href: "/admin/sources", label: "Sources" },
  { href: "/admin/automation", label: "Automation" },
  { href: "/admin/ai", label: "AI Provider" },
  { href: "/admin/seo", label: "SEO" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/articles", label: "Articles" },
  { href: "/admin/audit", label: "Audit Logs" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!isStaff(user)) redirect("/login");

  const [pendingCount, sourceIssues] = await Promise.all([
    prisma.article.count({ where: { status: "PENDING_REVIEW" } }).catch(() => 0),
    prisma.source.count({ where: { status: { in: ["ERROR", "WARNING", "BLOCKED"] } } }).catch(() => 0),
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b bg-card">
        <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="font-bold tracking-tight">
              ExamsKiTayari <span className="text-muted-foreground">Admin</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {/* Notification bell: pending review + source issues */}
            <Link href="/admin/review" title="Pending review" className="relative grid h-9 w-9 place-items-center rounded-lg border hover:bg-secondary">
              <span className="text-lg">🔔</span>
              {pendingCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </Link>
            {sourceIssues > 0 && (
              <Link href="/admin/sources" title="Sources need attention" className="relative grid h-9 w-9 place-items-center rounded-lg border hover:bg-secondary">
                <span className="text-lg">⚠️</span>
                <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {sourceIssues}
                </span>
              </Link>
            )}
            <span className="hidden text-sm text-muted-foreground sm:inline">{user?.email}</span>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm">
                Logout
              </Button>
            </form>
          </div>
        </div>
        {/* Mobile nav */}
        <nav className="flex gap-1 overflow-x-auto border-t px-2 py-2 md:hidden">
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

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden w-56 shrink-0 border-r md:block">
          <nav className="sticky top-14 flex flex-col gap-1 p-3">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>

      <CommandPalette />
    </div>
  );
}
