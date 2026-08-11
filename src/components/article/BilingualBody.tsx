"use client";

import { useState } from "react";

/** Article body with an English / हिंदी toggle (shown only when Hindi exists). */
export function BilingualBody({ enHtml, hiHtml }: { enHtml: string; hiHtml: string | null }) {
  const [lang, setLang] = useState<"en" | "hi">("en");
  const html = lang === "hi" && hiHtml ? hiHtml : enHtml;

  return (
    <div>
      {hiHtml && (
        <div className="mb-3 inline-flex overflow-hidden rounded-md border text-sm">
          <button
            type="button"
            onClick={() => setLang("en")}
            className={lang === "en" ? "bg-primary px-3 py-1.5 font-medium text-primary-foreground" : "px-3 py-1.5 hover:bg-secondary"}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLang("hi")}
            className={lang === "hi" ? "bg-primary px-3 py-1.5 font-medium text-primary-foreground" : "px-3 py-1.5 hover:bg-secondary"}
          >
            हिंदी
          </button>
        </div>
      )}
      <div className="prose-article max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
