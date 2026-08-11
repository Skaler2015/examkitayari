"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";
import type * as React from "react";

/**
 * Submit button that reflects the enclosing <form> action's pending state.
 * Uses React 18's useFormStatus (react-dom), which must be rendered inside the
 * form it reports on.
 */
export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: React.ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendingLabel ?? "Please wait…" : children}
    </Button>
  );
}
