import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { GeneratorButton } from "@/components/platform-generators";
import { fetchPaperTake } from "@/lib/api";
import { ArrowRight, BrainCircuit, Clock, FileText, ListChecks, ShieldCheck, Sparkles } from "lucide-react";

type PageProps = {
  params: Promise<{ paperId: string }>;
};

export default async function PaperDetailPage({ params }: PageProps) {
  const { paperId } = await params;
  let paper;
  try {
    paper = await fetchPaperTake(paperId);
  } catch {
    return (
      <div className="ai-shell flex min-h-full flex-col">
        <AppHeader backHref="/subjects" backLabel="Back to subjects" title="Paper" />
        <main id="main-content" className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 sm:px-6">
          <div className="ai-card rounded-3xl p-6">
            <p className="text-[var(--foreground)]">
              Could not load this paper from the API. Ensure the backend is running and check{" "}
              <code className="rounded bg-[var(--accent-muted)] px-1.5 py-0.5 text-sm">NEXT_PUBLIC_API_URL</code>.
            </p>
          </div>
        </main>
      </div>
    );
  }
  if (!paper) notFound();

  return (
    <div className="ai-shell flex min-h-full flex-col">
      <AppHeader backHref="/subjects" backLabel="Back to subjects" title={paper.subjectLabel} />
      <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="ai-card rounded-[2rem] p-6 sm:p-8">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
              <FileText className="h-4 w-4" aria-hidden />
              {paper.subjectLabel} · {paper.year}
            </p>
            <h1 className="ai-glow-text mt-4 font-[family-name:var(--font-fraunces)] text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-5xl">
              {paper.title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
              Open this paper in the AI workspace to keep the official PDF, active question, your working, and the
              step-by-step tutor in one focused view.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/tutor/${paper.id}`}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-7 text-base font-bold text-white transition hover:bg-[var(--accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
              >
                Open AI workspace
                <Sparkles className="h-5 w-5" aria-hidden />
              </Link>
              <Link
                href={`/test/${paper.id}`}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] px-7 text-base font-semibold text-[var(--foreground)] transition hover:bg-[var(--accent-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
              >
                Start timed test
              </Link>
            </div>
          </div>

          <aside className="ai-card rounded-[2rem] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Paper profile</p>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="ai-card-soft rounded-2xl p-4">
                <dt className="flex items-center gap-2 text-sm text-[var(--muted)]">
                  <Clock className="h-4 w-4" aria-hidden />
                  Duration
                </dt>
                <dd className="mt-2 text-xl font-semibold tabular-nums text-[var(--foreground)]">{paper.durationMinutes} min</dd>
              </div>
              <div className="ai-card-soft rounded-2xl p-4">
                <dt className="flex items-center gap-2 text-sm text-[var(--muted)]">
                  <ListChecks className="h-4 w-4" aria-hidden />
                  Questions
                </dt>
                <dd className="mt-2 text-xl font-semibold tabular-nums text-[var(--foreground)]">{paper.questionCount}</dd>
              </div>
            </dl>

            <div className="mt-4 rounded-2xl border border-[var(--teal)]/30 bg-[var(--teal-muted)] p-4">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                <ShieldCheck className="h-4 w-4 text-[var(--teal)]" aria-hidden />
                Study-first mode
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                The AI workspace is designed for understanding. Timed mode is still available for strict exam rehearsal.
              </p>
            </div>
          </aside>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="ai-card rounded-[2rem] p-6">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
              <BrainCircuit className="h-4 w-4" aria-hidden />
              What opens next
            </p>
            <ol className="mt-5 space-y-4 text-sm leading-7 text-[var(--muted)]">
              <li className="flex gap-3">
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">1</span>
                Official paper PDF opens beside the active question.
              </li>
              <li className="flex gap-3">
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">2</span>
                Learner writes an attempt or selects an MCQ option.
              </li>
              <li className="flex gap-3">
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">3</span>
                AI generates context, method, worked solution, and final answer.
              </li>
            </ol>
          </div>

          <div className="ai-card rounded-[2rem] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Topics in this set</p>
            {paper.topics.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {paper.topics.map((topic) => (
                  <li key={topic}>
                    <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1.5 text-sm text-[var(--foreground)]">
                      {topic}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-[var(--muted)]">Topics will appear here when the paper metadata includes them.</p>
            )}

            {(paper.sourcePaperPdfRelativePath ?? paper.sourceMemoPdfRelativePath) ? (
              <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <p className="text-sm font-semibold text-[var(--foreground)]">Source files</p>
                <ul className="mt-3 space-y-2 text-xs leading-6 text-[var(--muted)]">
                  {paper.sourcePaperPdfRelativePath ? <li className="break-all">Question paper: {paper.sourcePaperPdfRelativePath}</li> : null}
                  {paper.sourceMemoPdfRelativePath ? <li className="break-all">Memo: {paper.sourceMemoPdfRelativePath}</li> : null}
                </ul>
              </div>
            ) : null}

            <Link
              href={`/tutor/${paper.id}`}
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--accent)]/30 bg-[var(--accent-muted)] px-5 text-sm font-bold text-[var(--foreground)] transition hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            >
              Launch workspace
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </section>

        <section className="mt-6 ai-card rounded-[2rem] p-6" aria-labelledby="toolkit-heading">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Generate from this paper</p>
          <h2 id="toolkit-heading" className="mt-2 font-[family-name:var(--font-fraunces)] text-3xl font-semibold text-[var(--foreground)]">
            Build TutorAI-style tools around this exam.
          </h2>
          <div className="mt-5 flex flex-wrap gap-3">
            <GeneratorButton kind="study-path" subjectId={paper.subjectId} paperId={paper.id}>
              Add to study path
            </GeneratorButton>
            <GeneratorButton kind="revision" subjectId={paper.subjectId} paperId={paper.id} topic={paper.topics[0] ?? null}>
              Generate revision pack
            </GeneratorButton>
            <GeneratorButton kind="flashcards" subjectId={paper.subjectId} paperId={paper.id} topic={paper.topics[0] ?? null}>
              Build flashcards
            </GeneratorButton>
            <GeneratorButton kind="quiz" subjectId={paper.subjectId} paperId={paper.id} topic={paper.topics[0] ?? null}>
              Create mini quiz
            </GeneratorButton>
          </div>
        </section>
      </main>
    </div>
  );
}
