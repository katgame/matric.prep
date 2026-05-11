import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { fetchAnalyticsOverview, fetchCurrentStudyPlan, fetchPapers, fetchSubjects } from "@/lib/api";
import { LearningToolCard } from "@/components/learning-tool-card";
import { ReadinessMeter } from "@/components/readiness-meter";
import { StudyPathTimeline } from "@/components/study-path-timeline";
import { listPapers, listSubjects } from "@/lib/papers";
import { subjectAccentClass } from "@/lib/subject-accents";
import type { PastPaper, SubjectSummary } from "@/lib/types";
import { Activity, ArrowRight, BookOpenCheck, BrainCircuit, Clock, LibraryBig, Layers3, Trophy } from "lucide-react";

export default async function DashboardPage() {
  let subjects: SubjectSummary[];
  let papers: PastPaper[];
  let fromApi = false;
  try {
    const [apiSubjects, apiPapers] = await Promise.all([fetchSubjects(), fetchPapers()]);
    fromApi = true;
    const paperCountBySubject = new Map<string, number>();
    for (const p of apiPapers) {
      paperCountBySubject.set(p.subjectId, (paperCountBySubject.get(p.subjectId) ?? 0) + 1);
    }
    subjects = apiSubjects.map((s) => ({
      id: s.id as SubjectSummary["id"],
      label: s.label,
      description: s.description,
      paperCount: paperCountBySubject.get(s.id) ?? 0,
      accentClass: subjectAccentClass(s.id),
    }));
    papers = apiPapers.map((p) => ({
      id: p.id,
      subjectId: p.subjectId as SubjectSummary["id"],
      subjectLabel: p.subjectLabel,
      year: p.year,
      title: p.title,
      paperLabel: p.paperLabel,
      durationMinutes: p.durationMinutes,
      questionCount: p.questionCount,
      topics: [],
      questions: [],
    }));
  } catch {
    subjects = listSubjects();
    papers = listPapers();
  }

  const featured = papers[0];
  const [overview, studyPlan] = await Promise.all([
    fetchAnalyticsOverview().catch(() => ({
      readinessPercent: 0,
      attempts: 0,
      questionsAnswered: 0,
      correctAnswers: 0,
      weakTopics: [],
      strongTopics: [],
      nextActions: [],
    })),
    fetchCurrentStudyPlan().catch(() => null),
  ]);

  return (
    <div className="ai-shell flex min-h-full flex-col">
      <AppHeader title="Dashboard" />
      <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <section className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="ai-card rounded-[2rem] p-6 sm:p-8">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
              <Activity className="h-4 w-4" aria-hidden />
              Learner command center
            </p>
            <h1 className="ai-glow-text mt-4 max-w-3xl font-[family-name:var(--font-fraunces)] text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-5xl">
              Choose the paper. Let the workspace guide the thinking.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
              Start with a full paper, jump into a question, then use the AI tutor to unpack the method after you have
              made an attempt.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="ai-card-soft rounded-2xl p-4">
                <LibraryBig className="h-5 w-5 text-[var(--accent)]" aria-hidden />
                <p className="mt-3 text-2xl font-semibold tabular-nums text-[var(--foreground)]">{papers.length}</p>
                <p className="text-sm text-[var(--muted)]">papers loaded</p>
              </div>
              <div className="ai-card-soft rounded-2xl p-4">
                <BookOpenCheck className="h-5 w-5 text-[var(--teal)]" aria-hidden />
                <p className="mt-3 text-2xl font-semibold tabular-nums text-[var(--foreground)]">{subjects.length}</p>
                <p className="text-sm text-[var(--muted)]">subjects</p>
              </div>
              <div className="ai-card-soft rounded-2xl p-4">
                <BrainCircuit className="h-5 w-5 text-[var(--accent)]" aria-hidden />
                <p className="mt-3 text-sm font-semibold text-[var(--foreground)]">{fromApi ? "API online" : "Sample mode"}</p>
                <p className="text-sm text-[var(--muted)]">data source</p>
              </div>
            </div>
          </div>

          <aside className="ai-card rounded-[2rem] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Recommended launch</p>
            {featured ? (
              <Link
                href={`/tutor/${featured.id}`}
                className="mt-5 block rounded-[1.5rem] border border-[var(--accent)]/30 bg-[var(--accent-muted)] p-5 transition hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
              >
                <p className="text-lg font-semibold text-[var(--foreground)]">{featured.title}</p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {featured.subjectLabel} · {featured.year} · {featured.durationMinutes} min
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]">
                  Open AI workspace
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </span>
              </Link>
            ) : (
              <p className="mt-5 text-sm text-[var(--muted)]">No papers are available yet.</p>
            )}
            <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <Clock className="h-5 w-5 text-[var(--teal)]" aria-hidden />
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                Study-first mode is the main path. Timed mode remains available from each paper when learners are ready
                to rehearse exam pressure.
              </p>
            </div>
          </aside>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <ReadinessMeter overview={overview} />
          <StudyPathTimeline plan={studyPlan} />
        </section>

        <section className="mt-10" aria-labelledby="tools-heading">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">TutorAI-style tools</p>
          <h2 id="tools-heading" className="mt-2 font-[family-name:var(--font-fraunces)] text-3xl font-semibold text-[var(--foreground)]">
            Build your exam-prep system
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <LearningToolCard title="Study path" description="Generate a week-by-week revision route from subjects, weak topics, and papers." href="/study-path" icon={Trophy} />
            <LearningToolCard title="Revision packs" description="Create memo-grounded notes, mistakes, and drills for a topic or paper." href="/revision" icon={Layers3} />
            <LearningToolCard title="Flashcards" description="Turn questions and memo guidance into quick recall decks." href="/flashcards" icon={BookOpenCheck} />
            <LearningToolCard title="Progress" description="Track readiness, weak topics, and the next best action." href="/progress" icon={BrainCircuit} />
          </div>
        </section>

        <section className="mt-10" aria-labelledby="subjects-overview-heading">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Subject library</p>
              <h2 id="subjects-overview-heading" className="mt-2 font-[family-name:var(--font-fraunces)] text-3xl font-semibold text-[var(--foreground)]">
                Pick your revision lane
              </h2>
            </div>
            <Link
              href="/subjects"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] px-5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--accent-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            >
              View all subjects
            </Link>
          </div>

          <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {subjects.map((subject) => (
              <li key={subject.id}>
                <Link
                  href={`/subjects#${subject.id}`}
                  className={`${subject.accentClass} ai-card block min-h-full rounded-[1.5rem] p-5 transition hover:-translate-y-0.5 hover:border-[var(--subject)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]`}
                >
                  <div className="h-1.5 w-16 rounded-full bg-[var(--subject)]" />
                  <p className="mt-5 text-lg font-semibold text-[var(--foreground)]">{subject.label}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{subject.paperCount} paper(s) ready</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
