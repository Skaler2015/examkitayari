import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { isStaff } from "@/lib/auth/rbac";
import { logoutAction } from "@/server/actions/auth";
import { Button } from "@/components/ui";

/**
 * Minimal admin shell. The full admin panel is being rebuilt page-by-page
 * (Smart Post Publishing Workspace first); this shell only provides the auth
 * guard + a lightweight top bar so new pages render inside a consistent frame.
 */
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!isStaff(user)) redirect("/login");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-card">
        <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/admin/posts/new" className="font-bold tracking-tight">
            ExamsKiTayari <span className="text-muted-foreground">Admin</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user?.email}</span>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm">
                Logout
              </Button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
