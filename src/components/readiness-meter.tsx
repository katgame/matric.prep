import type { AnalyticsOverview } from "@/lib/types";

export function ReadinessMeter({ overview }: { overview: AnalyticsOverview }) {
  const readiness = Math.max(0, Math.min(100, overview.readinessPercent));
  return (
    <section className="ai-card rounded-[2rem] p-6" aria-labelledby="readiness-heading">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Readiness</p>
      <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="readiness-heading" className="font-[family-name:var(--font-fraunces)] text-5xl font-semibold text-[var(--foreground)]">
            {readiness}%
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Based on {overview.questionsAnswered} scorable answer(s) across {overview.attempts} attempt(s).
          </p>
        </div>
        <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--surface-strong)] sm:max-w-md">
          <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${readiness}%` }} />
        </div>
      </div>
    </section>
  );
}
