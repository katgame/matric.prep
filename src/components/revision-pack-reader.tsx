import type { RevisionPack } from "@/lib/types";

export function RevisionPackReader({ pack }: { pack: RevisionPack }) {
  const sections = pack.content.sections ?? [];
  const mistakes = pack.content.commonMistakes ?? [];
  const drills = pack.content.drills ?? [];

  return (
    <article className="ai-card rounded-[2rem] p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">{pack.topic}</p>
      <h1 className="ai-glow-text mt-3 font-[family-name:var(--font-fraunces)] text-4xl font-semibold text-[var(--foreground)]">
        {pack.title}
      </h1>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)]">{pack.summary}</p>

      <div className="mt-8 grid gap-4">
        {sections.map((section, index) => (
          <section key={`${section.title}-${index}`} className="ai-reading-surface rounded-[1.5rem] p-5">
            <h2 className="text-xl font-semibold">{section.title}</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{section.body}</p>
          </section>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-soft)] p-5">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Common mistakes</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[var(--muted)]">
            {mistakes.length ? mistakes.map((item, i) => <li key={`${item}-${i}`}>{item}</li>) : <li>No mistakes captured yet.</li>}
          </ul>
        </section>
        <section className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-soft)] p-5">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Linked drills</h2>
          <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
            {drills.length ? drills.map((item) => <li key={item} className="break-all">{item}</li>) : <li>No linked questions yet.</li>}
          </ul>
        </section>
      </div>
    </article>
  );
}
