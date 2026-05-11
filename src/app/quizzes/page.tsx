import { AppHeader } from "@/components/app-header";
import { GeneratorButton } from "@/components/platform-generators";
import { fetchSubjects } from "@/lib/api";

export default async function QuizzesPage() {
  const subjects = await fetchSubjects().catch(() => []);

  return (
    <div className="ai-shell flex min-h-full flex-col">
      <AppHeader title="Quizzes" />
      <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <section className="ai-card rounded-[2rem] p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Quick checks</p>
          <h1 className="ai-glow-text mt-3 font-[family-name:var(--font-fraunces)] text-4xl font-semibold text-[var(--foreground)]">
            Generate short quizzes from exam content.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
            Quizzes pull from stored paper questions first, so practice stays connected to the official exam bank.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {subjects.slice(0, 4).map((subject) => (
              <GeneratorButton key={subject.id} kind="quiz" subjectId={subject.id}>
                Generate {subject.label} quiz
              </GeneratorButton>
            ))}
            {subjects.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No subjects available. Make sure the API is running.</p>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
