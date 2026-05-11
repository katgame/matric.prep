import { BookOpenCheck } from "lucide-react";
import { parseMemoAnswer } from "@/lib/memo-format";

type MemoGuidancePanelProps = {
  memoAnswer: string | null | undefined;
};

export function MemoGuidancePanel({ memoAnswer }: MemoGuidancePanelProps) {
  const parsed = parseMemoAnswer(memoAnswer);

  if (!parsed || parsed.blocks.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-4 shadow-sm sm:p-5">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          <BookOpenCheck className="h-4 w-4 text-[var(--teal)]" aria-hidden />
          Memo guidance
        </p>
        <p className="mt-3 text-sm leading-relaxed text-[var(--foreground)]">
          {memoAnswer?.trim()
            ? memoAnswer
            : "No memorandum text was imported for this question yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-4 shadow-sm sm:p-5">
      <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        <BookOpenCheck className="h-4 w-4 text-[var(--teal)]" aria-hidden />
        Memo guidance
      </p>

      {parsed.questionLead ? (
        <p className="mt-3 rounded-lg border border-[var(--teal)]/25 bg-[var(--teal-muted)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]">
          {parsed.questionLead}
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        {parsed.blocks.map((block, index) => (
          <section
            key={`${block.label}-${index}`}
            className="rounded-xl border border-[var(--teal)]/25 bg-[color-mix(in_oklab,var(--teal)_6%,var(--card))] p-4 sm:p-5"
            aria-labelledby={`memo-block-${index}`}
          >
            <h4 id={`memo-block-${index}`} className="text-sm font-semibold leading-snug text-[var(--foreground)]">
              {block.label}
            </h4>
            {block.body ? (
              <div className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--foreground)]">
                {block.body}
              </div>
            ) : null}
          </section>
        ))}
      </div>

      <div className="mt-4 space-y-2 text-xs text-[var(--muted)]">
        {parsed.hadTruncationMarker ? (
          <p>
            The memorandum excerpt may be shortened in the database. Open the official memo PDF from your session files
            for the full marking grid and notes.
          </p>
        ) : null}
        {parsed.strippedFooter ? (
          <p>Footer lines (copyright / page instructions) are hidden here so the marking content stays in focus.</p>
        ) : null}
      </div>
    </div>
  );
}
