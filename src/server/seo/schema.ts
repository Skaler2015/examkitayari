import { env } from "@/lib/env";
import { absoluteUrl } from "@/lib/utils";

type FaqItem = { q: string; a: string };

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: env.siteName,
    url: env.siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${env.siteUrl}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: env.siteName,
    url: env.siteUrl,
    logo: absoluteUrl("/logo.png", env.siteUrl),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path, env.siteUrl),
    })),
  };
}

export function articleJsonLd(a: {
  title: string;
  description?: string | null;
  path: string;
  publishedAt?: Date | null;
  updatedAt?: Date | null;
  sourceUrl?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: a.title,
    description: a.description ?? undefined,
    url: absoluteUrl(a.path, env.siteUrl),
    datePublished: a.publishedAt?.toISOString(),
    dateModified: (a.updatedAt ?? a.publishedAt)?.toISOString(),
    publisher: { "@type": "Organization", name: env.siteName },
    isBasedOn: a.sourceUrl ?? undefined,
  };
}

export function faqJsonLd(faq: FaqItem[]) {
  if (!faq?.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}
