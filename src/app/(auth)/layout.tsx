import type { ReactNode } from "react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10 text-foreground">
      <Link href="/" className="mb-6 text-2xl font-extrabold tracking-tight">
        Exams<span className="text-primary">Ki</span>Tayari
      </Link>
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Official Indian competitive-exam updates, sourced from official websites.
      </p>
    </div>
  );
}
