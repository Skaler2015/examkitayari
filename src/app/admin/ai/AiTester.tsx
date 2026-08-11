"use client";

import { useState, useTransition } from "react";
import { Button, Badge } from "@/components/ui";
import { testAiConnection, type AiTestResult } from "@/server/actions/ai";

export function AiTester() {
  const [result, setResult] = useState<AiTestResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        onClick={() =>
          startTransition(async () => {
            setResult(await testAiConnection());
          })
        }
        disabled={pending}
      >
        {pending ? "Testing…" : "Test connection"}
      </Button>

      {result && (
        <div className="rounded-md border p-3 text-sm">
          <div className="flex items-center gap-2">
            {result.ping.ok ? (
              <Badge variant="success">Connected</Badge>
            ) : (
              <Badge variant="danger">Not connected</Badge>
            )}
            <span className="text-muted-foreground">
              {result.status.provider} · {result.status.model}
            </span>
          </div>
          {result.ping.error && (
            <p className="mt-2 text-muted-foreground">
              <span className="font-medium text-foreground">Reason:</span> {result.ping.error}
            </p>
          )}
          {result.ping.ok && <p className="mt-2 text-emerald-600 dark:text-emerald-400">Live generation succeeded.</p>}
        </div>
      )}
    </div>
  );
}
