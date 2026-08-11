"use client";

import { useFormState } from "react-dom";
import { Input, Label } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { discoverFromSitemap, type DiscoverState } from "@/server/actions/ingest";

export function DiscoverForm() {
  const [state, formAction] = useFormState<DiscoverState, FormData>(discoverFromSitemap, {});

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/15 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p className="rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
          {state.message}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="sitemapUrl">Sitemap URL</Label>
        <Input id="sitemapUrl" name="sitemapUrl" type="url" required placeholder="https://example.gov.in/sitemap.xml" />
        <p className="text-xs text-muted-foreground">
          Works with a sitemap index too. Pages are filtered by their <code>lastmod</code> date.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="from">From date</Label>
          <Input id="from" name="from" type="date" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">To date</Label>
          <Input id="to" name="to" type="date" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Leave both dates blank to import everything in the sitemap (capped at 300 pages).
      </p>

      <SubmitButton pendingLabel="Discovering…">Discover pages</SubmitButton>
    </form>
  );
}
