"use client";

import { useState } from "react";
import { saveAttempt } from "@/server/actions/student";
import { cn } from "@/lib/utils";
import { Card, CardContent, Button, Badge } from "@/components/ui";

export type RunnerOption = { id: string; text: string; isCorrect: boolean };
export type RunnerQuestion = {
  id: string;
  text: string;
  marks: number;
  explanation: string | null;
  options: RunnerOption[];
};

export function Runner({ mockTestId, questions }: { mockTestId: string; questions: RunnerQuestion[] }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  const totalScore = questions.reduce((sum, q) => sum + q.marks, 0);

  function select(questionId: string, optionId: string) {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  }

  function submit() {
    let earned = 0;
    for (const q of questions) {
      const chosen = answers[q.id];
      const correctOption = q.options.find((o) => o.isCorrect);
      if (chosen && correctOption && chosen === correctOption.id) earned += q.marks;
    }
    setScore(earned);
    setSubmitted(true);
    // Persist best-effort (no-op server-side if the visitor is not logged in).
    void saveAttempt({ mockTestId, score: earned, totalScore }).catch(() => {});
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const answeredCount = Object.keys(answers).length;

  return (
    <div className="space-y-4">
      {submitted && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="p-5 text-center">
            <p className="text-sm text-muted-foreground">Your score</p>
            <p className="mt-1 text-3xl font-bold">
              {score} <span className="text-lg font-medium text-muted-foreground">/ {totalScore}</span>
            </p>
          </CardContent>
        </Card>
      )}

      {questions.map((q, i) => {
        const chosen = answers[q.id];
        return (
          <Card key={q.id}>
            <CardContent className="space-y-3 p-4 sm:p-5">
              <p className="font-medium">
                <span className="mr-2 text-muted-foreground">Q{i + 1}.</span>
                {q.text}
              </p>
              <div className="space-y-2">
                {q.options.map((o) => {
                  const isChosen = chosen === o.id;
                  const showRight = submitted && o.isCorrect;
                  const showWrong = submitted && isChosen && !o.isCorrect;
                  return (
                    <label
                      key={o.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors",
                        !submitted && isChosen && "border-primary bg-primary/5",
                        showRight && "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10",
                        showWrong && "border-red-500 bg-red-50 dark:bg-red-500/10",
                        submitted && "cursor-default"
                      )}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={o.id}
                        checked={isChosen}
                        onChange={() => select(q.id, o.id)}
                        disabled={submitted}
                        className="h-4 w-4 shrink-0"
                      />
                      <span>{o.text}</span>
                    </label>
                  );
                })}
              </div>
              {submitted && (
                <div className="space-y-2 border-t pt-3">
                  <Badge
                    variant={
                      chosen && q.options.find((o) => o.id === chosen)?.isCorrect ? "success" : "danger"
                    }
                  >
                    {chosen
                      ? q.options.find((o) => o.id === chosen)?.isCorrect
                        ? "Correct"
                        : "Incorrect"
                      : "Not answered"}
                  </Badge>
                  {q.explanation && (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Explanation: </span>
                      {q.explanation}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {!submitted && (
        <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-lg border bg-card p-3 shadow-sm">
          <span className="text-sm text-muted-foreground">
            {answeredCount}/{questions.length} answered
          </span>
          <Button type="button" onClick={submit} disabled={questions.length === 0}>
            Submit test
          </Button>
        </div>
      )}
    </div>
  );
}
