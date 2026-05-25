import Link from "next/link";
import { AppHeader } from "@/components/app-header";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col">
      <AppHeader title="Not found" />
      <main id="main-content" className="mx-auto flex max-w-lg flex-1 flex-col justify-center px-4 py-16 text-center sm:px-6">
        <h1 className="font-[family-name:var(--font-fraunces)] text-3xl font-semibold text-[var(--foreground)]">
          Page or paper not found
        </h1>
        <p className="mt-3 text-[var(--muted)]">
          Check the link or return to your dashboard to pick a subject.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex min-h-11 items-center justify-center self-center rounded-full bg-[var(--accent)] px-8 font-medium text-white transition hover:bg-[var(--accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        >
          Go to dashboard
        </Link>
      </main>
    </div>
  );
}
