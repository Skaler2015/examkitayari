export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-2/3 animate-pulse rounded-md bg-secondary" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-secondary" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-5">
            <div className="h-5 w-20 animate-pulse rounded-full bg-secondary" />
            <div className="mt-3 h-5 w-full animate-pulse rounded bg-secondary" />
            <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-secondary" />
            <div className="mt-2 h-4 w-3/5 animate-pulse rounded bg-secondary" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 pt-4 text-sm text-muted-foreground">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Loading latest updates…
      </div>
    </div>
  );
}
