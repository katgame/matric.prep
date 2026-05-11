import Link from "next/link";
import { Bot, BrainCircuit, FileText, PanelLeftOpen, Sparkles, Target } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

const workspaceFeatures = [
  {
    title: "Paper beside your working",
    body: "Keep the official NSC paper visible while the question workspace stays focused on the selected item.",
    icon: PanelLeftOpen,
  },
  {
    title: "Step-by-step AI reasoning",
    body: "Send your attempt to the OpenAI endpoint and get context, method, worked solution, and final answer.",
    icon: BrainCircuit,
  },
  {
    title: "Memo when you are ready",
    body: "Compare with memorandum guidance after you have tried, so learning does not become answer copying.",
    icon: Target,
  },
];

export default function HomePage() {
  return (
    <div className="ai-shell flex min-h-full flex-col">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <section className="relative overflow-hidden">
          <div className="surface-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                <span className="ai-orb h-2.5 w-2.5 rounded-full" aria-hidden />
                MatricPrep AI workspace
              </p>
              <h1 className="ai-glow-text mt-6 max-w-4xl font-[family-name:var(--font-fraunces)] text-5xl font-semibold leading-[0.98] tracking-tight text-[var(--foreground)] sm:text-6xl lg:text-7xl">
                Past papers that teach you how to think.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
                Open an exam paper, select a question, write your attempt, and get a structured AI explanation without
                losing sight of the official paper.
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/dashboard"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-8 text-base font-bold text-white transition hover:bg-[var(--accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                >
                  Enter dashboard
                  <Sparkles className="h-5 w-5" aria-hidden />
                </Link>
                <Link
                  href="/subjects"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] px-8 text-base font-semibold text-[var(--foreground)] transition hover:bg-[var(--accent-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                >
                  Browse papers
                </Link>
              </div>
            </div>

            <div className="ai-card rounded-[2rem] p-4 sm:p-5">
              <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                      Live study desk
                    </p>
                    <p className="mt-2 text-xl font-semibold text-[var(--foreground)]">Question 4.2 · Functions</p>
                  </div>
                  <Bot className="h-9 w-9 text-[var(--accent)]" aria-hidden />
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-[0.85fr_1fr]">
                  <div className="min-h-64 rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-4 text-[var(--paper-foreground)] shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Official paper</p>
                    <div className="mt-5 space-y-3">
                      <div className="h-3 rounded-full bg-slate-200" />
                      <div className="h-3 w-4/5 rounded-full bg-slate-200" />
                      <div className="h-28 rounded-xl border border-slate-200 bg-slate-50" />
                      <div className="h-3 w-3/4 rounded-full bg-slate-200" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent-muted)] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                        AI explanation
                      </p>
                      <p className="mt-3 text-sm leading-relaxed text-[var(--foreground)]">
                        First identify the command verb, then isolate the given values. Substitute into the formula and
                        show each mark-bearing step.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                        Learner working
                      </p>
                      <div className="mt-3 h-24 rounded-xl border border-[var(--border)] bg-[var(--paper)]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20" aria-labelledby="features-heading">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Designed for learners</p>
            <h2 id="features-heading" className="mt-3 font-[family-name:var(--font-fraunces)] text-3xl font-semibold text-[var(--foreground)] sm:text-4xl">
              One workspace for reading, trying, and understanding.
            </h2>
          </div>
          <ul className="mt-10 grid gap-5 md:grid-cols-3">
            {workspaceFeatures.map((feature) => (
              <li key={feature.title} className="ai-card rounded-[1.75rem] p-6">
                <feature.icon className="h-8 w-8 text-[var(--accent)]" aria-hidden />
                <h3 className="mt-5 text-lg font-semibold text-[var(--foreground)]">{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{feature.body}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <footer className="border-t border-[var(--border)] bg-[var(--card)]/70 py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>MatricPrep · AI-powered NSC exam practice.</span>
          <span className="inline-flex items-center gap-2 text-xs">
            <FileText className="h-4 w-4" aria-hidden />
            Built for focused study sessions.
          </span>
        </div>
      </footer>
    </div>
  );
}
