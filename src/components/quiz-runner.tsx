"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { submitQuizAttempt } from "@/lib/api";
import type { Quiz, QuizAttemptResult } from "@/lib/types";

export function QuizRunner({ quiz }: { quiz: Quiz }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      const res = await submitQuizAttempt(
        quiz.id,
        quiz.questions.map((q) => ({ quizQuestionId: q.id, optionId: answers[q.id] ?? "" })),
      );
      setResult(res);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="ai-card rounded-[2rem] p-6" aria-labelledby="quiz-heading">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">{quiz.topic}</p>
      <h1 id="quiz-heading" className="mt-2 text-3xl font-semibold text-[var(--foreground)]">{quiz.title}</h1>
      {result ? (
        <div className="mt-5 rounded-2xl border border-[var(--teal)]/30 bg-[var(--teal-muted)] p-5">
          <p className="text-4xl font-semibold text-[var(--foreground)]">{result.percent}%</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {result.correct} of {result.total} correct.
          </p>
        </div>
      ) : null}
      <ol className="mt-6 space-y-5">
        {quiz.questions.map((question, index) => (
          <li key={question.id} className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-soft)] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Question {index + 1}</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--foreground)]">{question.prompt}</p>
            <div className="mt-4 grid gap-2">
              {question.options.map((option) => {
                const selected = answers[question.id] === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: option.id }))}
                    className={`min-h-11 rounded-xl border px-4 py-3 text-left text-sm transition ${
                      selected ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--foreground)]" : "border-[var(--border)] bg-[var(--card)] text-[var(--muted)]"
                    }`}
                  >
                    <span className="font-bold uppercase">{option.id}.</span> {option.text}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => void submit()}
        disabled={submitting}
        className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-bold text-white disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
        Score quiz
      </button>
    </section>
  );
}
