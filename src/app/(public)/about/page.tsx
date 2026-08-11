import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "ExamsKiTayari.com compiles verified government job, admit card, result and answer key updates directly from official sources.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">About ExamsKiTayari</h1>

      <div className="prose-article mt-6 space-y-5 text-[15px] leading-relaxed text-foreground">
        <p>
          ExamsKiTayari.com is a platform built for Indian competitive-exam aspirants. Our mission is simple: give
          students a single, trustworthy place to track government jobs, admit cards, results, answer keys and exam
          notifications — without the noise, clickbait and outdated pages that clutter the web.
        </p>

        <h2 className="text-xl font-bold tracking-tight">Our accuracy commitment</h2>
        <p>
          Every update we publish is compiled directly from <strong>official sources</strong> — recruitment portals,
          result pages and notifications published by exam-conducting bodies. Each update carries a visible
          <em> source link</em>, a <em>verification status</em> and the dates it was published and last checked, so you
          always know where the information came from.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Official sources only.</strong> We monitor official websites and surface the exact source link on
            every page.
          </li>
          <li>
            <strong>Verification, not invention.</strong> Where a detail is not stated by the official source, we clearly
            mark it as <em>&ldquo;Not Available in Official Source&rdquo;</em> rather than guessing.
          </li>
          <li>
            <strong>AI assists formatting, never facts.</strong> AI may help structure and summarise content for
            readability, but it is never used to fabricate dates, vacancies, eligibility or results.
          </li>
          <li>
            <strong>Always verify.</strong> We encourage every aspirant to confirm final details on the official website
            before acting, and we make that link easy to reach.
          </li>
        </ul>

        <h2 className="text-xl font-bold tracking-tight">How it works</h2>
        <p>
          A continuous monitoring engine watches official sources for changes. When something new is detected, it is
          extracted, verified against the source, and published with full provenance. This lets us deliver timely
          updates while keeping accuracy at the centre of everything we do.
        </p>

        <p>
          Ready to get started? Explore the latest{" "}
          <Link href="/jobs" className="font-medium text-primary underline underline-offset-2">
            government jobs
          </Link>
          ,{" "}
          <Link href="/results" className="font-medium text-primary underline underline-offset-2">
            results
          </Link>{" "}
          and{" "}
          <Link href="/admit-card" className="font-medium text-primary underline underline-offset-2">
            admit cards
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
