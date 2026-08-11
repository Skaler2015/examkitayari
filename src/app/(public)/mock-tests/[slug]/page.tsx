export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Runner, type RunnerQuestion } from "./Runner";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const test = await prisma.mockTest.findUnique({ where: { slug: params.slug }, select: { title: true } });
  return { title: test?.title ?? "Mock Test" };
}

export default async function MockTestPage({ params }: { params: { slug: string } }) {
  const test = await prisma.mockTest.findUnique({
    where: { slug: params.slug },
    include: {
      exam: true,
      questions: {
        orderBy: { orderIndex: "asc" },
        include: {
          question: { include: { options: { orderBy: { orderIndex: "asc" } }, explanation: true } },
        },
      },
    },
  });

  if (!test || !test.isPublished) notFound();

  const questions: RunnerQuestion[] = test.questions.map((mtq) => ({
    id: mtq.question.id,
    text: mtq.question.text,
    marks: mtq.marks,
    explanation: mtq.question.explanation?.text ?? null,
    options: mtq.question.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{test.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {test.exam ? `${test.exam.name} · ` : ""}
          {questions.length} questions · {test.durationMin} min
        </p>
      </div>
      {test.description && <p className="text-sm text-muted-foreground">{test.description}</p>}
      <Runner mockTestId={test.id} questions={questions} />
    </div>
  );
}
