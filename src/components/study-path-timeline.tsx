import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import type { StudyPlan } from "@/lib/types";

export function StudyPathTimeline({ plan }: { plan: StudyPlan | null }) {
  if (!plan) {
    return (
      <div className="ai-card rounded-[2rem] p-6">
        <p className="text-lg font-semibold text-[var(--foreground)]">No active study path yet</p>
        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
          Generate a subject plan to combine revision packs, flashcards, quizzes, and papers into one route.
        </p>
        <Link href="/study-path" className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[var(--accent)] px-5 text-sm font-bold text-white">
          Generate path
        </Link>
      </div>
    );
  }

  return (
    <section className="ai-card rounded-[2rem] p-6" aria-labelledby="study-path-heading">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Current path</p>
      <h2 id="study-path-heading" className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{plan.title}</h2>
      <ol className="mt-5 space-y-3">
        {plan.steps.slice(0, 6).map((step) => (
          <li key={step.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
            <div className="flex gap-3">
              {step.isCompleted ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--teal)]" aria-hidden />
              ) : (
                <Circle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" aria-hidden />
              )}
              <div className="min-w-0">
                <p className="font-semibold text-[var(--foreground)]">{step.title}</p>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{step.description}</p>
                {step.toolRoute ? (
                  <Link href={step.toolRoute} className="mt-3 inline-flex text-sm font-bold text-[var(--accent)]">
                    Open tool
                  </Link>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
