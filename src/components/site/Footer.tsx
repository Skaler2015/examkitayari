import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 border-t bg-secondary/30">
      <div className="container grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="font-extrabold">
            Exams<span className="text-accent">Ki</span>Tayari
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Official exam updates — jobs, admit cards, results and answer keys — sourced directly from official websites
            with verified source links.
          </p>
        </div>
        <div>
          <div className="mb-3 text-sm font-semibold">Updates</div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/jobs" className="hover:text-foreground">Latest Jobs</Link></li>
            <li><Link href="/admit-card" className="hover:text-foreground">Admit Cards</Link></li>
            <li><Link href="/results" className="hover:text-foreground">Results</Link></li>
            <li><Link href="/answer-key" className="hover:text-foreground">Answer Keys</Link></li>
          </ul>
        </div>
        <div>
          <div className="mb-3 text-sm font-semibold">Prepare</div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/exams" className="hover:text-foreground">Exams</Link></li>
            <li><Link href="/syllabus" className="hover:text-foreground">Syllabus</Link></li>
            <li><Link href="/mock-tests" className="hover:text-foreground">Mock Tests</Link></li>
            <li><Link href="/current-affairs" className="hover:text-foreground">Current Affairs</Link></li>
          </ul>
        </div>
        <div>
          <div className="mb-3 text-sm font-semibold">Platform</div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/about" className="hover:text-foreground">About</Link></li>
            <li><Link href="/bot" className="hover:text-foreground">Crawler Policy</Link></li>
            <li><Link href="/login" className="hover:text-foreground">Login</Link></li>
            <li><a href="/sitemap.xml" className="hover:text-foreground">Sitemap</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} ExamsKiTayari.com — Information is compiled from official sources. Always verify on
        the official website.
      </div>
    </footer>
  );
}
