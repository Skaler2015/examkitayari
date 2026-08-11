"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to the console for debugging; real reporting can hook in here.
    console.error(error);
  }, [error]);

  return (
    <div className="container flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
      <p className="text-5xl">⚠️</p>
      <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Something went wrong</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        An unexpected error occurred while loading this page. Please try again in a moment.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-muted-foreground">Reference: {error.digest}</p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => reset()}
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Try again
        </button>
        <a href="/" className="rounded-md border px-5 py-2.5 text-sm font-medium hover:bg-secondary">
          Back to home
        </a>
      </div>
    </div>
  );
}
