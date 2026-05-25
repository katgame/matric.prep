import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { fetchPapers, fetchSubjects } from "@/lib/api";
import { listPapers, listSubjects } from "@/lib/papers";
import { subjectAccentClass } from "@/lib/subject-accents";
import type { PastPaper, SubjectSummary } from "@/lib/types";
import { ArrowRight, BookOpen, BrainCircuit, Clock, FileText } from "lucide-react";

export default async function SubjectsPage() {
  let subjects: SubjectSummary[];
  let papers: PastPaper[];
  try {
    const [apiSubjects, apiPapers] = await Promise.all([fetchSubjects(), fetchPapers()]);
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

  return (
    <div className="ai-shell flex min-h-full flex-col">
      <AppHeader title="Subjects" />
      <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <section className="ai-card rounded-[2rem] p-6 sm:p-8">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
            <BookOpen className="h-4 w-4" aria-hidden />
            Paper library
          </p>
          <h1 className="ai-glow-text mt-4 max-w-3xl font-[family-name:var(--font-fraunces)] text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-5xl">
            Choose a subject, then launch the AI exam workspace.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
            Each paper opens into a split-screen study desk with the official paper, question workspace, and AI tutor.
          </p>
        </section>

        <ul className="mt-8 space-y-6">
          {subjects.map((subject) => {
            const subjectPapers = papers.filter((p) => p.subjectId === subject.id);
            return (
              <li key={subject.id} id={subject.id}>
                <section className={`${subject.accentClass} ai-card rounded-[2rem] p-5 sm:p-6`} aria-labelledby={`${subject.id}-heading`}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <div className="h-1.5 w-20 rounded-full bg-[var(--subject)]" />
                      <h2 id={`${subject.id}-heading`} className="mt-5 font-[family-name:var(--font-fraunces)] text-3xl font-semibold text-[var(--foreground)]">
                        {subject.label}
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--muted)]">{subject.description}</p>
                    </div>
                    <p className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
                      <FileText className="h-4 w-4 text-[var(--subject)]" aria-hidden />
                      {subjectPapers.length} paper(s)
                    </p>
                  </div>

                  {subjectPapers.length > 0 ? (
                    <ul className="mt-6 grid gap-3 lg:grid-cols-2">
                      {subjectPapers.map((paper) => (
                        <li key={paper.id}>
                          <Link
                            href={`/papers/${paper.id}`}
                            className="group block rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-soft)] p-5 transition hover:border-[var(--subject)] hover:bg-[var(--paper)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <p className="truncate text-lg font-semibold text-[var(--foreground)]">{paper.title}</p>
                                <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
                                  <span>{paper.year}</span>
                                  <span aria-hidden>Â·</span>
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="h-4 w-4" aria-hidden />
                                    {paper.durationMinutes} min
                                  </span>
                                  <span aria-hidden>Â·</span>
                                  <span>{paper.questionCount} questions</span>
                                </p>
                              </div>
                              <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-[var(--subject)] transition group-hover:translate-x-1" aria-hidden />
                            </div>
                            <p className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]">
                              <BrainCircuit className="h-4 w-4" aria-hidden />
                              Prepare with AI tutor
                            </p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-6 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] p-5 text-sm text-[var(--muted)]">
                      No papers have been loaded for this subject yet.
                    </p>
                  )}
                </section>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
