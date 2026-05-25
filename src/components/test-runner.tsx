"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  ExternalLink,
  FileText,
  Image,
  ListOrdered,
  Loader2,
  Send,
  Trophy,
} from "lucide-react";
import { MathContent } from "@/components/math-content";
import type { TakePaper } from "@/lib/types";
import {
  getApiBaseUrl,
  submitAttempt,
  postTutorChat,
  type AttemptResultPayload,
  type QuestionReviewPayload,
  type TutorChatMessage,
} from "@/lib/api";

type Phase = "active" | "submitting" | "results";
type MobileTab = "nav" | "question" | "coach";
type CoachMessage = TutorChatMessage & { _id: number };

const HINT_PROMPTS = [
  "What formula applies here?",
  "What does 'hence' mean?",
  "How many steps to show?",
  "What is this question testing?",
];

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function reviewMap(reviews: QuestionReviewPayload[]): Map<string, QuestionReviewPayload> {
  const m = new Map<string, QuestionReviewPayload>();
  for (const r of reviews) m.set(r.questionId, r);
  return m;
}

function ScoreBand({ pct }: { pct: number }) {
  if (pct >= 80) return <span className="rounded-full bg-[var(--teal-muted)] px-3 py-1 text-xs font-bold text-[var(--teal)]">Distinction</span>;
  if (pct >= 70) return <span className="rounded-full bg-[var(--accent-muted)] px-3 py-1 text-xs font-bold text-[var(--accent)]">Merit</span>;
  if (pct >= 60) return <span className="rounded-full bg-[var(--accent-muted)] px-3 py-1 text-xs font-bold text-[var(--accent)]">Achieved</span>;
  if (pct >= 50) return <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">Pass</span>;
  return <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700 dark:bg-red-950/40 dark:text-red-400">Not yet achieved</span>;
}

export function TestRunner({ paper }: { paper: TakePaper }) {
  const [phase, setPhase] = useState<Phase>("active");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remaining, setRemaining] = useState(Math.max(paper.durationMinutes, 1) * 60);
  const [result, setResult] = useState<AttemptResultPayload | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const finishOnce = useRef(false);
  const isTimed = paper.durationMinutes > 0;

  const [mobileTab, setMobileTab] = useState<MobileTab>("question");

  // Coach chat
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const [coachInput, setCoachInput] = useState("");
  const [coachPending, setCoachPending] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [coachUnavailable, setCoachUnavailable] = useState(false);
  const coachIdRef = useRef(0);
  const coachBottomRef = useRef<HTMLDivElement>(null);

  const questions = paper.questions;
  const current = questions[index];
  const answeredCount = Object.values(answers).filter(Boolean).length;
  const pctAnswered = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;

  const paperPdfUrl = useMemo(() => {
    if (!paper.sourcePaperPdfRelativePath) return null;
    const base = getApiBaseUrl().replace(/\/$/, "");
    const rel = paper.sourcePaperPdfRelativePath;
    return `${base}${rel.startsWith("/") ? rel : `/${rel}`}`;
  }, [paper.sourcePaperPdfRelativePath]);

  // Countdown
  useEffect(() => {
    if (!isTimed || phase !== "active") return;
    const id = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { window.clearInterval(id); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [isTimed, phase]);

  const runSubmit = useCallback(async () => {
    if (finishOnce.current) return;
    finishOnce.current = true;
    setPhase("submitting");
    setSubmitError(null);
    const elapsed = Math.max(paper.durationMinutes, 1) * 60 - remaining;
    try {
      const res = await submitAttempt(
        paper.id,
        Math.max(0, elapsed),
        questions.map((q) => ({ questionId: q.id, optionId: answers[q.id] ?? "" })),
      );
      setResult(res);
      setPhase("results");
    } catch (e) {
      finishOnce.current = false;
      setSubmitError(e instanceof Error ? e.message : "Could not submit attempt.");
      setPhase("active");
    }
  }, [answers, paper.durationMinutes, paper.id, questions, remaining]);

  useEffect(() => {
    if (!isTimed || phase !== "active" || remaining > 0) return;
    void runSubmit();
  }, [isTimed, remaining, phase, runSubmit]);

  // Reset coach when question changes
  useEffect(() => {
    setCoachMessages([]);
    setCoachInput("");
    setCoachError(null);
  }, [current?.id]);

  useEffect(() => {
    coachBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [coachMessages, coachPending]);

  const sendCoach = useCallback(async () => {
    const text = coachInput.trim();
    if (!text || coachPending || coachUnavailable || !current) return;
    const userMsg: CoachMessage = { role: "user", content: text, _id: coachIdRef.current++ };
    const thread = [...coachMessages, userMsg];
    setCoachMessages(thread);
    setCoachInput("");
    setCoachPending(true);
    setCoachError(null);
    try {
      const { reply } = await postTutorChat(
        paper.id,
        current.id,
        thread.map(({ role, content }) => ({ role, content })),
      );
      setCoachMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply, _id: coachIdRef.current++ },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not reach coach.";
      if (msg.toLowerCase().includes("disabled") || msg.includes("503")) {
        setCoachUnavailable(true);
      }
      setCoachError(msg);
      setCoachMessages((prev) => prev.slice(0, -1));
    } finally {
      setCoachPending(false);
    }
  }, [coachInput, coachMessages, coachPending, coachUnavailable, current, paper.id]);

  // ── SUBMITTING ──────────────────────────────────────────────────────────
  if (phase === "submitting") {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-[var(--accent-muted)] border-t-[var(--accent)]" />
            <Trophy className="h-8 w-8 text-[var(--accent)]" aria-hidden />
          </div>
          <div>
            <p className="text-xl font-semibold text-[var(--foreground)]">Marking your paper</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Loading memorandum feedback…</p>
          </div>
        </div>
      </div>
    );
  }

  // ── RESULTS ─────────────────────────────────────────────────────────────
  if (phase === "results" && result) {
    const byId = reviewMap(result.reviews);
    const pct = result.percent;
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {/* Score header */}
        <div className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-glow)]">
          <div className="border-b border-[var(--border)] px-8 py-8"
            style={{ background: "linear-gradient(135deg, var(--accent-muted), transparent 60%)" }}>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm text-[var(--muted)]">{paper.subjectLabel} · {paper.year}</p>
                <h1 className="mt-1 font-[family-name:var(--font-fraunces)] text-2xl font-semibold leading-tight text-[var(--foreground)]">
                  {paper.title}
                </h1>
                <div className="mt-3">
                  <ScoreBand pct={pct} />
                </div>
              </div>
              <div className="text-right">
                <p className="font-[family-name:var(--font-fraunces)] text-7xl font-semibold tabular-nums leading-none text-[var(--accent)]">
                  {pct}<span className="text-4xl">%</span>
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">{result.correct}/{result.total} correct</p>
              </div>
            </div>
          </div>

          {/* Score bar */}
          <div className="h-2 bg-[var(--surface-strong)]">
            <div
              className={`h-full transition-all duration-700 ${pct >= 80 ? "bg-[var(--teal)]" : pct >= 50 ? "bg-[var(--accent)]" : "bg-red-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Per-question review */}
          <div className="divide-y divide-[var(--border)]">
            {questions.map((q, qi) => {
              const rev = byId.get(q.id);
              const ok = rev?.isCorrect ?? false;
              return (
                <div key={q.id} className="px-6 py-5 sm:px-8">
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                      ok
                        ? "bg-[var(--teal-muted)] text-[var(--teal)]"
                        : "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"
                    }`}>
                      {ok ? "✓" : qi + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm leading-relaxed text-[var(--foreground)]">
                        <MathContent content={q.prompt.startsWith("[latex]\n") ? q.prompt.slice("[latex]\n".length) : q.prompt} className="text-sm" />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-4 text-xs">
                        <span className="text-[var(--muted)]">
                          Your answer:{" "}
                          <span className="font-bold uppercase text-[var(--foreground)]">
                            {rev?.chosenOptionId?.trim() || "—"}
                          </span>
                        </span>
                        {rev?.correctOptionId ? (
                          <span className="text-[var(--muted)]">
                            Correct:{" "}
                            <span className="font-bold uppercase text-[var(--teal)]">
                              {rev.correctOptionId}
                            </span>
                          </span>
                        ) : null}
                      </div>
                      {rev?.memoAnswer ? (
                        <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                          <p className="text-xs font-semibold text-[var(--muted)]">Memorandum</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">
                            {rev.memoAnswer}
                          </p>
                        </div>
                      ) : null}
                      {rev?.explanation ? (
                        <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{rev.explanation}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 border-t border-[var(--border)] px-8 py-6 sm:flex-row">
            <Link
              href={`/tutor/${paper.id}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-bold text-white transition hover:bg-[var(--accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
            >
              Review with AI tutor
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--border)] px-6 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--accent-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const timerUrgent = isTimed && remaining < 300;
  const timerWarning = isTimed && remaining < 600 && !timerUrgent;

  // ── ACTIVE ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--card)] px-4 py-2.5 sm:px-5">
        <p className="min-w-0 flex-1 truncate text-sm text-[var(--muted)]">{paper.title}</p>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-xs text-[var(--muted)] sm:block">{answeredCount}/{questions.length}</span>
          {isTimed ? (
            <div
              className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 font-mono text-sm font-bold tabular-nums transition-colors duration-500 ${
                timerUrgent
                  ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
                  : timerWarning
                    ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
                    : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--foreground)]"
              }`}
              role="timer"
              aria-live="polite"
              aria-label={`Time remaining: ${formatTime(remaining)}`}
            >
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {formatTime(remaining)}
            </div>
          ) : null}
          {paperPdfUrl ? (
            <a
              href={paperPdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--accent-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
            >
              <FileText className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">Paper PDF</span>
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => void runSubmit()}
            className="inline-flex min-h-9 items-center rounded-xl bg-[var(--accent)] px-4 text-xs font-bold text-white transition hover:bg-[var(--accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
          >
            Submit
          </button>
        </div>
      </div>

      {submitError ? (
        <p className="shrink-0 border-b border-red-200 bg-red-50 px-5 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300" role="alert">
          {submitError}
        </p>
      ) : null}

      {/* Mobile tab bar */}
      <div className="flex shrink-0 border-b border-[var(--border)] bg-[var(--card)] lg:hidden">
        {([
          ["nav", "Questions", ListOrdered],
          ["question", "Question", FileText],
          ["coach", "Coach", Bot],
        ] as const).map(([tab, label, Icon]) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMobileTab(tab)}
            aria-pressed={mobileTab === tab}
            className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-semibold transition ${
              mobileTab === tab
                ? "border-b-2 border-[var(--accent)] text-[var(--accent)]"
                : "text-[var(--muted)]"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {/* 3-pane body */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* ── LEFT: Navigator ─────────────────────────────────── */}
        <aside
          className={`${mobileTab === "nav" ? "flex" : "hidden lg:flex"} w-full shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--card)] lg:w-52`}
          aria-label="Question navigator"
        >
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <p className="mb-3 px-1 text-xs font-semibold text-[var(--muted)]">All questions</p>
            <ul className="grid grid-cols-5 gap-1.5 lg:grid-cols-4">
              {questions.map((q, idx) => {
                const active = idx === index;
                const answered = Boolean(answers[q.id]);
                return (
                  <li key={q.id}>
                    <button
                      type="button"
                      onClick={() => { setIndex(idx); setMobileTab("question"); }}
                      aria-label={`Question ${idx + 1}${answered ? ", answered" : ""}`}
                      className={`flex h-10 w-full items-center justify-center rounded-xl text-sm font-bold tabular-nums transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)] ${
                        active
                          ? "bg-[var(--accent)] text-white shadow-sm"
                          : answered
                            ? "bg-[var(--teal-muted)] text-[var(--teal)]"
                            : "border border-[var(--border)] bg-[var(--background)] text-[var(--muted)] hover:border-[var(--accent)]/50 hover:text-[var(--foreground)]"
                      }`}
                    >
                      {answered && !active
                        ? <CheckCircle2 className="h-4 w-4" aria-hidden />
                        : idx + 1}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Progress footer */}
          <div className="shrink-0 border-t border-[var(--border)] p-3">
            <div
              className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-strong)]"
              role="progressbar"
              aria-valuenow={pctAnswered}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-[var(--teal)] transition-all duration-300"
                style={{ width: `${pctAnswered}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-[var(--muted)]">{answeredCount} of {questions.length} answered</p>
          </div>
        </aside>

        {/* ── CENTER: Question ─────────────────────────────────── */}
        <section
          className={`${mobileTab === "question" ? "flex" : "hidden lg:flex"} min-w-0 flex-1 flex-col overflow-hidden`}
          aria-label="Question"
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl px-5 py-7 sm:px-8">
              {/* Question meta */}
              <div className="mb-5 flex items-center justify-between">
                <p className="text-xs font-medium text-[var(--muted)]">
                  Question {index + 1} <span className="text-[var(--border)]">/</span> {questions.length}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {current.topic}
                  {current.marks != null ? ` · ${current.marks} mark${current.marks !== 1 ? "s" : ""}` : ""}
                </p>
              </div>

              {/* Question prompt — exam paper style */}
              {(() => {
                const rawPrompt = current.prompt;
                const cleanPrompt = rawPrompt.startsWith("[latex]\n")
                  ? rawPrompt.slice("[latex]\n".length)
                  : rawPrompt;
                const referencesGraph = /\b(drawn below|graph.*below|figure below|diagram below|refer to the (graph|figure|diagram))\b/i.test(cleanPrompt);
                return (
                  <>
                    <div className="exam-desk-paper rounded-[1.5rem] p-6 sm:p-8">
                      <MathContent content={cleanPrompt} />
                    </div>
                    {referencesGraph && paperPdfUrl ? (
                      <a
                        href={paperPdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 flex items-center gap-3 rounded-2xl border border-[var(--warning)]/40 bg-[color-mix(in_oklab,var(--warning)_8%,var(--card))] px-4 py-3 text-sm transition hover:bg-[color-mix(in_oklab,var(--warning)_14%,var(--card))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
                      >
                        <Image className="h-4 w-4 shrink-0 text-[var(--warning)]" aria-hidden />
                        <span className="flex-1 text-[var(--foreground)]">
                          This question references a graph or diagram.
                        </span>
                        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--warning)]">
                          View official paper <ExternalLink className="h-3 w-3" aria-hidden />
                        </span>
                      </a>
                    ) : referencesGraph ? (
                      <p className="mt-3 flex items-center gap-2 rounded-2xl border border-[var(--warning)]/40 bg-[color-mix(in_oklab,var(--warning)_8%,var(--card))] px-4 py-3 text-sm text-[var(--foreground)]">
                        <Image className="h-4 w-4 shrink-0 text-[var(--warning)]" aria-hidden />
                        This question references a graph — refer to the official exam paper for the diagram.
                      </p>
                    ) : null}
                  </>
                );
              })()}

              {/* MCQ options */}
              {current.options.length > 0 ? (
                <ul
                  className="mt-5 space-y-2.5"
                  role="radiogroup"
                  aria-labelledby={`q-label-${current.id}`}
                >
                  <span id={`q-label-${current.id}`} className="sr-only">
                    Select one answer
                  </span>
                  {current.options.map((opt) => {
                    const selected = answers[current.id] === opt.id;
                    return (
                      <li key={opt.id}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() =>
                            setAnswers((prev) => ({ ...prev, [current.id]: opt.id }))
                          }
                          className={`flex w-full items-start gap-4 rounded-2xl border-2 px-5 py-4 text-left transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)] ${
                            selected
                              ? "border-[var(--accent)] bg-[var(--accent-muted)] shadow-sm"
                              : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)]/40 hover:bg-[var(--surface-soft)]"
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold uppercase transition-all ${
                              selected
                                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                                : "border-[var(--border)] text-[var(--muted)]"
                            }`}
                          >
                            {opt.id}
                          </span>
                          <span className="min-w-0 flex-1 leading-relaxed text-[var(--foreground)]">
                            <MathContent content={opt.text} className="text-base" />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              {/* Unanswered notice */}
              {!answers[current.id] && current.options.length > 0 ? (
                <div className="mt-3 flex items-center gap-2 text-xs text-[var(--muted)]">
                  <Circle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Not yet answered
                </div>
              ) : answers[current.id] ? (
                <div className="mt-3 flex items-center gap-2 text-xs text-[var(--teal)]">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Answer recorded
                </div>
              ) : null}
            </div>
          </div>

          {/* Bottom navigation */}
          <div className="flex shrink-0 items-center justify-between border-t border-[var(--border)] bg-[var(--card)] px-5 py-3">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--border)] px-5 text-sm font-medium text-[var(--foreground)] transition enabled:hover:bg-[var(--accent-muted)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Prev
            </button>
            {index < questions.length - 1 ? (
              <button
                type="button"
                onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void runSubmit()}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--teal)] px-6 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
              >
                <Trophy className="h-4 w-4" aria-hidden />
                Finish &amp; see results
              </button>
            )}
          </div>
        </section>

        {/* ── RIGHT: Coach chat ─────────────────────────────────── */}
        <aside
          className={`${mobileTab === "coach" ? "flex" : "hidden lg:flex"} w-full shrink-0 flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--card)] lg:w-80`}
          aria-label="Study coach"
        >
          <div className="shrink-0 border-b border-[var(--border)] px-4 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent-muted)]">
                <Bot className="h-4 w-4 text-[var(--accent)]" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">Study Coach</p>
                <p className="text-xs text-[var(--muted)]">Strategy, not answers</p>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {coachMessages.length === 0 && !coachPending && !coachUnavailable ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] p-4">
                  <p className="text-sm font-medium text-[var(--foreground)]">Need a nudge?</p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                    Ask about approach, formulas, or what command words mean. The coach won't reveal the answer.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {HINT_PROMPTS.map((hint) => (
                    <button
                      key={hint}
                      type="button"
                      onClick={() => setCoachInput(hint)}
                      className="rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs text-[var(--muted)] transition hover:border-[var(--accent)]/50 hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {coachUnavailable ? (
              <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-xs leading-relaxed text-[var(--muted)]">
                Coach is not available — enable tutor chat in the server config.
              </p>
            ) : null}

            {coachMessages.map((m) => (
              <div key={m._id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-[var(--accent)] text-white"
                      : "border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--foreground)]"
                  }`}
                >
                  <span className="sr-only">{m.role === "user" ? "You: " : "Coach: "}</span>
                  <span className="whitespace-pre-wrap break-words">{m.content}</span>
                </div>
              </div>
            ))}

            {coachPending ? (
              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <span className="flex gap-1" aria-label="Coach is thinking">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--muted)]"
                      style={{ animationDelay: `${i * 160}ms` }}
                    />
                  ))}
                </span>
                Thinking…
              </div>
            ) : null}

            {coachError && !coachUnavailable ? (
              <p className="text-xs text-red-500" role="alert">{coachError}</p>
            ) : null}

            <div ref={coachBottomRef} />
          </div>

          {!coachUnavailable ? (
            <div className="shrink-0 border-t border-[var(--border)] p-3">
              <div className="flex items-end gap-2">
                <label htmlFor="coach-input" className="sr-only">Message to study coach</label>
                <textarea
                  id="coach-input"
                  rows={2}
                  value={coachInput}
                  onChange={(e) => setCoachInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendCoach();
                    }
                  }}
                  placeholder="Ask about strategy…"
                  disabled={coachPending}
                  className="min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)] disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => void sendCoach()}
                  disabled={coachPending || !coachInput.trim()}
                  aria-label="Send message"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
                >
                  {coachPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
                </button>
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
