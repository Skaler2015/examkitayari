import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui";

export const metadata: Metadata = {
  title: "Crawler Policy",
  description:
    "How the ExamsKiTayariBot crawler operates — it respects robots.txt, rate limits and identifies itself with a clear user-agent.",
};

export default function BotPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Crawler Policy</h1>
      <p className="mt-2 text-muted-foreground">
        ExamsKiTayari.com operates a polite web crawler, <strong>ExamsKiTayariBot</strong>, to monitor official exam and
        recruitment websites for updates.
      </p>

      <div className="prose-article mt-6 space-y-5 text-[15px] leading-relaxed text-foreground">
        <h2 className="text-xl font-bold tracking-tight">Good-citizen principles</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Respects robots.txt.</strong> ExamsKiTayariBot reads and honours each site&rsquo;s{" "}
            <code>robots.txt</code> directives, including disallowed paths and crawl-delay.
          </li>
          <li>
            <strong>Rate limited.</strong> The crawler paces its requests to avoid placing load on official servers, with
            conservative concurrency and back-off on errors.
          </li>
          <li>
            <strong>Identifies itself.</strong> Every request sends a descriptive User-Agent string with a contact URL so
            site operators can reach us.
          </li>
          <li>
            <strong>Read-only.</strong> The crawler only reads publicly available pages. It never submits forms, logs in,
            or attempts to access restricted content.
          </li>
        </ul>

        <h2 className="text-xl font-bold tracking-tight">User-agent string</h2>
        <p>Our crawler identifies itself using a User-Agent in the following format:</p>
        <Card>
          <CardContent className="pt-5">
            <code className="block overflow-x-auto whitespace-pre text-sm">
              ExamsKiTayariBot/1.0 (+https://examskitayari.com/bot)
            </code>
          </CardContent>
        </Card>

        <h2 className="text-xl font-bold tracking-tight">Questions or concerns</h2>
        <p>
          If you operate an official website and have questions about our crawler, or would like to adjust how we access
          your site, please reach out via the contact information on our platform. We respond promptly to all requests
          from site operators.
        </p>
      </div>
    </div>
  );
}
