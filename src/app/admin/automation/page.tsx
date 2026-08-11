export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, SectionTitle, Badge } from "@/components/ui";
import AutomationForm, { type AutomationFlags } from "./AutomationForm";

const DEFAULTS: AutomationFlags = {
  sourceMonitoring: true,
  aiProcessing: true,
  autoClassification: true,
  autoDraft: true,
  autoPublish: false,
  autoSeo: true,
  autoSitemap: true,
  notifications: true,
};

const SCOPES: { scope: string; label: string; warn: boolean }[] = [
  { scope: "GLOBAL", label: "Global", warn: false },
  { scope: "JOB", label: "Jobs", warn: true },
  { scope: "ADMIT_CARD", label: "Admit Cards", warn: true },
  { scope: "RESULT", label: "Results", warn: true },
  { scope: "ANSWER_KEY", label: "Answer Keys", warn: true },
  { scope: "OTHER", label: "Current Affairs / Other", warn: false },
];

export default async function AutomationPage() {
  const rows = await prisma.automationSetting.findMany();
  const byScope = new Map(rows.map((r) => [r.scope, r]));

  return (
    <div className="space-y-6">
      <SectionTitle title="Automation Settings" />
      <p className="text-sm text-muted-foreground">
        Control which stages of the pipeline run automatically. Global settings apply unless a category overrides
        them.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {SCOPES.map(({ scope, label, warn }) => {
          const row = byScope.get(scope);
          const values: AutomationFlags = row
            ? {
                sourceMonitoring: row.sourceMonitoring,
                aiProcessing: row.aiProcessing,
                autoClassification: row.autoClassification,
                autoDraft: row.autoDraft,
                autoPublish: row.autoPublish,
                autoSeo: row.autoSeo,
                autoSitemap: row.autoSitemap,
                notifications: row.notifications,
              }
            : DEFAULTS;

          return (
            <Card key={scope}>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>{label}</CardTitle>
                {scope === "GLOBAL" ? (
                  <Badge variant="default">Base</Badge>
                ) : (
                  <Badge variant="outline">{scope}</Badge>
                )}
              </CardHeader>
              <CardContent>
                <AutomationForm scope={scope} values={values} warnAutoPublish={warn} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
