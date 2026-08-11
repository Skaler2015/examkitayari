import * as cheerio from "cheerio";

/**
 * Server-side HTML sanitiser for AI/template-generated article bodies before
 * they are rendered with dangerouslySetInnerHTML. Allowlist-based: strips
 * scripts, event handlers, javascript: URLs, and any tag not explicitly allowed.
 */

const ALLOWED_TAGS = new Set([
  "p", "br", "hr", "h2", "h3", "h4", "ul", "ol", "li", "strong", "b", "em", "i",
  "a", "table", "thead", "tbody", "tr", "th", "td", "blockquote", "code", "pre", "span", "div",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
  th: new Set(["colspan", "rowspan"]),
  td: new Set(["colspan", "rowspan"]),
};

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return "";
  const $ = cheerio.load(html, null, false);

  // Remove dangerous elements outright.
  $("script, style, iframe, object, embed, form, input, textarea, button, link, meta, svg, noscript").remove();

  $("*").each((_i, el) => {
    if (el.type !== "tag") return;
    const tag = el.tagName?.toLowerCase();
    if (!tag || !ALLOWED_TAGS.has(tag)) {
      // Unwrap disallowed tags: keep their text/children, drop the tag.
      $(el).replaceWith($(el).contents());
      return;
    }
    const allowed = ALLOWED_ATTRS[tag] ?? new Set<string>();
    const attribs = { ...(el as unknown as { attribs: Record<string, string> }).attribs };
    for (const attr of Object.keys(attribs)) {
      const lower = attr.toLowerCase();
      // Strip event handlers and any non-allowlisted attribute.
      if (lower.startsWith("on") || !allowed.has(lower)) {
        $(el).removeAttr(attr);
        continue;
      }
      if (lower === "href") {
        const val = attribs[attr].trim();
        // Block javascript:, data:, vbscript: URLs.
        if (/^\s*(javascript|data|vbscript):/i.test(val)) {
          $(el).removeAttr(attr);
        }
      }
    }
    // Force external links to be safe.
    if (tag === "a" && $(el).attr("href")) {
      $(el).attr("rel", "nofollow noopener noreferrer");
      if (!$(el).attr("target")) $(el).attr("target", "_blank");
    }
  });

  return $.html();
}
