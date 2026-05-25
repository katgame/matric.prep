import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { TestRunner } from "@/components/test-runner";
import { fetchPaperTake } from "@/lib/api";

type PageProps = {
  params: Promise<{ paperId: string }>;
};

export default async function TestPage({ params }: PageProps) {
  const { paperId } = await params;
  let paper;
  try {
    paper = await fetchPaperTake(paperId);
  } catch {
    return (
      <div className="flex min-h-full flex-col">
        <AppHeader backHref="/dashboard" backLabel="Dashboard" title="Timed test" />
        <main
          id="main-content"
          className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 sm:px-6"
        >
          <p className="text-[var(--foreground)]">
            Could not reach the MatricPrep API. Start the backend (default{" "}
            <code className="rounded bg-[var(--card)] px-1.5 py-0.5 text-sm">http://localhost:5179</code>
            ) or set{" "}
            <code className="rounded bg-[var(--card)] px-1.5 py-0.5 text-sm">NEXT_PUBLIC_API_URL</code>{" "}
            in <code className="rounded bg-[var(--card)] px-1.5 py-0.5 text-sm">.env.local</code>.
          </p>
        </main>
      </div>
    );
  }
  if (!paper) notFound();

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader
        backHref={`/papers/${paper.id}`}
        backLabel="Back to paper"
        title="Timed test"
      />
      <TestRunner paper={paper} />
    </div>
  );
}
