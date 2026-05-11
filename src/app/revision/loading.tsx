export default function RevisionLoading() {
  return (
    <div className="ai-shell flex min-h-full flex-col">
      <div className="sticky top-0 z-40 h-14 border-b border-[var(--border)] bg-[var(--card)]/95 sm:h-16" />
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <div className="ai-card h-56 animate-pulse rounded-[2rem]" />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[0, 1].map((n) => (
            <div key={n} className="ai-card h-48 animate-pulse rounded-[2rem]" />
          ))}
        </div>
      </div>
    </div>
  );
}
