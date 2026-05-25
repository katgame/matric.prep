import { ListOrdered } from "lucide-react";
import {
  insertSubQuestionSpacing,
  parseExamPrompt,
  splitExcerptIntoSections,
  type ExcerptSection,
} from "@/lib/exam-prompt-format";
import { stripMemoFooter } from "@/lib/memo-format";
import { MathContent } from "@/components/math-content";

function SectionCard({ section, index }: { section: ExcerptSection; index: number }) {
  const base = "rounded-xl border p-4 text-sm leading-relaxed text-[var(--foreground)] sm:p-5";
  const headingId = `exam-q-sec-${index}`;

  const style =
    section.key === "required"
      ? "border-[var(--accent)]/35 bg-[color-mix(in_oklab,var(--accent)_8%,var(--card))]"
      : section.key === "information"
        ? "border-dashed border-[var(--border)] bg-[var(--card)]"
        : section.key === "note"
          ? "border-[var(--border)] bg-[var(--background)]"
          : section.key === "questionHeading"
            ? "border-[var(--border)] bg-[var(--paper)]"
            : "border-[var(--border)] bg-[var(--paper)]";

  return (
    <section className={`${base} ${style}`} aria-labelledby={headingId}>
      <h3 id={headingId} className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {section.title}
      </h3>
      <div className="mt-3 whitespace-pre-wrap break-words">{section.body}</div>
    </section>
  );
}

type ExamQuestionPromptProps = {
  prompt: string;
};

export function ExamQuestionPrompt({ prompt }: ExamQuestionPromptProps) {
  // Vision-extracted questions are prefixed with [latex]\n
  if (prompt.startsWith("[latex]\n")) {
    const content = prompt.slice("[latex]\n".length);
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-5 shadow-sm">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            From the question paper
          </p>
          <MathContent content={content} />
        </div>
        <p className="px-1 text-xs text-[var(--muted)]">
          Use the official PDF for diagrams, tables, and any figures not shown above.
        </p>
      </div>
    );
  }

  const parsed = parseExamPrompt(prompt);

  if (parsed.kind === "plain") {
    const plain = stripMemoFooter(parsed.text);
    const spaced = insertSubQuestionSpacing(plain.text);
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-4 shadow-sm sm:p-5">
        <MathContent content={spaced} className="text-sm" />
      </div>
    );
  }

  const sections = splitExcerptIntoSections(parsed.excerpt);

  return (
    <div className="space-y-4">
      {(parsed.topic || parsed.subQuestionRefs.length > 0) && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-4 shadow-sm sm:p-5">
          {parsed.topic ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Topic</p>
              <p className="mt-1 font-[family-name:var(--font-fraunces)] text-xl font-semibold leading-snug text-[var(--foreground)]">
                {parsed.topic}
              </p>
            </div>
          ) : null}

          {parsed.subQuestionRefs.length > 0 ? (
            <div className={parsed.topic ? "mt-4" : ""}>
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                <ListOrdered className="h-4 w-4" aria-hidden />
                Parts in this question
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {parsed.subQuestionRefs.map((ref) => (
                  <li
                    key={ref}
                    className="inline-flex min-h-9 items-center rounded-full border border-[var(--border)] bg-[var(--background)] px-3 text-sm font-medium tabular-nums text-[var(--foreground)]"
                  >
                    {ref}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      <div className="space-y-3">
        {sections.map((sec, i) => (
          <SectionCard key={`${sec.title}-${i}`} section={sec} index={i} />
        ))}
      </div>

      {parsed.hadTruncationMarker ? (
        <p className="text-xs text-[var(--muted)]">
          This excerpt may be shortened in the question bank. Use the official PDF on the left for the full layout,
          tables, and all figures.
        </p>
      ) : null}
    </div>
  );
}
