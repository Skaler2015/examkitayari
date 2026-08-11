"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { loginAction } from "@/server/actions/auth";
import { Card, CardContent, CardHeader, CardTitle, Input, Label } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";

export function LoginForm() {
  const [state, formAction] = useFormState(loginAction, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <p className="text-sm text-muted-foreground">Log in to track exams, bookmarks and mock tests.</p>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/15 dark:text-red-400">
              {state.error}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required placeholder="Your password" />
          </div>
          <SubmitButton className="w-full" pendingLabel="Logging in…">
            Login
          </SubmitButton>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          New to ExamsKiTayari?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
