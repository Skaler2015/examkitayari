import { Badge } from "@/components/ui";
import { VERIFICATION_META, formatDateTime } from "@/lib/format";
import type { VerificationStatus } from "@prisma/client";

/**
 * The trust/provenance bar shown on every published update. Displays the
 * official source, source URL, dates and verification status — the core
 * accuracy commitment of the platform.
 */
export function ProvenanceBar({
  officialSource,
  officialSourceUrl,
  verificationStatus,
  publishedAt,
  lastVerifiedAt,
  aiGenerated,
}: {
  officialSource?: string | null;
  officialSourceUrl?: string | null;
  verificationStatus: VerificationStatus;
  publishedAt?: Date | null;
  lastVerifiedAt?: Date | null;
  aiGenerated?: boolean;
}) {
  const v = VERIFICATION_META[verificationStatus];
  return (
    <div className="rounded-lg border bg-secondary/40 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={v.badge}>{v.label}</Badge>
        {aiGenerated && <Badge variant="secondary">AI-assisted formatting</Badge>}
      </div>
      <dl className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Official Source</dt>
          <dd className="text-right font-medium">{officialSource ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Published</dt>
          <dd className="text-right">{formatDateTime(publishedAt)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Last verified</dt>
          <dd className="text-right">{formatDateTime(lastVerifiedAt)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Source link</dt>
          <dd className="truncate text-right">
            {officialSourceUrl ? (
              <a
                href={officialSourceUrl}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="text-primary underline"
              >
                Visit official source
              </a>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">
        Information compiled from the official source. AI is never used to invent facts. Always confirm final details on
        the official website.
      </p>
    </div>
  );
}
