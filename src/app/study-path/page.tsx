import { AppHeader } from "@/components/app-header";
import { GeneratorButton } from "@/components/platform-generators";
import { StudyPathTimeline } from "@/components/study-path-timeline";
import { fetchCurrentStudyPlan, fetchSubjects } from "@/lib/api";

export default async function StudyPathPage() {
  const [subjects, plan] = await Promise.all([
    fetchSubjects().catch(() => []),
    fetchCurrentStudyPlan().catch(() => null),
  ]);
  const firstSubject = subjects[0]?.id ?? "accounting";

  return (
    <div className="ai-shell flex min-h-full flex-col">
      <AppHeader title="Study path" />
      <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="ai-card rounded-[2rem] p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Personalized route</p>
            <h1 className="ai-glow-text mt-3 font-[family-name:var(--font-fraunces)] text-4xl font-semibold text-[var(--foreground)]">
              Generate a TutorAI-style exam path.
            </h1>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              MatricPrep combines revision packs, flashcards, quizzes, and official papers into a sequence grounded in
              your available NSC content.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {subjects.slice(0, 4).map((subject) => (
                <GeneratorButton key={subject.id} kind="study-path" subjectId={subject.id}>
                  Generate {subject.label}
                </GeneratorButton>
              ))}
              {subjects.length === 0 ? <GeneratorButton kind="study-path" subjectId={firstSubject}>Generate path</GeneratorButton> : null}
            </div>
          </div>
          <StudyPathTimeline plan={plan} />
        </section>
      </main>
    </div>
  );
}
