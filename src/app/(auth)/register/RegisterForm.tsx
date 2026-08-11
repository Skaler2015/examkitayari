"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { registerAction } from "@/server/actions/auth";
import { Card, CardContent, CardHeader, CardTitle, Input, Label } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";

export function RegisterForm() {
  const [state, formAction] = useFormState(registerAction, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Create your account</CardTitle>
        <p className="text-sm text-muted-foreground">Follow exams, save bookmarks and take mock tests — free.</p>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/15 dark:text-red-400">
              {state.error}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" type="text" autoComplete="name" required placeholder="Your name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" required placeholder="Create a password" />
            <p className="text-xs text-muted-foreground">
              Minimum 8 characters, with an uppercase letter, a lowercase letter and a number.
            </p>
          </div>
          <SubmitButton className="w-full" pendingLabel="Creating account…">
            Create account
          </SubmitButton>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Login
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
