# OCR fallback for scanned PDFs

Many official notifications are **scanned images** saved as PDF — `pdf-parse`
extracts almost no text from them, so structured extraction fails. The pipeline
now falls back to an **OCR provider** automatically, but **only when a PDF has
too little embedded text** (so normal, text-based PDFs never use OCR credits).

Off by default; enable with environment variables. On serverless (Vercel) this
uses a hosted OCR API rather than local Tesseract (which is unreliable there).

## Setup (OCR.space — free tier, supports Hindi + English)

1. Get a free API key at <https://ocr.space/ocrapi> (the free "helloworld" key
   works for quick testing; sign up for your own for higher limits).
2. In **Vercel → Settings → Environment Variables** add:
   | Name | Value |
   |---|---|
   | `OCR_PROVIDER` | `ocrspace` |
   | `OCR_API_KEY` | your key |
   | `OCR_LANGUAGE` | `eng` (or `hin` for Hindi notices) |
3. **Redeploy.** Check **Admin → AI Provider → OCR fallback** shows *Enabled*.

When a scanned PDF is discovered, OCR runs, its text feeds the normal
classification/extraction/scoring pipeline, and the document is marked
`metadata.ocr = true`.

## How the trigger works

`needsOcr(text, pageCount)` returns true when the de-whitespaced text length is
below `max(120, pageCount × 30)` — i.e. the PDF yielded essentially no text.
Text-based PDFs skip OCR entirely.

## Provider notes & limits

- **OCR.space free tier:** ~25k requests/month, but **max file size 1 MB** and
  **max 3 PDF pages** per request. Large scanned notifications may exceed this —
  upgrade the OCR.space plan (PDF up to 999 pages) for full coverage. On any
  provider error the pipeline keeps the (empty) pdf-parse text and the item is
  scored low → routed to review rather than failing silently.
- **Language:** set `OCR_LANGUAGE=hin` for Hindi documents. OCR.space engine 2 is
  used for better accuracy.
- **Custom provider:** set `OCR_PROVIDER=custom` and `OCR_ENDPOINT` to any POST
  endpoint that accepts the PDF as multipart field `file` and returns plain text
  or `{"text": "..."}`.

## Cost control

OCR only runs on scanned PDFs, which are a minority. Combined with per-source
crawl frequencies, usage stays low. Monitor via your OCR provider dashboard.
