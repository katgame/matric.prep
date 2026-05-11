"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  FileText,
  Layers3,
  Loader2,
  MessageCircle,
  PanelLeftOpen,
  ScanLine,
  Sparkles,
  Target,
} from "lucide-react";
import { ExamQuestionPrompt } from "@/components/exam-question-prompt";
import { MemoGuidancePanel } from "@/components/memo-guidance-panel";
import { GeneratorButton } from "@/components/platform-generators";
import { TutorChatPanel } from "@/components/tutor-chat-panel";
import { fetchQuestionBreakdown, getApiBaseUrl, submitAttempt, type QuestionReviewPayload } from "@/lib/api";
import type { QuestionBreakdown, TutorPaper } from "@/lib/types";

type TutorRunnerProps = { paper: TutorPaper };
type MobilePane = "paper" | "ai";
type PdfStatus =
  | { kind: "none" }
  | { kind: "loading" }
  | { kind: "ready"; url: string }
  | { kind: "error"; message: string };
const MOBILE_PANES: { id: MobilePane; label: string }[] = [
  { id: "paper", label: "Exam paper" },
  { id: "ai", label: "AI tutor" },
];

function buildApiAssetUrl(relative: string | null | undefined): string | null {
  if (!relative?.trim()) return null;
  if (/^https?:\/\//i.test(relative)) return relative;
  const base = getApiBaseUrl().replace(/\/$/, "");
  const path = relative.startsWith("/") ? relative : `/${relative}`;
  return `${base}${path}`;
}

function promptPreview(prompt: string, max = 118): string {
  const text = prompt.replace(/\s+/g, " ").trim();
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}...`;
}

async function probePdfUrl(url: string): Promise<PdfStatus> {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (!res.ok) return { kind: "error", message: `Could not load the PDF (${res.status}).` };
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("pdf")) return { kind: "error", message: "The endpoint returned a non-PDF response." };
    return { kind: "ready", url };
  } catch {
    return { kind: "error", message: "Network error while loading the PDF." };
  }
}

function BreakdownSection({ label, value, tone }: { label: string; value: string; tone: "cyan" | "teal" | "violet" | "amber" }) {
  if (!value.trim()) return null;
  const toneClass =
    tone === "teal"
      ? "border-[var(--teal)]/30 bg-[var(--teal-muted)]"
      : tone === "violet"
        ? "border-[var(--border)] bg-[var(--surface-soft)]"
        : tone === "amber"
          ? "border-[var(--warning)]/30 bg-[color-mix(in_oklab,var(--warning)_8%,var(--card))]"
          : "border-[var(--accent)]/30 bg-[var(--accent-muted)]";
  return (
    <section className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">{label}</p>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">{value}</p>
    </section>
  );
}

function PdfPane({ title, status, fileLabel }: { title: string; status: PdfStatus; fileLabel: string | null }) {
  return (
    <section className="ai-card flex min-h-[60dvh] flex-col overflow-hidden rounded-[1.75rem] lg:min-h-0">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-4">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            <ScanLine className="h-4 w-4" aria-hidden />
            Official paper
          </p>
          <h2 className="mt-2 truncate text-sm font-semibold text-[var(--foreground)]">{title}</h2>
          <p className="mt-1 truncate text-xs text-[var(--muted)]" title={fileLabel ?? ""}>
            {fileLabel ?? "No source file attached"}
          </p>
        </div>
        {status.kind === "ready" ? (
          <a
            href={status.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--accent-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            Open
          </a>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 bg-[var(--surface-strong)]">
        {status.kind === "loading" ? (
          <div className="flex h-full min-h-[520px] flex-col items-center justify-center gap-3 px-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" aria-hidden />
            <p className="text-sm text-[var(--muted)]">Syncing official PDF...</p>
          </div>
        ) : null}
        {status.kind === "ready" ? (
          <iframe title={`${title} question paper`} src={`${status.url}#view=FitH`} className="h-full min-h-[560px] w-full bg-white lg:min-h-0" />
        ) : null}
        {status.kind === "none" ? (
          <div className="flex h-full min-h-[520px] flex-col items-center justify-center gap-4 px-8 text-center">
            <FileText className="h-10 w-10 text-[var(--muted)]" aria-hidden />
            <div>
              <p className="font-semibold text-[var(--foreground)]">No PDF attached yet</p>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
                The question text below the paper is still available.
              </p>
            </div>
          </div>
        ) : null}
        {status.kind === "error" ? (
          <div className="flex h-full min-h-[520px] flex-col items-center justify-center px-6">
            <div className="max-w-md rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
              <p className="font-semibold text-[var(--foreground)]">PDF unavailable</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{status.message}</p>
              <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
                Check `MatricPrep:ExamPapersRoot` or `MATRICPREP_EXAM_PAPERS_ROOT`, then restart the API.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function TutorRunner({ paper }: TutorRunnerProps) {
  const [index, setIndex] = useState(0);
  const [mobilePane, setMobilePane] = useState<MobilePane>("paper");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [breakdowns, setBreakdowns] = useState<Record<string, QuestionBreakdown>>({});
  const [breakdownError, setBreakdownError] = useState<string | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [paperPdfStatus, setPaperPdfStatus] = useState<PdfStatus>({ kind: "none" });
  const [reviews, setReviews] = useState<QuestionReviewPayload[] | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const questions = paper.questions;
  const current = questions[index];
  const currentDraft = current ? drafts[current.id] ?? "" : "";
  const currentAnswer = current ? answers[current.id] ?? "" : "";
  const currentBreakdown = current ? breakdowns[current.id] : null;
  const answeredCount = Object.values(answers).filter(Boolean).length;
  const progress = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;
  const paperPdfUrl = useMemo(
    () => buildApiAssetUrl(paper.sourcePaperPdfUrl) ?? buildApiAssetUrl(paper.sourcePaperPdfRelativePath),
    [paper.sourcePaperPdfRelativePath, paper.sourcePaperPdfUrl],
  );

  useEffect(() => {
    let cancelled = false;
    async function loadPaperPdf() {
      if (!paperPdfUrl) {
        setPaperPdfStatus({ kind: "none" });
        return;
      }
      setPaperPdfStatus({ kind: "loading" });
      const status = await probePdfUrl(paperPdfUrl);
      if (!cancelled) setPaperPdfStatus(status);
    }
    void loadPaperPdf();
    return () => {
      cancelled = true;
    };
  }, [paperPdfUrl]);

  const goToQuestion = useCallback((nextIndex: number) => {
    setIndex(nextIndex);
    setBreakdownError(null);
    setMobilePane("paper");
  }, []);

  const runBreakdown = useCallback(() => {
    if (!current || breakdownLoading) return;
    setBreakdownError(null);
    setBreakdownLoading(true);
    void (async () => {
      try {
        const data = await fetchQuestionBreakdown(paper.id, current.id, currentDraft);
        setBreakdowns((prev) => ({ ...prev, [current.id]: data }));
        setMobilePane("ai");
      } catch (e) {
        setBreakdownError(e instanceof Error ? e.message : "Could not load the AI explanation.");
      } finally {
        setBreakdownLoading(false);
      }
    })();
  }, [breakdownLoading, current, currentDraft, paper.id]);

  const submitPractice = useCallback(() => {
    if (submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    void (async () => {
      try {
        const result = await submitAttempt(
          paper.id,
          0,
          questions.map((q) => ({ questionId: q.id, optionId: answers[q.id] ?? "" })),
        );
        setReviews(result.reviews);
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : "Could not score this practice attempt.");
      } finally {
        setSubmitting(false);
      }
    })();
  }, [answers, paper.id, questions, submitting]);

  if (!current) {
    return (
      <main id="main-content" className="ai-shell mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <div className="ai-card rounded-3xl p-8">
          <p className="text-[var(--muted)]">This tutor pack has no questions yet.</p>
        </div>
      </main>
    );
  }

  const selectedReview = reviews?.find((r) => r.questionId === current.id);

  return (
    <main id="main-content" className="ai-shell flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col px-3 pb-4 pt-4 sm:px-4 lg:min-h-0">
        <section className="ai-card mb-3 rounded-[1.75rem] px-4 py-4 sm:px-5" aria-label="AI exam workspace status">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                <span className="ai-orb h-2.5 w-2.5 rounded-full" aria-hidden />
                AI exam workspace
              </p>
              <h1 className="ai-glow-text mt-2 truncate font-[family-name:var(--font-fraunces)] text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
                {paper.title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
                Read the official paper, attempt each question, then ask the AI tutor for a step-by-step path.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[500px]">
              <div className="ai-card-soft rounded-2xl p-3">
                <p className="text-xs text-[var(--muted)]">Questions</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--foreground)]">{questions.length}</p>
              </div>
              <div className="ai-card-soft rounded-2xl p-3">
                <p className="text-xs text-[var(--muted)]">Progress</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--foreground)]">{progress}%</p>
              </div>
              <div className="ai-card-soft rounded-2xl p-3">
                <p className="text-xs text-[var(--muted)]">AI tutor</p>
                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{paper.tutorChatEnabled ? "Online" : "Endpoint disabled"}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-1 lg:hidden">
            {MOBILE_PANES.map((pane) => (
              <button
                key={pane.id}
                type="button"
                onClick={() => setMobilePane(pane.id)}
                aria-pressed={mobilePane === pane.id}
                className={`min-h-11 rounded-xl px-4 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] ${
                  mobilePane === pane.id ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"
                }`}
              >
                {pane.label}
              </button>
            ))}
          </div>
        </section>

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(440px,1.08fr)_minmax(380px,0.92fr)]">
          <section className={`${mobilePane === "paper" ? "flex" : "hidden lg:flex"} min-h-[60dvh] min-w-0 flex-col gap-3 lg:min-h-0 lg:overflow-y-auto`} aria-label="Exam paper and answer workspace">
            <PdfPane title={paper.title} status={paperPdfStatus} fileLabel={paper.sourcePaperPdfRelativePath} />

            <div className="ai-card min-w-0 overflow-hidden rounded-[1.75rem]" aria-label="Question workspace">
              <header className="border-b border-[var(--border)] px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                      <ClipboardList className="h-4 w-4" aria-hidden />
                      Question {index + 1} of {questions.length}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">{current.topic || "Exam question"}</h2>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {current.difficulty || "Practice"}
                      {current.marks != null ? ` - ${current.marks} marks` : ""}
                    </p>
                  </div>
                  <Link href={`/test/${paper.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--accent-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]">
                    Timed mode
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              </header>

              <div className="p-4 sm:p-5">
                <div className="ai-reading-surface rounded-[1.5rem] border border-[var(--border)] p-4 shadow-sm sm:p-5">
                  <ExamQuestionPrompt prompt={current.prompt} />
                </div>

                {current.options.length > 0 ? (
                  <section className="mt-4 rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em]">Choose your answer</p>
                    <ul className="mt-3 grid gap-2 xl:grid-cols-2">
                      {current.options.map((opt) => {
                        const selected = currentAnswer === opt.id;
                        return (
                          <li key={opt.id}>
                            <button
                              type="button"
                              onClick={() => setAnswers((prev) => ({ ...prev, [current.id]: opt.id }))}
                              className={`flex w-full min-h-11 items-start gap-3 rounded-2xl border px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] ${
                                selected
                                  ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--foreground)]"
                                  : "border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:border-[var(--accent)]/50 hover:text-[var(--foreground)]"
                              }`}
                            >
                              <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-current text-xs font-bold uppercase">{opt.id}</span>
                              <span className="text-sm leading-relaxed">{opt.text}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ) : null}

                <section className="mt-4 rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                  <label htmlFor="student-draft" className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                    Your working
                  </label>
                  <textarea
                    id="student-draft"
                    rows={4}
                    value={currentDraft}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [current.id]: e.target.value }))}
                    placeholder="Write your first attempt, formula, or where you got stuck."
                    className="mt-3 w-full resize-y rounded-2xl border border-[var(--border)] bg-[var(--paper)] px-4 py-3 text-sm leading-relaxed text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                  />
                  <button type="button" onClick={runBreakdown} disabled={breakdownLoading} className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 text-sm font-bold text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]">
                    {breakdownLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
                    Explain with AI
                  </button>
                </section>
              </div>

              <footer className="border-t border-[var(--border)] px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => goToQuestion(Math.max(0, index - 1))} disabled={index === 0} className="inline-flex min-h-11 items-center rounded-full border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-semibold text-[var(--foreground)] transition enabled:hover:bg-[var(--accent-muted)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]">
                      <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
                      Prev
                    </button>
                    <button type="button" onClick={() => goToQuestion(Math.min(questions.length - 1, index + 1))} disabled={index === questions.length - 1} className="inline-flex min-h-11 items-center rounded-full border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-semibold text-[var(--foreground)] transition enabled:hover:bg-[var(--accent-muted)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]">
                      Next
                      <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <button type="button" onClick={submitPractice} disabled={submitting || answeredCount === 0} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--teal)]/30 bg-[var(--teal-muted)] px-4 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--teal)]/60 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
                    Score practice
                  </button>
                </div>
                {submitError ? <p className="mt-3 text-sm text-[var(--danger)]" role="alert">{submitError}</p> : null}
              </footer>
            </div>
          </section>

          <aside className={`${mobilePane === "ai" ? "flex" : "hidden lg:flex"} ai-card min-h-[60dvh] min-w-0 flex-col overflow-hidden rounded-[1.75rem] lg:min-h-0`} aria-label="AI tutor panel">
            <header className="shrink-0 border-b border-[var(--border)] px-4 py-4 sm:px-5">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                <Bot className="h-4 w-4" aria-hidden />
                OpenAI step tutor
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">Reasoning path</h2>
              <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">Ask for the path first. Reveal memo guidance only when you are ready.</p>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
              {breakdownError ? <div className="rounded-2xl border border-[var(--danger)]/30 bg-red-500/10 p-4 text-sm text-red-100" role="alert">{breakdownError}</div> : null}
              {breakdownLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((n) => <div key={n} className="h-24 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)]" />)}
                </div>
              ) : null}
              {!currentBreakdown && !breakdownLoading ? (
                <div className="rounded-3xl border border-dashed border-[var(--accent)]/30 bg-[var(--accent-muted)] p-5">
                  <Sparkles className="h-8 w-8 text-[var(--accent)]" aria-hidden />
                  <p className="mt-4 font-semibold text-[var(--foreground)]">Ready when you are</p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                    Try the question, then generate a structured walkthrough from the OpenAI endpoint.
                  </p>
                </div>
              ) : null}
              {currentBreakdown ? (
                <div className="space-y-3">
                  <BreakdownSection label="Context" value={currentBreakdown.context} tone="cyan" />
                  <BreakdownSection label="Method" value={currentBreakdown.method} tone="violet" />
                  <BreakdownSection label="Worked solution" value={currentBreakdown.workedSolution} tone="teal" />
                  <BreakdownSection label="Final answer" value={currentBreakdown.finalAnswer} tone="amber" />
                </div>
              ) : null}
              {selectedReview ? (
                <section className="rounded-2xl border border-[var(--teal)]/30 bg-[var(--teal-muted)] p-4">
                  <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                    <Target className="h-4 w-4 text-[var(--teal)]" aria-hidden />
                    Scored answer
                  </p>
                  <p className="mt-3 text-sm text-[var(--foreground)]">
                    Your answer: <span className="font-bold uppercase">{selectedReview.chosenOptionId || "none"}</span>
                    {selectedReview.correctOptionId ? <> · memo: <span className="font-bold uppercase">{selectedReview.correctOptionId}</span></> : null}
                  </p>
                </section>
              ) : null}
              <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                  Generate from this question
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <GeneratorButton kind="revision" subjectId={paper.subjectId} paperId={paper.id} questionId={current.id} topic={current.topic}>
                    Save revision
                  </GeneratorButton>
                  <GeneratorButton kind="flashcards" subjectId={paper.subjectId} paperId={paper.id} questionId={current.id} topic={current.topic}>
                    Save to deck
                  </GeneratorButton>
                  <GeneratorButton kind="quiz" subjectId={paper.subjectId} paperId={paper.id} topic={current.topic}>
                    Mini quiz
                  </GeneratorButton>
                </div>
              </section>
              <details className="group rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]">
                  <span className="inline-flex items-center gap-2">
                    <Layers3 className="h-4 w-4 text-[var(--teal)]" aria-hidden />
                    Compare with memo guidance
                  </span>
                  <PanelLeftOpen className="h-4 w-4 text-[var(--muted)] transition group-open:rotate-90" aria-hidden />
                </summary>
                <div className="mt-4">
                  <MemoGuidancePanel memoAnswer={current.memoAnswer} />
                </div>
              </details>
              <TutorChatPanel paperId={paper.id} questionId={current.id} tutorChatEnabled={paper.tutorChatEnabled} />
              <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                  <MessageCircle className="h-4 w-4 text-[var(--accent)]" aria-hidden />
                  Question map
                </p>
                <ul className="mt-3 grid grid-cols-5 gap-2">
                  {questions.map((q, qIndex) => {
                    const active = qIndex === index;
                    const answered = Boolean(answers[q.id]);
                    return (
                      <li key={q.id}>
                        <button type="button" onClick={() => goToQuestion(qIndex)} className={`min-h-11 w-full rounded-xl border text-sm font-bold tabular-nums transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] ${active ? "border-[var(--accent)] bg-[var(--accent)] text-white" : answered ? "border-[var(--teal)]/40 bg-[var(--teal-muted)] text-[var(--foreground)]" : "border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)]"}`} aria-label={`Go to question ${qIndex + 1}`}>
                          {q.sortOrder || qIndex + 1}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">{promptPreview(current.prompt, 160)}</p>
              </section>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
