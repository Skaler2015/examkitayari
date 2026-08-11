# SEO growth pack

Features that help pages get discovered and indexed fast.

## What ships automatically (no external account)

- **News sitemap** — `GET /news-sitemap.xml`, articles published in the last 48h
  (Google News format). Listed in `robots.txt`.
- **IndexNow** — instant indexing ping to Bing / Yandex / Naver / Seznam (and
  Google reads the protocol). Off until you set a key.
- **SEO audit** — Admin → **SEO**: counts issues (missing meta description, title
  length, missing canonical / FAQ / official link, noindex) per published
  article, with quick links to fix, plus links to all sitemaps/feeds.

### Enable IndexNow (2 minutes)
1. Generate a random key: `openssl rand -hex 16`.
2. In **Vercel → Environment Variables** add `INDEXNOW_KEY` = that value.
3. Redeploy. Verify the key is served at `https://examskitayari.com/indexnow.txt`.
4. Done — every publish/update now pings IndexNow (`Admin → SEO` shows *IndexNow ON*).

## Google Search Console (needs your Google account)

GSC verification + the URL-inspection / Indexing API require your Google account
and a service account, so they need a short manual setup:

1. Add & verify `examskitayari.com` in <https://search.google.com/search-console>
   (DNS TXT via Hostinger, or the HTML-tag method).
2. Submit these sitemaps in GSC → Sitemaps:
   - `sitemap.xml`
   - `news-sitemap.xml`
3. (Optional, advanced) For programmatic indexing of **job postings**, create a
   Google Cloud service account with the **Indexing API** enabled and share the
   JSON — this can be wired to notify Google directly on publish. Ask and it can
   be added behind an env var.

Until GSC is set up, IndexNow already covers Bing/Yandex and nudges Google.

## Notes
- News sitemap only lists the last 48h (Google News rule) — older URLs stay in
  the main `sitemap.xml`.
- IndexNow is best-effort and non-blocking; publishing never waits on it.
