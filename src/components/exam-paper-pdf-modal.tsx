"use client";

import { useEffect, useId, useRef } from "react";
import { ExternalLink, FileText, Loader2, X } from "lucide-react";

export type PdfModalStatus =
  | { kind: "none" }
  | { kind: "loading" }
  | { kind: "ready"; url: string }
  | { kind: "error"; message: string };

type ExamPaperPdfModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Tab "paper" = question paper; "memo" = marking guidelines PDF when available */
  activeTab: "paper" | "memo";
  onTabChange: (tab: "paper" | "memo") => void;
  paperStatus: PdfModalStatus;
  memoStatus: PdfModalStatus;
  hasMemoPdf: boolean;
  paperFileLabel: string | null;
  memoFileLabel: string | null;
};

export function ExamPaperPdfModal({
  open,
  onOpenChange,
  title,
  activeTab,
  onTabChange,
  paperStatus,
  memoStatus,
  hasMemoPdf,
  paperFileLabel,
  memoFileLabel,
}: ExamPaperPdfModalProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  const status = activeTab === "paper" ? paperStatus : memoStatus;
  const readyUrl = status.kind === "ready" ? status.url : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label="Close dialog"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[min(92dvh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-[var(--border)] bg-[var(--card)] shadow-lg sm:rounded-2xl"
      >
        <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 id={titleId} className="font-[family-name:var(--font-fraunces)] text-lg font-semibold text-[var(--foreground)]">
              {title}
            </h2>
            <p className="mt-1 truncate text-xs text-[var(--muted)]" title={activeTab === "paper" ? paperFileLabel ?? "" : memoFileLabel ?? ""}>
              {activeTab === "paper" ? paperFileLabel ?? "Question paper" : memoFileLabel ?? "Memorandum"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasMemoPdf ? (
              <div className="inline-flex rounded-full border border-[var(--border)] bg-[var(--background)] p-1">
                <button
                  type="button"
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    activeTab === "paper"
                      ? "bg-[var(--accent)] text-white"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                  onClick={() => onTabChange("paper")}
                >
                  Question paper
                </button>
                <button
                  type="button"
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    activeTab === "memo"
                      ? "bg-[var(--accent)] text-white"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                  onClick={() => onTabChange("memo")}
                >
                  Memo
                </button>
              </div>
            ) : null}
            {readyUrl ? (
              <a
                href={readyUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)] px-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--card)]"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
                Open
              </a>
            ) : null}
            <button
              ref={closeRef}
              type="button"
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] transition hover:bg-[var(--card)]"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 bg-[var(--background)]">
          {status.kind === "loading" ? (
            <div className="flex h-[min(75dvh,720px)] flex-col items-center justify-center gap-3 px-6">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" aria-hidden />
              <p className="text-sm text-[var(--muted)]">Loading PDF…</p>
            </div>
          ) : null}

          {status.kind === "ready" ? (
            <iframe
              title={activeTab === "paper" ? `${title} — question paper` : `${title} — memorandum`}
              src={`${status.url}#view=FitH`}
              className="h-[min(75dvh,720px)] w-full bg-white"
            />
          ) : null}

          {status.kind === "none" ? (
            <div className="flex h-[min(75dvh,720px)] flex-col items-center justify-center gap-3 px-8 text-center">
              <FileText className="h-9 w-9 text-[var(--muted)]" aria-hidden />
              <p className="max-w-prose text-sm text-[var(--muted)]">
                {activeTab === "memo"
                  ? "No memorandum PDF is attached for this paper."
                  : "No question paper PDF is attached for this paper."}
              </p>
            </div>
          ) : null}

          {status.kind === "error" ? (
            <div className="flex h-[min(75dvh,720px)] flex-col items-center justify-center gap-4 px-6">
              <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-left shadow-sm">
                <p className="text-sm font-semibold text-[var(--foreground)]">Could not load this PDF</p>
                <p className="mt-2 text-sm text-[var(--muted)]">{status.message}</p>
                <p className="mt-3 text-xs text-[var(--muted)]">
                  Set <code className="rounded bg-[var(--accent-muted)] px-1 py-0.5">MatricPrep:ExamPapersRoot</code> (or{" "}
                  <code className="rounded bg-[var(--accent-muted)] px-1 py-0.5">MATRICPREP_EXAM_PAPERS_ROOT</code>) to your
                  local <code className="rounded bg-[var(--accent-muted)] px-1 py-0.5">exam-papers</code> folder, then restart
                  the API.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
