import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { GeneratorButton } from "@/components/platform-generators";
import { fetchRevisionPacks, fetchSubjects } from "@/lib/api";

export default async function RevisionPage() {
  const [packs, subjects] = await Promise.all([
    fetchRevisionPacks().catch(() => []),
    fetchSubjects().catch(() => []),
  ]);
  const firstSubject = subjects[0]?.id ?? "accounting";

  return (
    <div className="ai-shell flex min-h-full flex-col">
      <AppHeader title="Revision packs" />
      <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <section className="ai-card rounded-[2rem] p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Generated notes</p>
          <h1 className="ai-glow-text mt-3 font-[family-name:var(--font-fraunces)] text-4xl font-semibold text-[var(--foreground)]">
            Revision packs grounded in papers and memos.
          </h1>
          <div className="mt-6 flex flex-wrap gap-3">
            {subjects.slice(0, 4).map((subject) => (
              <GeneratorButton key={subject.id} kind="revision" subjectId={subject.id}>
                Generate {subject.label} pack
              </GeneratorButton>
            ))}
            {subjects.length === 0 ? <GeneratorButton kind="revision" subjectId={firstSubject}>Generate pack</GeneratorButton> : null}
          </div>
        </section>
        <ul className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {packs.map((pack) => (
            <li key={pack.id}>
              <Link href={`/revision/${pack.id}`} className="ai-card block rounded-[1.5rem] p-5 transition hover:border-[var(--accent)]">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">{pack.topic}</p>
                <h2 className="mt-3 text-xl font-semibold text-[var(--foreground)]">{pack.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{pack.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
