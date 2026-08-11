import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
      <p className="text-6xl font-extrabold tracking-tight text-primary">404</p>
      <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Page not found</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        The page you are looking for may have moved, or the update is no longer published. Try searching or head back
        home.
      </p>

      <form action="/search" className="mt-6 flex w-full max-w-md gap-2">
        <input
          name="q"
          placeholder="Search Exam, Job, Result, Admit Card..."
          className="h-11 w-full rounded-md border border-input bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="submit"
          className="h-11 shrink-0 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Search
        </button>
      </form>

      <Link
        href="/"
        className="mt-4 rounded-md border px-5 py-2.5 text-sm font-medium hover:bg-secondary"
      >
        ← Back to home
      </Link>
    </div>
  );
}
