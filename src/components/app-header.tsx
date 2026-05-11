import Link from "next/link";
import { ArrowLeft, GraduationCap } from "lucide-react";

type AppHeaderProps = {
  backHref?: string;
  backLabel?: string;
  title?: string;
};

export function AppHeader({ backHref, backLabel, title }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:h-16 sm:px-6">
        {backHref ? (
          <Link
            href={backHref}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--accent-muted)] hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            aria-label={backLabel ?? "Back"}
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
        ) : null}
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md font-[family-name:var(--font-fraunces)] text-base font-semibold text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] sm:text-lg"
        >
          <GraduationCap className="h-6 w-6 text-[var(--accent)]" aria-hidden />
          MatricPrep
        </Link>
        {title ? (
          <>
            <span className="text-[var(--border)]" aria-hidden>
              /
            </span>
            <span className="truncate text-sm font-medium text-[var(--muted)]">{title}</span>
          </>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/subjects"
            className="hidden rounded-full px-3 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--accent-muted)] hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] sm:inline"
          >
            Subjects
          </Link>
          <Link
            href="/study-path"
            className="hidden rounded-full px-3 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--accent-muted)] hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] md:inline"
          >
            Plan
          </Link>
          <Link
            href="/progress"
            className="hidden rounded-full px-3 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--accent-muted)] hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] md:inline"
          >
            Progress
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </header>
  );
}
