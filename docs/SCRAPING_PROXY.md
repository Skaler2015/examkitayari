# Crawling JS-rendered / bot-protected sites (scraping proxy)

Many official Indian government portals **block bots (HTTP 403)**, drop
non-browser connections, or render their content with **JavaScript**. A direct
`fetch` then returns 403, a connection error, or an empty shell with no links —
exactly what you'll see on the source health page (e.g. `HTTP 403`,
`fetch failed`, or `0 items`).

To crawl these sites, route fetches through a **scraping proxy** that renders
JavaScript and rotates IPs. Support is built in and **off by default** — enable
it with environment variables; no code changes and no change to how you add
sources.

## Supported providers

| `SCRAPER_PROVIDER` | Service | Free tier |
|---|---|---|
| `scraperapi` | https://www.scraperapi.com | ~1,000 credits/mo |
| `scrapingbee` | https://www.scrapingbee.com | ~1,000 credits |
| `custom` | any proxy with a URL template | — |
| `none` (default) | direct fetch | — |

## Setup (ScraperAPI example)

1. Sign up at scraperapi.com and copy your **API key**.
2. In **Vercel → Settings → Environment Variables** add:
   | Name | Value |
   |---|---|
   | `SCRAPER_PROVIDER` | `scraperapi` |
   | `SCRAPER_API_KEY` | your key |
   | `SCRAPER_RENDER_JS` | `true` |
3. **Redeploy** (env changes need a new deployment).
4. In the admin panel open a failing source → **Crawl Now** → check the health
   page. `HTTP 403` / `fetch failed` should now succeed, and discovered items
   appear in **Pending Review**.

For **ScrapingBee** use `SCRAPER_PROVIDER=scrapingbee` with `SCRAPER_API_KEY`.
For any other proxy use `SCRAPER_PROVIDER=custom` and
`SCRAPER_URL_TEMPLATE=https://proxy.example/?token={key}&url={url}` (the code
substitutes `{key}` and URL-encodes the target into `{url}`).

## Notes

- **Tough WAFs (403):** Many govt portals block datacenter IPs even through a
  proxy. If a site still returns `HTTP 403 (via scraper)` with plain proxies,
  set `SCRAPER_PREMIUM=true` to use premium/residential proxies (costs more
  credits per request). Try `SCRAPER_RENDER_JS=false` + `SCRAPER_PREMIUM=true`
  first (WAF bypass without the render surcharge); add render only if the page
  is JavaScript-built.
- **Credits:** rendering JavaScript and premium proxies each use more credits
  per request. With premium enabled, raise each source's crawl frequency (e.g.
  every 4–6 hours in the source's Edit form) so you stay within a free/small
  plan. Scale the plan as you add sources.
- **PDFs** are always fetched directly (not through the proxy).
- **robots.txt** is still respected on the target site.
- If a site still fails through the proxy, it may need per-site `parseConfig`
  CSS selectors (set in the source's **Edit** form) or a different listing URL.
- The proxy is **optional** — sources that work with a direct fetch keep working
  without it.
