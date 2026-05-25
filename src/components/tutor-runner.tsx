"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Layers3,
  Lightbulb,
  ListOrdered,
  Loader2,
  Pencil,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Volume2,
  VolumeX,
  XCircle,
  Zap,
} from "lucide-react";
import { ExamQuestionPrompt } from "@/components/exam-question-prompt";
import { MathContent } from "@/components/math-content";
import { MemoGuidancePanel } from "@/components/memo-guidance-panel";
import { GeneratorButton } from "@/components/platform-generators";
import {
  fetchQuestionBreakdown,
  postTutorChat,
  submitAttempt,
  type AttemptResultPayload,
  type QuestionReviewPayload,
  type TutorChatMessage,
} from "@/lib/api";
import type { QuestionBreakdown, TutorPaper, TutorQuestion } from "@/lib/types";
import { useSpeech } from "@/lib/tts";

// ── Types ────────────────────────────────────────────────────────────────────

type Phase = "quiz" | "results" | "review";
type ChatMessage = TutorChatMessage & { _id: number };
type MobilePane = "question" | "ai";
type StageKey = "frame" | "recall" | "plan" | "solve" | "review";

// ── Stages ───────────────────────────────────────────────────────────────────

const STAGES: Array<{
  key: StageKey;
  num: number;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  continueLabel: string;
}> = [
  { key: "frame",  num: 1, label: "What's this asking?",      sublabel: "Understand the question",   icon: Target,     continueLabel: "What I need to know"    },
  { key: "recall", num: 2, label: "What you need to know",    sublabel: "Key concepts & formulae",   icon: Lightbulb,  continueLabel: "Show me the approach"   },
  { key: "plan",   num: 3, label: "The approach",             sublabel: "Method & strategy",          icon: ListOrdered,continueLabel: "Work it out"            },
  { key: "solve",  num: 4, label: "Step-by-step solution",    sublabel: "Full worked example",        icon: Pencil,     continueLabel: "Check my answer"        },
  { key: "review", num: 5, label: "Final answer & exam tips", sublabel: "What the examiner checks",  icon: ShieldCheck,continueLabel: ""                       },
];

const FOLLOW_UP_SUGGESTIONS = [
  "Why does this method work?",
  "Show me a common mistake",
  "Give me a similar example",
  "What do examiners look for?",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function scoreMessage(correct: number, total: number): { headline: string; sub: string } {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const missed = total - correct;
  const ml = missed === 1 ? "1 question" : `${missed} questions`;
  if (pct === 100) return { headline: "Perfect score!",     sub: "You answered every question correctly. Outstanding." };
  if (pct >= 80)   return { headline: "Excellent work!",    sub: `${ml} to iron out — Kago can walk you through them.` };
  if (pct >= 60)   return { headline: "Solid effort.",      sub: `${ml} to close — let Kago guide you through what went wrong.` };
  if (pct >= 40)   return { headline: "Good start.",        sub: "There's room to grow — Kago has full walkthroughs for what you missed." };
  return             { headline: "Keep going.",              sub: "Kago will walk you through every question you missed, step by step." };
}

// ── StageCard ────────────────────────────────────────────────────────────────

function StageCard({
  stage, content, isActive, isComplete, isLast, allComplete,
  onContinue, onSuggest, speechKey, activeSpeechKey, onSpeak,
}: {
  stage: typeof STAGES[number];
  content: string;
  isActive: boolean;
  isComplete: boolean;
  isLast: boolean;
  allComplete: boolean;
  onContinue: () => void;
  onSuggest: (text: string) => void;
  speechKey: string;
  activeSpeechKey: string | null;
  onSpeak: (content: string, key: string) => void;
}) {
  const Icon = stage.icon;
  const isSpeaking = activeSpeechKey === speechKey;
  return (
    <div className={`walkthrough-stage-enter overflow-hidden rounded-2xl border transition-colors duration-300 ${isActive && !isComplete ? "border-[var(--accent)]/35 bg-[color-mix(in_oklab,var(--accent)_6%,var(--card))]" : "border-[var(--border)] bg-[var(--card)]"}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm transition-colors duration-300 ${isComplete ? "bg-[var(--teal)] text-white" : isActive ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] text-[var(--muted)]"}`}>
          {isComplete ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Step {stage.num} of {STAGES.length} · {stage.sublabel}</p>
          <p className={`text-sm font-semibold leading-tight ${isActive ? "text-[var(--foreground)]" : "text-[var(--muted)]"}`}>{stage.label}</p>
        </div>
        <button
          type="button"
          onClick={() => onSpeak(content, speechKey)}
          aria-label={isSpeaking ? "Stop listening" : `Listen to step ${stage.num}`}
          aria-pressed={isSpeaking}
          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)] ${isSpeaking ? "border-[var(--accent)]/40 bg-[var(--accent-muted)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]/30 hover:text-[var(--accent)]"}`}
        >
          {isSpeaking ? (
            <>
              <span className="flex items-end gap-px" aria-hidden>
                {[0, 1, 2, 3].map((i) => <span key={i} className="sound-bar" style={{ animationDelay: `${i * 90}ms` }} />)}
              </span>
              <VolumeX className="h-3 w-3" aria-hidden />
            </>
          ) : (
            <Volume2 className="h-3.5 w-3.5" aria-hidden />
          )}
          <span className="hidden sm:inline">{isSpeaking ? "Stop" : "Listen"}</span>
        </button>
      </div>

      <div className="px-4 pb-4">
        <MathContent content={content} className="text-sm" />
        {isActive && !isLast && (
          <div className="mt-4 border-t border-[var(--border)]/60 pt-3">
            <button type="button" onClick={onContinue} className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]">
              {stage.continueLabel}
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}
        {isLast && allComplete && (
          <div className="mt-4 border-t border-[var(--border)]/60 pt-3">
            <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)]">
              <Zap className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden />
              Ask Kago a follow-up
            </p>
            <div className="flex flex-wrap gap-2">
              {FOLLOW_UP_SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => onSuggest(s)} className="rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition hover:border-[var(--accent)]/40 hover:bg-[var(--accent-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Group Summary (between question groups) ──────────────────────────────────

type SummaryBdState = {
  loading: boolean;
  data: QuestionBreakdown | null;
  error: string | null;
  revealed: number;
};

function GroupSummaryView({
  paper, summaryGroup, summaryQuestions, answers, isLast, submitting, submitError,
  onContinue, onGoBack,
}: {
  paper: TutorPaper;
  summaryGroup: TutorQuestion | null;
  summaryQuestions: TutorQuestion[];
  answers: Record<string, string>;
  isLast: boolean;
  submitting: boolean;
  submitError: string | null;
  onContinue: () => void;
  onGoBack: () => void;
}) {
  const [selectedQuestion, setSelectedQuestion] = useState<TutorQuestion | null>(null);
  const [breakdowns, setBreakdowns] = useState<Record<string, SummaryBdState>>({});
  const [mobilePane, setMobilePane] = useState<"summary" | "kago">("summary");
  const { activeKey: activeSpeechKey, toggle: toggleSpeech } = useSpeech();

  const correct = summaryQuestions.filter((q) => answers[q.id] && answers[q.id] === q.correctOptionId).length;
  const answered = summaryQuestions.filter((q) => answers[q.id]).length;
  const unanswered = summaryQuestions.length - answered;
  const pct = answered > 0 ? Math.round((correct / answered) * 100) : 0;
  const wrongCount = summaryQuestions.filter((q) => answers[q.id] && answers[q.id] !== q.correctOptionId).length;
  const allGroupAnswered = unanswered === 0;

  function openExplain(q: TutorQuestion) {
    setSelectedQuestion(q);
    setMobilePane("kago");
    if (!breakdowns[q.id]) {
      const chosenOpt = q.options.find((o) => o.id === answers[q.id]);
      const correctOpt = q.options.find((o) => o.id === q.correctOptionId);
      const studentAttempt = answers[q.id]
        ? `I selected option ${answers[q.id]}${chosenOpt ? `: "${chosenOpt.text}"` : ""}. The correct answer is option ${q.correctOptionId}${correctOpt ? `: "${correctOpt.text}"` : ""}.`
        : "I did not answer this question.";
      setBreakdowns((prev) => ({ ...prev, [q.id]: { loading: true, data: null, error: null, revealed: 1 } }));
      void (async () => {
        try {
          const data = await fetchQuestionBreakdown(paper.id, q.id, studentAttempt);
          setBreakdowns((prev) => ({ ...prev, [q.id]: { ...prev[q.id]!, loading: false, data } }));
        } catch (e) {
          setBreakdowns((prev) => ({ ...prev, [q.id]: { ...prev[q.id]!, loading: false, error: e instanceof Error ? e.message : "Error" } }));
        }
      })();
    }
  }

  const barColor = pct >= 80 ? "bg-[var(--teal)]" : pct >= 50 ? "bg-[var(--accent)]" : "bg-[var(--warning)]";
  const continueLabel = isLast ? "Submit Quiz" : "Next question";
  const mbd = selectedQuestion ? breakdowns[selectedQuestion.id] : null;

  return (
    <main id="main-content" className="flex min-h-0 flex-1 flex-col overflow-hidden">

      {/* Mobile tabs */}
      <div className="flex shrink-0 border-b border-[var(--border)] bg-[var(--card)] lg:hidden">
        {(["summary", "kago"] as const).map((pane) => (
          <button
            key={pane}
            type="button"
            onClick={() => setMobilePane(pane)}
            aria-pressed={mobilePane === pane}
            className={`flex flex-1 items-center justify-center py-3 text-sm font-semibold transition ${mobilePane === pane ? "border-b-2 border-[var(--accent)] text-[var(--accent)]" : "text-[var(--muted)]"}`}
          >
            {pane === "summary" ? "Summary" : "Kago"}
          </button>
        ))}
      </div>

      {/* Two-pane body */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* LEFT: Summary */}
        <section
          className={`${mobilePane === "summary" ? "flex" : "hidden lg:flex"} min-w-0 flex-1 flex-col overflow-hidden border-r border-[var(--border)]`}
          aria-label="Question summary"
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">

              {/* Score card */}
              <div className="mb-6 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
                <div className="p-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    {summaryGroup?.topic ?? "Question"} · Summary
                  </p>
                  <div className="mt-4 flex items-end gap-5">
                    <div>
                      <p className="text-5xl font-bold tabular-nums leading-none text-[var(--foreground)]">
                        {correct}
                        <span className="text-2xl font-semibold text-[var(--muted)]">/{summaryQuestions.length}</span>
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {unanswered > 0 ? `${unanswered} unanswered` : `${pct}% correct`}
                      </p>
                    </div>
                    <div className="mb-1 flex-1">
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-strong)]">
                        <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                  {correct === summaryQuestions.length && allGroupAnswered && (
                    <p className="mt-3 text-sm font-semibold text-[var(--teal)]">Perfect! All correct on this question.</p>
                  )}
                  {wrongCount > 0 && (
                    <p className="mt-3 text-sm text-[var(--muted)]">
                      Tap <strong>Explain</strong> on any incorrect answer to see Kago's walkthrough.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 border-t border-[var(--border)] px-6 py-4">
                  <button
                    type="button"
                    onClick={onContinue}
                    disabled={submitting || (isLast && !allGroupAnswered)}
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
                    {submitting ? "Marking…" : continueLabel}
                  </button>
                  <button
                    type="button"
                    onClick={onGoBack}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--accent-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                    Go back
                  </button>
                </div>
                {submitError && (
                  <p className="border-t border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300" role="alert">
                    {submitError}
                  </p>
                )}
              </div>

              {/* Sub-question rows */}
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Sub-questions</p>
              <div className="space-y-2">
                {summaryQuestions.map((q, qi) => {
                  const chosenId = answers[q.id];
                  const isCorrect = !!chosenId && chosenId === q.correctOptionId;
                  const isWrong = !!chosenId && chosenId !== q.correctOptionId;
                  const isUnanswered = !chosenId;
                  const chosenOpt = q.options.find((o) => o.id === chosenId);
                  const correctOpt = q.options.find((o) => o.id === q.correctOptionId);
                  const isSelected = selectedQuestion?.id === q.id;

                  return (
                    <div
                      key={q.id}
                      className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 transition-colors ${
                        isSelected
                          ? "border-[var(--accent)]/40 bg-[var(--accent-muted)] ring-1 ring-[var(--accent)]/20"
                          : isCorrect
                            ? "border-[var(--teal)]/30 bg-[var(--teal-muted)]"
                            : isWrong
                              ? "border-[var(--danger)]/25 bg-[color-mix(in_oklab,var(--danger)_4%,var(--card))]"
                              : "border-[var(--border)] bg-[var(--card)]"
                      }`}
                    >
                      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ${isCorrect ? "bg-[var(--teal)]" : isWrong ? "bg-[var(--danger)]" : "bg-[var(--muted)]/30"}`}>
                        {isCorrect
                          ? <CheckCircle2 className="h-4 w-4" aria-hidden />
                          : isWrong
                            ? <XCircle className="h-4 w-4" aria-hidden />
                            : <span className="text-xs font-bold text-[var(--muted)]">?</span>
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">Sub-question {qi + 1}</p>
                        <div className="mt-1"><MathContent content={q.prompt} className="text-sm" /></div>
                        {isCorrect && (
                          <div className="mt-1.5 flex items-start gap-1 text-xs font-semibold text-[var(--teal)]">
                            <span className="shrink-0">{chosenId} —</span>
                            {chosenOpt && <MathContent content={chosenOpt.text} className="text-xs font-normal" />}
                          </div>
                        )}
                        {isWrong && (
                          <div className="mt-1.5 space-y-1 text-xs">
                            <div className="flex items-start gap-1 text-[var(--danger)]">
                              <span className="shrink-0 font-bold">You: {chosenId} —</span>
                              {chosenOpt && <MathContent content={chosenOpt.text} className="text-xs" />}
                            </div>
                            <div className="flex items-start gap-1 text-[var(--teal)]">
                              <span className="shrink-0 font-bold">Correct: {q.correctOptionId} —</span>
                              {correctOpt && <MathContent content={correctOpt.text} className="text-xs" />}
                            </div>
                          </div>
                        )}
                        {isUnanswered && (
                          <p className="mt-1 text-xs text-[var(--muted)]">Not answered</p>
                        )}
                      </div>
                      {isWrong && (
                        <button
                          type="button"
                          onClick={() => openExplain(q)}
                          aria-pressed={isSelected}
                          className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)] ${
                            isSelected
                              ? "bg-[var(--accent)] text-white"
                              : "border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white"
                          }`}
                        >
                          <Bot className="h-3.5 w-3.5" aria-hidden />
                          Explain
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom continue */}
              <div className="mt-6">
                <button
                  type="button"
                  onClick={onContinue}
                  disabled={submitting || (isLast && !allGroupAnswered)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {submitting ? "Marking…" : continueLabel}
                  {!submitting && <ChevronRight className="h-4 w-4" aria-hidden />}
                </button>
              </div>

            </div>
          </div>
        </section>

        {/* RIGHT: Kago walkthrough */}
        <aside
          className={`${mobilePane === "kago" ? "flex" : "hidden lg:flex"} w-full shrink-0 flex-col overflow-hidden bg-[var(--card)] lg:w-[460px] xl:w-[520px]`}
          aria-label="Kago walkthrough"
        >
          {/* Header */}
          <div className="shrink-0 border-b border-[var(--border)] px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-muted)]">
                <Bot className="h-4 w-4 text-[var(--accent)]" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--foreground)]">Kago · Walkthrough</p>
                <p className="truncate text-xs text-[var(--muted)]">
                  {selectedQuestion ? selectedQuestion.topic || "Sub-question" : "Select an incorrect answer to explain"}
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {!selectedQuestion ? (
              <div className="flex h-full flex-col items-center justify-center p-10 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent-muted)]">
                  <Bot className="h-8 w-8 text-[var(--accent)]" aria-hidden />
                </div>
                <p className="font-semibold text-[var(--foreground)]">Kago is ready</p>
                <p className="mt-1.5 max-w-xs text-sm text-[var(--muted)]">
                  {wrongCount > 0
                    ? "Tap Explain on any incorrect answer and I'll walk you through it step by step."
                    : "All correct — no walkthroughs needed here."}
                </p>
              </div>
            ) : (
              <div className="space-y-3 p-5">
                {mbd?.loading && (
                  <div className="flex flex-col items-center gap-4 py-10 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-muted)]">
                      <Bot className="kago-thinking h-7 w-7 text-[var(--accent)]" aria-hidden />
                    </div>
                    <p className="font-semibold text-[var(--foreground)]">Kago is preparing your walkthrough</p>
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-[var(--accent)]/40" style={{ animationDelay: `${i * 180}ms` }} />)}
                    </div>
                  </div>
                )}

                {mbd?.error && (
                  <p className="rounded-xl border border-[var(--danger)]/20 bg-[color-mix(in_oklab,var(--danger)_5%,var(--card))] p-4 text-sm text-[var(--danger)]">{mbd.error}</p>
                )}

                {mbd?.data && (
                  <>
                    {mbd.data.personalizedFeedback && (
                      <div className="rounded-xl border border-[var(--accent)]/20 bg-[var(--accent-muted)] p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-sm font-bold text-white">K</div>
                          <MathContent content={mbd.data.personalizedFeedback} className="text-sm" />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 px-1">
                      {STAGES.map((_, i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${i < mbd.revealed ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`} />
                      ))}
                      <span className="shrink-0 text-[11px] font-semibold tabular-nums text-[var(--muted)]">{mbd.revealed}/{STAGES.length}</span>
                    </div>

                    {STAGES.slice(0, mbd.revealed).map((stage, i) => {
                      const content = mbd.data![stage.key];
                      if (!content?.trim()) return null;
                      const speechKey = `summary-${selectedQuestion.id}-${stage.key}`;
                      return (
                        <StageCard
                          key={stage.key}
                          stage={stage}
                          content={content}
                          isActive={i === mbd.revealed - 1}
                          isComplete={i < mbd.revealed - 1}
                          isLast={stage.num === STAGES.length}
                          allComplete={mbd.revealed >= STAGES.length}
                          onContinue={() => setBreakdowns((prev) => ({
                            ...prev,
                            [selectedQuestion.id]: { ...prev[selectedQuestion.id]!, revealed: Math.min(prev[selectedQuestion.id]!.revealed + 1, STAGES.length) },
                          }))}
                          onSuggest={() => {}}
                          speechKey={speechKey}
                          activeSpeechKey={activeSpeechKey}
                          onSpeak={toggleSpeech}
                        />
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        </aside>

      </div>
    </main>
  );
}

// ── Phase 1: Quiz ────────────────────────────────────────────────────────────

type QuizChatMsg = TutorChatMessage & { _id: number };
type QuizMobilePane = "paper" | "answer";
type QuizMode = "answering" | "group-summary";

function QuizPhase({
  paper, answers, onAnswer, onFinish, submitting, submitError,
}: {
  paper: TutorPaper;
  answers: Record<string, string>;
  onAnswer: (questionId: string, optionId: string) => void;
  onFinish: () => void;
  submitting: boolean;
  submitError: string | null;
}) {
  const mcqQuestions = useMemo(() => paper.questions.filter((q) => q.options.length > 0), [paper.questions]);

  const groupMap = useMemo(() => {
    const m = new Map<string, TutorQuestion>();
    paper.questions.filter((q) => q.questionType === "group").forEach((g) => m.set(g.id, g));
    return m;
  }, [paper.questions]);

  const findParent = useCallback(
    (mcqId: string): TutorQuestion | null => {
      const lastDash = mcqId.lastIndexOf("-");
      if (lastDash < 0) return null;
      return groupMap.get(mcqId.slice(0, lastDash)) ?? null;
    },
    [groupMap],
  );

  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<QuizMode>("answering");
  const [summaryGroup, setSummaryGroup] = useState<TutorQuestion | null>(null);
  const [summaryQuestions, setSummaryQuestions] = useState<TutorQuestion[]>([]);
  const [pendingNextIndex, setPendingNextIndex] = useState(0);
  const [mobilePane, setMobilePane] = useState<QuizMobilePane>("paper");
  const [kagoOpen, setKagoOpen] = useState(false);
  const [kagoMessages, setKagoMessages] = useState<QuizChatMsg[]>([]);
  const [kagoInput, setKagoInput] = useState("");
  const [kagoPending, setKagoPending] = useState(false);
  const [kagoError, setKagoError] = useState<string | null>(null);
  const kagoIdRef = useRef(0);
  const kagoBottomRef = useRef<HTMLDivElement>(null);
  const kagoInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setKagoMessages([]);
    setKagoInput("");
    setKagoError(null);
  }, [index]);

  useEffect(() => {
    kagoBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [kagoMessages, kagoPending]);

  const sendKago = useCallback(async (overrideText?: string) => {
    if (!paper.tutorChatEnabled) return;
    const current = mcqQuestions[index];
    if (!current) return;
    const text = (overrideText ?? kagoInput).trim();
    if (!text || kagoPending) return;
    const userMsg: QuizChatMsg = { role: "user", content: text, _id: kagoIdRef.current++ };
    const thread = [...kagoMessages, userMsg];
    setKagoMessages(thread);
    setKagoInput("");
    setKagoPending(true);
    setKagoError(null);
    try {
      const { reply } = await postTutorChat(paper.id, current.id, thread.map(({ role, content }) => ({ role, content })));
      setKagoMessages((prev) => [...prev, { role: "assistant", content: reply, _id: kagoIdRef.current++ }]);
    } catch (e) {
      setKagoError(e instanceof Error ? e.message : "Something went wrong.");
      setKagoMessages((prev) => prev.slice(0, -1));
    } finally {
      setKagoPending(false);
    }
  }, [index, kagoInput, kagoMessages, kagoPending, mcqQuestions, paper.id, paper.tutorChatEnabled]);

  const triggerGroupSummary = useCallback((fromIndex: number, nextIndex: number) => {
    const fromQ = mcqQuestions[fromIndex];
    if (!fromQ) return;
    const parent = findParent(fromQ.id);
    const groupSubQs = parent
      ? mcqQuestions.filter((q) => findParent(q.id)?.id === parent.id)
      : [fromQ];
    setSummaryGroup(parent);
    setSummaryQuestions(groupSubQs);
    setPendingNextIndex(nextIndex);
    setMode("group-summary");
  }, [findParent, mcqQuestions]);

  if (mcqQuestions.length === 0) {
    return (
      <main id="main-content" className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-[var(--muted)]" aria-hidden />
          <p className="font-semibold text-[var(--foreground)]">No multiple choice questions</p>
          <p className="mt-1.5 text-sm text-[var(--muted)]">This paper doesn't have MCQ options yet.</p>
        </div>
      </main>
    );
  }

  if (mode === "group-summary") {
    const isFinalSubmit = pendingNextIndex >= mcqQuestions.length;
    const answeredCount = mcqQuestions.filter((q) => answers[q.id]).length;
    const allAnswered = answeredCount === mcqQuestions.length;
    return (
      <GroupSummaryView
        paper={paper}
        summaryGroup={summaryGroup}
        summaryQuestions={summaryQuestions}
        answers={answers}
        isLast={isFinalSubmit}
        submitting={submitting}
        submitError={submitError}
        onContinue={() => {
          if (isFinalSubmit) { onFinish(); return; }
          setIndex(pendingNextIndex);
          setMode("answering");
          setMobilePane("paper");
        }}
        onGoBack={() => {
          setMode("answering");
          // index already points to the last question of the summarised group
        }}
      />
    );
  }

  const current = mcqQuestions[index]!;
  const parent = findParent(current.id);
  const currentAnswer = answers[current.id] ?? null;
  const answeredCount = mcqQuestions.filter((q) => answers[q.id]).length;
  const allAnswered = answeredCount === mcqQuestions.length;
  const isLast = index === mcqQuestions.length - 1;
  const progress = Math.round((answeredCount / mcqQuestions.length) * 100);

  return (
    <main id="main-content" className="flex min-h-0 flex-1 flex-col">
      {/* Top bar */}
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--card)] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <Link
            href="/papers"
            aria-label="Back to papers"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--muted)] transition hover:bg-[var(--accent-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-[var(--muted)]">{paper.title} · {paper.paperLabel}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-strong)]">
                <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <span className="shrink-0 text-[11px] tabular-nums text-[var(--muted)]">{answeredCount}/{mcqQuestions.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="flex shrink-0 border-b border-[var(--border)] bg-[var(--card)] lg:hidden">
        {(["paper", "answer"] as const).map((pane) => (
          <button
            key={pane}
            type="button"
            onClick={() => setMobilePane(pane)}
            aria-pressed={mobilePane === pane}
            className={`flex flex-1 items-center justify-center py-3 text-sm font-semibold transition ${mobilePane === pane ? "border-b-2 border-[var(--accent)] text-[var(--accent)]" : "text-[var(--muted)]"}`}
          >
            {pane === "paper" ? "Exam Paper" : `Question ${index + 1}`}
          </button>
        ))}
      </div>

      {/* Two-pane body */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* LEFT: Full exam question */}
        <section
          className={`${mobilePane === "paper" ? "flex" : "hidden lg:flex"} min-w-0 flex-1 flex-col overflow-hidden border-r border-[var(--border)]`}
          aria-label="Full exam question"
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl px-5 py-6 sm:px-8">
              {parent ? (
                <>
                  <div className="mb-4 flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">{parent.topic}</span>
                    {parent.marks != null && (
                      <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">{parent.marks} marks</span>
                    )}
                  </div>
                  <div className="exam-desk-paper rounded-[1.5rem] p-5 sm:p-7">
                    <ExamQuestionPrompt prompt={parent.prompt} />
                  </div>
                  <p className="mt-3 px-1 text-xs text-[var(--muted)]">
                    Answer each sub-question in the panel on the right.
                  </p>
                </>
              ) : (
                <div className="exam-desk-paper rounded-[1.5rem] p-5 sm:p-7">
                  <ExamQuestionPrompt prompt={current.prompt} />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT: Sub-question + options + Kago */}
        <aside
          className={`${mobilePane === "answer" ? "flex" : "hidden lg:flex"} w-full shrink-0 flex-col overflow-hidden bg-[var(--card)] lg:w-[460px] xl:w-[520px]`}
          aria-label="Answer this sub-question"
        >
          {/* Sub-question counter */}
          <div className="shrink-0 border-b border-[var(--border)] px-5 py-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
              Sub-question {index + 1} of {mcqQuestions.length}
            </span>
            {current.marks != null && (
              <span className="ml-2 text-[11px] text-[var(--muted)]">({current.marks} {current.marks === 1 ? "mark" : "marks"})</span>
            )}
          </div>

          {/* Scrollable body */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="px-5 py-5 sm:px-6">

              {/* Stem */}
              <div className="exam-desk-paper mb-5 rounded-2xl p-4 sm:p-5">
                <MathContent content={current.prompt} className="text-sm" />
              </div>

              {/* Options */}
              <ul className="space-y-2.5" role="radiogroup" aria-label="Answer options">
                {current.options.map((opt) => {
                  const selected = currentAnswer === opt.id;
                  return (
                    <li key={opt.id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => { onAnswer(current.id, opt.id); setMobilePane("answer"); }}
                        className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)] ${
                          selected
                            ? "border-[var(--accent)] bg-[var(--accent-muted)] shadow-sm"
                            : "border-[var(--border)] bg-[var(--background)] hover:border-[var(--accent)]/40 hover:bg-[color-mix(in_oklab,var(--accent)_3%,var(--card))]"
                        }`}
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold uppercase transition-all ${selected ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)] text-[var(--muted)]"}`}>
                          {opt.id}
                        </span>
                        <MathContent content={opt.text} className="flex-1 text-sm" />
                      </button>
                    </li>
                  );
                })}
              </ul>

              {submitError && (
                <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300" role="alert">
                  {submitError}
                </p>
              )}

              {/* Kago hint panel */}
              {paper.tutorChatEnabled && (
                <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => { setKagoOpen((v) => !v); setTimeout(() => kagoInputRef.current?.focus(), 80); }}
                    className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-[var(--surface-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
                  >
                    <span className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
                      <Bot className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden />
                      Stuck? Ask Kago for a hint
                    </span>
                    <ChevronRight className={`h-3.5 w-3.5 text-[var(--muted)] transition-transform duration-200 ${kagoOpen ? "rotate-90" : ""}`} aria-hidden />
                  </button>

                  {kagoOpen && (
                    <div className="border-t border-[var(--border)]">
                      {/* Messages */}
                      <div className="space-y-3 p-4">
                        {kagoMessages.length === 0 && (
                          <p className="text-xs text-[var(--muted)]">
                            Ask me for a hint — I won't give the answer away, but I'll help you think it through.
                          </p>
                        )}
                        {kagoMessages.map((m) => (
                          <div key={m._id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                            {m.role === "assistant" ? (
                              <div className="flex max-w-[94%] items-start gap-2">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-[10px] font-bold text-white">K</div>
                                <div className="rounded-2xl rounded-tl-sm border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
                                  <MathContent content={m.content} className="text-xs" />
                                </div>
                              </div>
                            ) : (
                              <div className="max-w-[86%] rounded-2xl rounded-tr-sm bg-[var(--accent)] px-3 py-2 text-xs leading-relaxed text-white">
                                {m.content}
                              </div>
                            )}
                          </div>
                        ))}
                        {kagoPending && (
                          <div className="flex items-start gap-2">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-[10px] font-bold text-white">K</div>
                            <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5">
                              {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--muted)]" style={{ animationDelay: `${i * 160}ms` }} />)}
                              <span className="sr-only">Kago is thinking</span>
                            </div>
                          </div>
                        )}
                        {kagoError && <p className="text-xs text-red-500" role="alert">{kagoError}</p>}
                        <div ref={kagoBottomRef} />
                      </div>
                      {/* Input */}
                      <div className="flex items-end gap-2 border-t border-[var(--border)] p-3">
                        <label htmlFor="quiz-kago-input" className="sr-only">Ask Kago for a hint</label>
                        <textarea
                          ref={kagoInputRef}
                          id="quiz-kago-input"
                          rows={2}
                          value={kagoInput}
                          onChange={(e) => setKagoInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendKago(); } }}
                          placeholder="Ask for a hint…"
                          disabled={kagoPending}
                          className="min-h-[2.75rem] min-w-0 flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)] disabled:opacity-60"
                        />
                        <button
                          type="button"
                          onClick={() => void sendKago()}
                          disabled={kagoPending || !kagoInput.trim()}
                          aria-label="Send"
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
                        >
                          {kagoPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Nav footer */}
          <div className="shrink-0 border-t border-[var(--border)] bg-[var(--card)] px-5 py-3">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                className="flex h-11 items-center gap-2 rounded-full border border-[var(--border)] px-4 text-sm font-semibold text-[var(--foreground)] transition enabled:hover:bg-[var(--accent-muted)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Back
              </button>

              {isLast ? (
                <button
                  type="button"
                  onClick={() => triggerGroupSummary(index, mcqQuestions.length)}
                  disabled={!allAnswered || submitting}
                  className="flex h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-bold text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
                >
                  {allAnswered
                    ? <><CheckCircle2 className="h-4 w-4" aria-hidden />Finish Quiz</>
                    : `${mcqQuestions.length - answeredCount} unanswered`
                  }
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const nextIdx = index + 1;
                    const currentParent = findParent(current.id);
                    const nextParent = mcqQuestions[nextIdx] ? findParent(mcqQuestions[nextIdx]!.id) : null;
                    if (currentParent?.id !== nextParent?.id) {
                      triggerGroupSummary(index, nextIdx);
                    } else {
                      setIndex(nextIdx);
                      setMobilePane("answer");
                    }
                  }}
                  className="flex h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-bold text-white transition hover:bg-[var(--accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
                >
                  Next
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

// ── Phase 2: Results ─────────────────────────────────────────────────────────

function ResultsPhase({
  paper, result, onRetry, onReviewOne, onReviewAll,
}: {
  paper: TutorPaper;
  result: AttemptResultPayload;
  onRetry: () => void;
  onReviewOne: (questionId: string) => void;
  onReviewAll: () => void;
}) {
  const { headline, sub } = scoreMessage(result.correct, result.total);
  const pct = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0;
  const wrongCount = result.reviews.filter((r) => !r.isCorrect).length;
  const barColor = pct >= 80 ? "bg-[var(--teal)]" : pct >= 50 ? "bg-[var(--accent)]" : "bg-[var(--warning)]";

  return (
    <main id="main-content" className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">

        {/* Score hero */}
        <div className="mb-6 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
          <div className="p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{paper.title} · {paper.paperLabel}</p>
            <div className="mt-4 flex items-end gap-5">
              <div>
                <p className="text-5xl font-bold tabular-nums leading-none text-[var(--foreground)]">
                  {result.correct}
                  <span className="text-2xl font-semibold text-[var(--muted)]">/{result.total}</span>
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">{pct}% correct</p>
              </div>
              <div className="mb-1 flex-1">
                <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-strong)]">
                  <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
            <p className="mt-5 text-lg font-semibold text-[var(--foreground)]">{headline}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{sub}</p>
          </div>

          <div className="flex flex-wrap gap-3 border-t border-[var(--border)] px-6 py-4 sm:px-8">
            {wrongCount > 0 && (
              <button
                type="button"
                onClick={onReviewAll}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
              >
                <Bot className="h-4 w-4" aria-hidden />
                Review {wrongCount} incorrect with Kago
              </button>
            )}
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--accent-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              {wrongCount > 0 ? "Retry quiz" : "Try again"}
            </button>
          </div>
        </div>

        {/* Per-question list */}
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Question by question</p>
        <div className="space-y-2">
          {paper.questions.map((q, qi) => {
            const review = result.reviews.find((r) => r.questionId === q.id);
            if (!review) return null;
            const isCorrect = review.isCorrect;
            const chosenOpt = q.options.find((o) => o.id === review.chosenOptionId);
            const correctOpt = q.options.find((o) => o.id === review.correctOptionId);

            return (
              <div
                key={q.id}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-colors ${isCorrect ? "border-[var(--teal)]/30 bg-[var(--teal-muted)]" : "border-[var(--border)] bg-[var(--card)]"}`}
              >
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isCorrect ? "bg-[var(--teal)] text-white" : "bg-[var(--danger)] text-white"}`}>
                  {isCorrect
                    ? <CheckCircle2 className="h-4 w-4" aria-hidden />
                    : <XCircle className="h-4 w-4" aria-hidden />
                  }
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[var(--muted)]">Q{qi + 1}{q.topic ? ` · ${q.topic}` : ""}</p>
                  {isCorrect ? (
                    <p className="mt-0.5 text-xs font-medium text-[var(--teal)]">Correct</p>
                  ) : (
                    <p className="mt-0.5 text-xs text-[var(--foreground)]">
                      {"You: "}
                      <span className="font-bold uppercase">{review.chosenOptionId ?? "—"}</span>
                      {chosenOpt ? ` (${chosenOpt.text.slice(0, 35)}${chosenOpt.text.length > 35 ? "…" : ""})` : ""}
                      {" · Answer: "}
                      <span className="font-bold uppercase text-[var(--teal)]">{review.correctOptionId ?? "—"}</span>
                      {correctOpt ? ` (${correctOpt.text.slice(0, 35)}${correctOpt.text.length > 35 ? "…" : ""})` : ""}
                    </p>
                  )}
                </div>

                {!isCorrect && (
                  <button
                    type="button"
                    onClick={() => onReviewOne(q.id)}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[var(--accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
                  >
                    <Bot className="h-3.5 w-3.5" aria-hidden />
                    Ask Kago
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

// ── Phase 3: Review ──────────────────────────────────────────────────────────

function ReviewPhase({
  paper, result, startQuestionId, onBack,
}: {
  paper: TutorPaper;
  result: AttemptResultPayload;
  startQuestionId: string;
  onBack: () => void;
}) {
  const wrongItems = paper.questions
    .map((q) => {
      const rev = result.reviews.find((r) => r.questionId === q.id && !r.isCorrect);
      return rev ? { question: q, review: rev } : null;
    })
    .filter((x): x is { question: TutorQuestion; review: QuestionReviewPayload } => x !== null);

  const initialIdx = Math.max(0, wrongItems.findIndex((w) => w.question.id === startQuestionId));
  const [reviewIndex, setReviewIndex] = useState(initialIdx);
  const [mobilePane, setMobilePane] = useState<MobilePane>("question");
  const [breakdown, setBreakdown] = useState<QuestionBreakdown | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownError, setBreakdownError] = useState<string | null>(null);
  const [stagesRevealed, setStagesRevealed] = useState(1);
  const [memoOpen, setMemoOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatPending, setChatPending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatIdRef = useRef(0);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  const { activeKey: activeSpeechKey, stop: stopSpeech, toggle: toggleSpeech } = useSpeech();

  const current = wrongItems[reviewIndex];

  // Auto-fetch breakdown when question changes
  useEffect(() => {
    if (!current) return;
    setBreakdown(null);
    setBreakdownError(null);
    setStagesRevealed(1);
    setChatMessages([]);
    setChatInput("");
    setChatError(null);
    setMemoOpen(false);
    setGenerateOpen(false);
    stopSpeech();
    setBreakdownLoading(true);

    const { question, review } = current;
    const chosenOpt = question.options.find((o) => o.id === review.chosenOptionId);
    const correctOpt = question.options.find((o) => o.id === review.correctOptionId);
    const studentAttempt = review.chosenOptionId
      ? `I selected option ${review.chosenOptionId}${chosenOpt ? `: "${chosenOpt.text}"` : ""}. The correct answer is option ${review.correctOptionId ?? "unknown"}${correctOpt ? `: "${correctOpt.text}"` : ""}.`
      : "I did not select an answer.";

    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchQuestionBreakdown(paper.id, question.id, studentAttempt);
        if (!cancelled) { setBreakdown(data); setBreakdownLoading(false); }
      } catch (e) {
        if (!cancelled) { setBreakdownError(e instanceof Error ? e.message : "Could not load walkthrough."); setBreakdownLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewIndex]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatPending]);

  const navigateTo = useCallback((idx: number) => {
    setReviewIndex(idx);
    setMobilePane("question");
  }, []);

  const sendChat = useCallback(async (overrideText?: string) => {
    if (!current) return;
    const text = (overrideText ?? chatInput).trim();
    if (!text || chatPending || !paper.tutorChatEnabled) return;
    const userMsg: ChatMessage = { role: "user", content: text, _id: chatIdRef.current++ };
    const thread = [...chatMessages, userMsg];
    setChatMessages(thread);
    setChatInput("");
    setChatPending(true);
    setChatError(null);
    try {
      const { reply } = await postTutorChat(paper.id, current.question.id, thread.map(({ role, content }) => ({ role, content })));
      setChatMessages((prev) => [...prev, { role: "assistant", content: reply, _id: chatIdRef.current++ }]);
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Something went wrong.");
      setChatMessages((prev) => prev.slice(0, -1));
    } finally {
      setChatPending(false);
    }
  }, [chatInput, chatMessages, chatPending, current, paper.id, paper.tutorChatEnabled]);

  const handleSuggestion = useCallback((text: string) => {
    if (!paper.tutorChatEnabled) return;
    setMobilePane("ai");
    void sendChat(text);
    setTimeout(() => chatInputRef.current?.focus(), 50);
  }, [paper.tutorChatEnabled, sendChat]);

  if (!current || wrongItems.length === 0) {
    return (
      <main id="main-content" className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-[var(--teal)]" aria-hidden />
          <p className="font-semibold text-[var(--foreground)]">All correct!</p>
          <button type="button" onClick={onBack} className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--accent-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]">Back to results</button>
        </div>
      </main>
    );
  }

  const allStagesComplete = stagesRevealed >= STAGES.length;

  return (
    <main id="main-content" className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Review nav */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--card)] px-4 py-2 sm:px-5">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--accent-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          Results
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-xs font-semibold text-[var(--muted)]">Reviewing incorrect · {reviewIndex + 1} of {wrongItems.length}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => navigateTo(Math.max(0, reviewIndex - 1))} disabled={reviewIndex === 0} aria-label="Previous incorrect question" className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--muted)] transition enabled:hover:bg-[var(--accent-muted)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" onClick={() => navigateTo(Math.min(wrongItems.length - 1, reviewIndex + 1))} disabled={reviewIndex === wrongItems.length - 1} aria-label="Next incorrect question" className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--muted)] transition enabled:hover:bg-[var(--accent-muted)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="flex shrink-0 border-b border-[var(--border)] bg-[var(--card)] lg:hidden">
        {(["question", "ai"] as const).map((pane) => (
          <button key={pane} type="button" onClick={() => setMobilePane(pane)} aria-pressed={mobilePane === pane} className={`flex flex-1 items-center justify-center py-3 text-sm font-semibold transition ${mobilePane === pane ? "border-b-2 border-[var(--accent)] text-[var(--accent)]" : "text-[var(--muted)]"}`}>
            {pane === "question" ? "Question" : "Kago"}
          </button>
        ))}
      </div>

      {/* 2-pane */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* LEFT: Question read-only */}
        <section className={`${mobilePane === "question" ? "flex" : "hidden lg:flex"} min-w-0 flex-1 flex-col overflow-hidden border-r border-[var(--border)]`} aria-label="Question">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl px-5 py-6 sm:px-8">

              {/* Answer comparison banner */}
              <div className="mb-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
                <div className="flex items-center gap-2.5 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--danger)_5%,var(--card))] px-4 py-2.5">
                  <XCircle className="h-4 w-4 shrink-0 text-[var(--danger)]" aria-hidden />
                  <p className="text-sm font-semibold text-[var(--foreground)]">Incorrect answer</p>
                </div>
                <div className="grid grid-cols-2 divide-x divide-[var(--border)]">
                  <div className="px-4 py-3">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--danger)]">You chose</p>
                    <p className="font-bold uppercase text-[var(--foreground)]">{current.review.chosenOptionId ?? "—"}</p>
                    {(() => { const o = current.question.options.find((x) => x.id === current.review.chosenOptionId); return o ? <MathContent content={o.text} className="mt-0.5 text-xs text-[var(--muted)]" /> : null; })()}
                  </div>
                  <div className="px-4 py-3">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--teal)]">Correct answer</p>
                    <p className="font-bold uppercase text-[var(--teal)]">{current.review.correctOptionId ?? "—"}</p>
                    {(() => { const o = current.question.options.find((x) => x.id === current.review.correctOptionId); return o ? <MathContent content={o.text} className="mt-0.5 text-xs text-[var(--muted)]" /> : null; })()}
                  </div>
                </div>
              </div>

              {/* Question prompt */}
              <div className="exam-desk-paper rounded-[1.5rem] p-5 sm:p-7">
                <ExamQuestionPrompt prompt={current.question.prompt} />
              </div>

              {/* Options (read-only) */}
              {current.question.options.length > 0 && (
                <ul className="mt-5 space-y-2.5" role="list">
                  {current.question.options.map((opt) => {
                    const chosen = opt.id === current.review.chosenOptionId;
                    const correct = opt.id === current.review.correctOptionId;
                    return (
                      <li key={opt.id}>
                        <div className={`flex items-center gap-4 rounded-2xl border-2 px-5 py-3.5 ${correct ? "border-[var(--teal)]/60 bg-[var(--teal-muted)]" : chosen ? "border-[var(--danger)]/35 bg-[color-mix(in_oklab,var(--danger)_5%,var(--card))]" : "border-[var(--border)] bg-[var(--card)] opacity-50"}`}>
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold uppercase ${correct ? "border-[var(--teal)] bg-[var(--teal)] text-white" : chosen ? "border-[var(--danger)] bg-[var(--danger)] text-white" : "border-[var(--border)] text-[var(--muted)]"}`}>
                            {opt.id}
                          </span>
                          <MathContent content={opt.text} className="flex-1 text-sm" />
                          {correct && <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-[var(--teal)]" aria-hidden />}
                          {chosen && !correct && <XCircle className="ml-auto h-4 w-4 shrink-0 text-[var(--danger)]" aria-hidden />}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT: Kago walkthrough + chat */}
        <aside className={`${mobilePane === "ai" ? "flex" : "hidden lg:flex"} w-full shrink-0 flex-col overflow-hidden bg-[var(--card)] lg:w-[520px] xl:w-[600px]`} aria-label="Kago AI Tutor">
          {/* Header */}
          <div className="shrink-0 border-b border-[var(--border)] px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-muted)]">
                <Bot className="h-4 w-4 text-[var(--accent)]" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">Kago · AI Tutor</p>
                <p className="text-xs text-[var(--muted)]">{current.question.topic || "Exam question"} · Breaking down your mistake</p>
              </div>
            </div>
          </div>

          {/* Scroll area */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-3 p-4 sm:p-5">

              {/* Loading */}
              {breakdownLoading && (
                <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
                  <div className="relative">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-muted)]">
                      <Bot className="kago-thinking h-7 w-7 text-[var(--accent)]" aria-hidden />
                    </div>
                    <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)]">
                      <Sparkles className="h-2.5 w-2.5 text-white" aria-hidden />
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">Kago is preparing your walkthrough</p>
                    <p className="mt-0.5 text-sm text-[var(--muted)]">Analysing where it went wrong…</p>
                  </div>
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-[var(--accent)]/40" style={{ animationDelay: `${i * 180}ms` }} />)}
                  </div>
                </div>
              )}

              {/* Error */}
              {breakdownError && !breakdownLoading && (
                <div className="rounded-2xl border border-[var(--border)] p-5 text-center">
                  <p className="text-sm text-[var(--danger)]">{breakdownError}</p>
                </div>
              )}

              {/* Walkthrough */}
              {breakdown && !breakdownLoading && (
                <div className="space-y-3">
                  {breakdown.personalizedFeedback && (
                    <div className="rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent-muted)] p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-sm font-bold text-white">K</div>
                        <MathContent content={breakdown.personalizedFeedback} className="text-sm" />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 px-1">
                    {STAGES.map((_, i) => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${i < stagesRevealed ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`} />
                    ))}
                    <span className="shrink-0 text-[11px] font-semibold tabular-nums text-[var(--muted)]">{stagesRevealed}/{STAGES.length}</span>
                  </div>

                  {STAGES.slice(0, stagesRevealed).map((stage, i) => {
                    const content = breakdown[stage.key];
                    if (!content?.trim()) return null;
                    const speechKey = `review-${current.question.id}-${stage.key}`;
                    return (
                      <StageCard
                        key={stage.key}
                        stage={stage}
                        content={content}
                        isActive={i === stagesRevealed - 1}
                        isComplete={i < stagesRevealed - 1}
                        isLast={stage.num === STAGES.length}
                        allComplete={allStagesComplete}
                        onContinue={() => setStagesRevealed((p) => Math.min(p + 1, STAGES.length))}
                        onSuggest={handleSuggestion}
                        speechKey={speechKey}
                        activeSpeechKey={activeSpeechKey}
                        onSpeak={toggleSpeech}
                      />
                    );
                  })}

                  {chatMessages.length > 0 && <hr className="border-[var(--border)]" />}
                </div>
              )}

              {/* Chat */}
              <div className="space-y-3">
                {chatMessages.map((m) => (
                  <div key={m._id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    {m.role === "assistant" ? (
                      <div className="flex max-w-[94%] items-start gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-xs font-bold text-white">K</div>
                        <div className="rounded-2xl rounded-tl-sm border border-[var(--border)] bg-[var(--surface-soft)] px-3.5 py-2.5">
                          <span className="sr-only">Kago: </span>
                          <MathContent content={m.content} className="text-sm" />
                        </div>
                      </div>
                    ) : (
                      <div className="max-w-[86%] rounded-2xl rounded-tr-sm bg-[var(--accent)] px-3.5 py-2.5 text-sm leading-relaxed text-white">
                        <span className="sr-only">You: </span>
                        <span className="whitespace-pre-wrap break-words">{m.content}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {chatPending && (
                <div className="flex items-start gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-xs font-bold text-white">K</div>
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-[var(--border)] bg-[var(--surface-soft)] px-3.5 py-3">
                    {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--muted)]" style={{ animationDelay: `${i * 160}ms` }} />)}
                    <span className="sr-only">Kago is thinking</span>
                  </div>
                </div>
              )}

              {chatError && <p className="text-xs text-red-500" role="alert">{chatError}</p>}
              <div ref={chatBottomRef} />
            </div>
          </div>

          {/* Collapsible panels */}
          <div className="shrink-0 border-t border-[var(--border)]">
            <button type="button" onClick={() => setMemoOpen((v) => !v)} className="flex w-full items-center justify-between px-5 py-3 text-left transition hover:bg-[var(--surface-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]">
              <span className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
                <Target className="h-3.5 w-3.5 text-[var(--teal)]" aria-hidden />
                Compare with memo
              </span>
              <ChevronRight className={`h-3.5 w-3.5 text-[var(--muted)] transition-transform duration-200 ${memoOpen ? "rotate-90" : ""}`} aria-hidden />
            </button>
            {memoOpen && (
              <div className="border-t border-[var(--border)] px-5 pb-4 pt-3">
                <MemoGuidancePanel memoAnswer={current.question.memoAnswer} />
              </div>
            )}
            <div className="border-t border-[var(--border)]">
              <button type="button" onClick={() => setGenerateOpen((v) => !v)} className="flex w-full items-center justify-between px-5 py-3 text-left transition hover:bg-[var(--surface-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]">
                <span className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
                  <Layers3 className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden />
                  Generate study material
                </span>
                <ChevronRight className={`h-3.5 w-3.5 text-[var(--muted)] transition-transform duration-200 ${generateOpen ? "rotate-90" : ""}`} aria-hidden />
              </button>
              {generateOpen && (
                <div className="flex flex-wrap gap-2 border-t border-[var(--border)] px-5 pb-4 pt-3">
                  <GeneratorButton kind="revision"   subjectId={paper.subjectId} paperId={paper.id} questionId={current.question.id} topic={current.question.topic}>Revision pack</GeneratorButton>
                  <GeneratorButton kind="flashcards" subjectId={paper.subjectId} paperId={paper.id} questionId={current.question.id} topic={current.question.topic}>Flashcard deck</GeneratorButton>
                  <GeneratorButton kind="quiz"       subjectId={paper.subjectId} paperId={paper.id} topic={current.question.topic}>Mini quiz</GeneratorButton>
                </div>
              )}
            </div>
          </div>

          {/* Chat input */}
          {paper.tutorChatEnabled && (
            <div className="shrink-0 border-t border-[var(--border)] p-3">
              <div className="flex items-end gap-2">
                <label htmlFor="review-chat-input" className="sr-only">Message Kago</label>
                <textarea
                  ref={chatInputRef}
                  id="review-chat-input"
                  rows={2}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendChat(); } }}
                  placeholder="Ask Kago anything about this question…"
                  disabled={chatPending}
                  className="min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)] disabled:opacity-60"
                />
                <button type="button" onClick={() => void sendChat()} disabled={chatPending || !chatInput.trim()} aria-label="Send message" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]">
                  {chatPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────

export function TutorRunner({ paper }: { paper: TutorPaper }) {
  const [phase, setPhase] = useState<Phase>("quiz");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AttemptResultPayload | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reviewStartId, setReviewStartId] = useState<string>("");

  const mcqQuestions = paper.questions.filter((q) => q.options.length > 0);

  const handleAnswer = useCallback((questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  }, []);

  const handleFinish = useCallback(() => {
    if (submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    void (async () => {
      try {
        const r = await submitAttempt(
          paper.id,
          0,
          mcqQuestions.map((q) => ({ questionId: q.id, optionId: answers[q.id] ?? "" })),
        );
        setResult(r);
        setPhase("results");
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : "Could not submit quiz.");
      } finally {
        setSubmitting(false);
      }
    })();
  }, [answers, mcqQuestions, paper.id, submitting]);

  const handleRetry = useCallback(() => {
    setAnswers({});
    setResult(null);
    setSubmitError(null);
    setReviewStartId("");
    setPhase("quiz");
  }, []);

  const handleReviewOne = useCallback((questionId: string) => {
    setReviewStartId(questionId);
    setPhase("review");
  }, []);

  const handleReviewAll = useCallback(() => {
    const first = paper.questions.find((q) =>
      result?.reviews.find((r) => r.questionId === q.id && !r.isCorrect),
    );
    if (first) { setReviewStartId(first.id); setPhase("review"); }
  }, [paper.questions, result]);

  if (phase === "quiz" || !result) {
    return <QuizPhase paper={paper} answers={answers} onAnswer={handleAnswer} onFinish={handleFinish} submitting={submitting} submitError={submitError} />;
  }
  if (phase === "results") {
    return <ResultsPhase paper={paper} result={result} onRetry={handleRetry} onReviewOne={handleReviewOne} onReviewAll={handleReviewAll} />;
  }
  return <ReviewPhase paper={paper} result={result} startQuestionId={reviewStartId} onBack={() => setPhase("results")} />;
}
