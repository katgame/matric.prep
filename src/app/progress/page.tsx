import { AppHeader } from "@/components/app-header";
import { ReadinessMeter } from "@/components/readiness-meter";
import { fetchAnalyticsOverview } from "@/lib/api";

export default async function ProgressPage() {
  const overview = await fetchAnalyticsOverview().catch(() => ({
    readinessPercent: 0,
    attempts: 0,
    questionsAnswered: 0,
    correctAnswers: 0,
    weakTopics: [],
    strongTopics: [],
    nextActions: [],
  }));

  return (
    <div className="ai-shell flex min-h-full flex-col">
      <AppHeader title="Progress" />
      <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <ReadinessMeter overview={overview} />
        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="ai-card rounded-[2rem] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Weak topics</p>
            <ul className="mt-5 space-y-3">
              {overview.weakTopics.length ? overview.weakTopics.map((topic) => (
                <li key={`${topic.subjectId}-${topic.topic}`} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                  <p className="font-semibold text-[var(--foreground)]">{topic.topic}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{topic.percent}% across {topic.attempts} answer(s)</p>
                </li>
              )) : <li className="text-sm text-[var(--muted)]">Submit attempts to reveal weak topics.</li>}
            </ul>
          </div>
          <div className="ai-card rounded-[2rem] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--teal)]">Strong topics</p>
            <ul className="mt-5 space-y-3">
              {overview.strongTopics.length ? overview.strongTopics.map((topic) => (
                <li key={`${topic.subjectId}-${topic.topic}`} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                  <p className="font-semibold text-[var(--foreground)]">{topic.topic}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{topic.percent}% across {topic.attempts} answer(s)</p>
                </li>
              )) : <li className="text-sm text-[var(--muted)]">Correct answers will appear here.</li>}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
