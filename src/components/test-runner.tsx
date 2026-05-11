"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  Trophy,
} from "lucide-react";
import type { TakePaper } from "@/lib/types";
import {
  submitAttempt,
  type AttemptResultPayload,
  type QuestionReviewPayload,
} from "@/lib/api";

type Phase = "active" | "submitting" | "results";

type TestRunnerProps = {
  paper: TakePaper;
};

function formatMmSs(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function reviewByQuestionId(
  reviews: QuestionReviewPayload[],
): Map<string, QuestionReviewPayload> {
  const m = new Map<string, QuestionReviewPayload>();
  for (const r of reviews) m.set(r.questionId, r);
  return m;
}

export function TestRunner({ paper }: TestRunnerProps) {
  const [phase, setPhase] = useState<Phase>("active");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remaining, setRemaining] = useState(Math.max(paper.durationMinutes, 1) * 60);
  const [result, setResult] = useState<AttemptResultPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const finishOnce = useRef(false);
  const isTimed = paper.durationMinutes > 0;

  const questions = paper.questions;
  const current = questions[index];

  useEffect(() => {
    if (!isTimed || phase !== "active") return;
    const id = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          window.clearInterval(id);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [isTimed, phase]);

  const runSubmit = useCallback(async () => {
    if (finishOnce.current) return;
    finishOnce.current = true;
    setPhase("submitting");
    setError(null);
    const durationSeconds = paper.durationMinutes * 60 - remaining;
    const payload = questions.map((q) => ({
      questionId: q.id,
      optionId: answers[q.id] ?? "",
    }));
    try {
      const res = await submitAttempt(paper.id, Math.max(0, durationSeconds), payload);
      setResult(res);
      setPhase("results");
    } catch (e) {
      finishOnce.current = false;
      setError(e instanceof Error ? e.message : "Could not submit attempt.");
      setPhase("active");
    }
  }, [answers, paper.durationMinutes, paper.id, questions, remaining]);

  useEffect(() => {
    if (!isTimed || phase !== "active") return;
    if (remaining > 0) return;
    void runSubmit();
  }, [isTimed, remaining, phase, runSubmit]);

  const selectOption = useCallback(
    (optionId: string) => {
      if (!current) return;
      setAnswers((prev) => ({ ...prev, [current.id]: optionId }));
    },
    [current],
  );

  if (!current && phase === "active") {
    return null;
  }

  if (phase === "submitting") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-10">
          <Loader2 className="h-10 w-10 animate-spin text-[var(--accent)]" aria-hidden />
          <p className="text-sm text-[var(--muted)]">Marking your paper and loading memorandum feedback…</p>
        </div>
      </div>
    );
  }

  if (phase === "results" && result) {
    const byId = reviewByQuestionId(result.reviews);
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="h-10 w-10 text-[var(--accent)]" aria-hidden />
              <div>
                <h1 className="font-[family-name:var(--font-fraunces)] text-2xl font-semibold text-[var(--foreground)]">
                  Results
                </h1>
                <p className="text-sm text-[var(--muted)]">{paper.title}</p>
              </div>
            </div>
            <p className="text-3xl font-semibold tabular-nums text-[var(--accent)]">{result.percent}%</p>
          </div>
          <p className="mt-4 text-[var(--muted)]">
            You scored{" "}
            <span className="font-medium text-[var(--foreground)]">
              {result.correct} out of {result.total}
            </span>{" "}
            ({result.percent}%). Scores reflect auto-marked MCQs where a memo key is present.
          </p>
          <ul className="mt-6 space-y-4">
            {questions.map((q) => {
              const rev = byId.get(q.id);
              const ok = rev?.isCorrect ?? false;
              return (
                <li
                  key={q.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4"
                >
                  <div className="flex items-start gap-2">
                    {ok ? (
                      <CheckCircle2
                        className="mt-0.5 h-5 w-5 shrink-0 text-[var(--teal)]"
                        aria-hidden
                      />
                    ) : (
                      <Circle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--muted)]" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1 space-y-3">
                      <p className="text-sm font-medium text-[var(--foreground)]">{q.prompt}</p>
                      <p className="text-xs text-[var(--muted)]">
                        Your answer:{" "}
                        <span className="font-medium uppercase text-[var(--foreground)]">
                          {rev?.chosenOptionId?.trim() ? rev.chosenOptionId : "—"}
                        </span>
                        {rev?.correctOptionId ? (
                          <>
                            {" "}
                            · Memo / correct:{" "}
                            <span className="font-medium uppercase text-[var(--foreground)]">
                              {rev.correctOptionId}
                            </span>
                          </>
                        ) : null}
                      </p>
                      {rev?.memoAnswer ? (
                        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                            Memorandum
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--foreground)]">
                            {rev.memoAnswer}
                          </p>
                        </div>
                      ) : null}
                      {rev?.markingNotes ? (
                        <div className="rounded-lg border border-dashed border-[var(--border)] p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                            Marking notes
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--foreground)]">
                            {rev.markingNotes}
                          </p>
                        </div>
                      ) : null}
                      {rev?.explanation ? (
                        <p className="text-sm text-[var(--muted)]">{rev.explanation}</p>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/papers/${paper.id}`}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--border)] px-5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--accent-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            >
              Back to paper
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--accent)] px-5 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            >
              Go to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
      {error ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </p>
      ) : null}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">{paper.title}</p>
        <div
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-medium tabular-nums text-[var(--foreground)]"
          role="timer"
          aria-live="polite"
        >
          <Clock className="h-4 w-4 text-[var(--accent)]" aria-hidden />
          {formatMmSs(remaining)}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Question navigator
          </p>
          <ul className="mt-3 space-y-2">
            {questions.map((q, idx) => {
              const selected = idx === index;
              const answered = Boolean(answers[q.id]);
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => setIndex(idx)}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] ${
                      selected
                        ? "border-[var(--accent)] bg-[var(--accent-muted)]"
                        : "border-[var(--border)] hover:border-[var(--accent)]/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-[var(--foreground)]">
                        Question {idx + 1}
                      </span>
                      {answered ? (
                        <CheckCircle2 className="h-4 w-4 text-[var(--teal)]" aria-hidden />
                      ) : (
                        <Circle className="h-4 w-4 text-[var(--muted)]" aria-hidden />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {q.topic}
                      {q.marks != null ? ` · ${q.marks} marks` : ""}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:p-6">
          <div>
            <p className="text-sm text-[var(--muted)]">
              Question {index + 1} of {questions.length}
            </p>
            <p className="text-xs text-[var(--muted)]">
              {current.topic} · {current.difficulty}
              {current.marks != null ? ` · ${current.marks} marks` : ""}
            </p>
          </div>

          <p className="mt-4 font-[family-name:var(--font-fraunces)] text-xl leading-snug text-[var(--foreground)] sm:text-2xl">
            {current.prompt}
          </p>

          <div className="mt-6 grid gap-3" role="radiogroup" aria-labelledby={`q-${current.id}-label`}>
            <span id={`q-${current.id}-label`} className="sr-only">
              Select one answer
            </span>
            {current.options.map((opt) => {
              const selected = answers[current.id] === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => selectOption(opt.id)}
                  className={`flex min-h-11 w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] ${
                    selected
                      ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--foreground)]"
                      : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--accent)]/50"
                  }`}
                >
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-xs font-semibold uppercase">
                    {opt.id}
                  </span>
                  <span>{opt.text}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="inline-flex min-h-11 min-w-[44px] items-center justify-center rounded-full border border-[var(--border)] px-5 text-sm font-medium text-[var(--foreground)] transition enabled:hover:bg-[var(--accent-muted)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            >
              Previous
            </button>
            {index < questions.length - 1 ? (
              <button
                type="button"
                onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--accent)] px-6 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void runSubmit()}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--teal)] px-6 text-sm font-medium text-white transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
              >
                Finish &amp; see results
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
