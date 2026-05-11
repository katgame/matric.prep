import Link from "next/link";
import { GraduationCap } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md font-[family-name:var(--font-fraunces)] text-lg font-semibold tracking-tight text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        >
          <GraduationCap className="h-7 w-7 text-[var(--accent)]" aria-hidden />
          MatricPrep
        </Link>
        <nav className="flex items-center gap-2 text-sm sm:gap-4" aria-label="Main">
          <Link
            href="/subjects"
            className="rounded-full px-3 py-2 text-[var(--muted)] transition hover:bg-[var(--accent-muted)] hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          >
            Subjects
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full px-3 py-2 text-[var(--muted)] transition hover:bg-[var(--accent-muted)] hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          >
            Dashboard
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full bg-[var(--accent)] px-4 py-2 font-bold text-white transition hover:bg-[var(--accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          >
            Start practice
          </Link>
        </nav>
      </div>
    </header>
  );
}
