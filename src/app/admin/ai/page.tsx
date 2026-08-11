export const dynamic = "force-dynamic";

import { Card, CardHeader, CardTitle, CardContent, Badge, SectionTitle } from "@/components/ui";
import { aiStatus } from "@/server/ai/provider";
import { ocrStatus } from "@/server/ocr";
import { AiTester } from "./AiTester";

export default function AdminAiPage() {
  const status = aiStatus();
  const ocr = ocrStatus();

  return (
    <div className="space-y-6">
      <SectionTitle title="AI Provider" />

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <Row label="Status">
              {status.enabled ? <Badge variant="success">Enabled</Badge> : <Badge variant="secondary">Disabled</Badge>}
            </Row>
            <Row label="Provider">{status.provider}</Row>
            <Row label="Model">{status.model}</Row>
            <Row label="API key">
              {status.configured ? <Badge variant="success">Set</Badge> : <Badge variant="warning">Missing</Badge>}
            </Row>
          </dl>

          <div className="rounded-md bg-secondary/40 p-3 text-sm text-muted-foreground">
            Configure the provider with the server-side environment variables{" "}
            <code className="text-foreground">AI_PROVIDER</code> (<code>anthropic</code> / <code>openai</code> /{" "}
            <code>disabled</code>), <code className="text-foreground">AI_API_KEY</code> and{" "}
            <code className="text-foreground">AI_MODEL</code>. Keys are never exposed to the browser. When AI is
            disabled or unreachable, the pipeline automatically falls back to deterministic templates — publishing is
            never blocked.
          </div>

          <AiTester />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>OCR fallback (scanned PDFs)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <Row label="Status">
              {ocr.enabled ? <Badge variant="success">Enabled</Badge> : <Badge variant="secondary">Disabled</Badge>}
            </Row>
            <Row label="Provider">{ocr.provider}</Row>
            <Row label="Language">{ocr.language}</Row>
            <Row label="API key">
              {ocr.configured ? <Badge variant="success">Set</Badge> : <Badge variant="warning">Missing</Badge>}
            </Row>
          </dl>
          <p className="text-sm text-muted-foreground">
            OCR runs automatically only when a PDF has little or no embedded text (i.e. a scanned/image PDF).
            Configure with <code className="text-foreground">OCR_PROVIDER</code> (<code>ocrspace</code>),{" "}
            <code className="text-foreground">OCR_API_KEY</code> and{" "}
            <code className="text-foreground">OCR_LANGUAGE</code> (<code>eng</code>, <code>hin</code>).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How AI is used</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            AI is used <span className="font-medium text-foreground">only to format already-verified data</span> —
            never to invent facts. It generates SEO titles, meta descriptions, summaries, structured article bodies,
            FAQs and highlight points from the extracted official fields, and can act as a secondary classification
            layer when rule-based confidence is low.
          </p>
          <p>
            Toggle AI per content type under{" "}
            <a href="/admin/automation" className="text-primary underline">
              Automation Settings
            </a>{" "}
            (the <code className="text-foreground">AI Processing</code> switch).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b py-1.5 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
