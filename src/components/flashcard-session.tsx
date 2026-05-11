"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { reviewFlashcard } from "@/lib/api";
import type { FlashcardDeck } from "@/lib/types";

export function FlashcardSession({ deck }: { deck: FlashcardDeck }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const cards = deck.cards;
  const current = cards[index];
  const progress = useMemo(() => (cards.length ? Math.round(((index + 1) / cards.length) * 100) : 0), [cards.length, index]);

  if (!cards.length) {
    return <div className="ai-card rounded-[2rem] p-6 text-[var(--muted)]">This deck has no cards yet.</div>;
  }

  if (done) {
    return (
      <section className="ai-card rounded-[2rem] p-8 text-center" aria-labelledby="flashcard-done-heading">
        <CheckCircle2 className="mx-auto h-12 w-12 text-[var(--teal)]" aria-hidden />
        <h1 id="flashcard-done-heading" className="mt-4 font-[family-name:var(--font-fraunces)] text-2xl font-semibold text-[var(--foreground)]">
          Deck complete
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          You reviewed all {cards.length} card{cards.length !== 1 ? "s" : ""} in <span className="font-medium text-[var(--foreground)]">{deck.title}</span>.
        </p>
        <button
          type="button"
          onClick={() => { setIndex(0); setFlipped(false); setDone(false); setRatingError(null); }}
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-bold text-white transition hover:bg-[var(--accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          Review again
        </button>
      </section>
    );
  }

  async function rate(rating: string) {
    const saved = await reviewFlashcard(current!.id, rating).then(() => true).catch(() => false);
    setRatingError(saved ? null : "Rating could not be saved — your progress may not be recorded.");
    setFlipped(false);
    if (index >= cards.length - 1) {
      setDone(true);
    } else {
      setIndex((i) => i + 1);
    }
  }

  return (
    <section className="ai-card rounded-[2rem] p-6" aria-labelledby="flashcard-heading">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">{deck.topic}</p>
      <h1 id="flashcard-heading" className="mt-2 text-3xl font-semibold text-[var(--foreground)]">{deck.title}</h1>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--surface-strong)]" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-[var(--accent)] transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-2 text-right text-xs text-[var(--muted)]">{index + 1} / {cards.length}</p>
      <button
        type="button"
        onClick={() => setFlipped((v) => !v)}
        className="mt-6 flex min-h-80 w-full flex-col items-center justify-center rounded-[2rem] border border-[var(--accent)]/30 bg-[var(--accent-muted)] p-8 text-center transition hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
      >
        <RotateCcw className="mb-5 h-8 w-8 text-[var(--accent)]" aria-hidden />
        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
          {flipped ? "Answer" : "Prompt"}
        </span>
        <span className="mt-4 max-w-2xl text-2xl font-semibold leading-snug text-[var(--foreground)]">
          {flipped ? current.back : current.front}
        </span>
      </button>
      {ratingError ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100" role="alert">
          {ratingError}
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-3">
        {["again", "hard", "good"].map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => void rate(rating)}
            className="inline-flex min-h-11 items-center rounded-full border border-[var(--border)] bg-[var(--card)] px-5 text-sm font-semibold capitalize text-[var(--foreground)] transition hover:bg-[var(--accent-muted)]"
          >
            {rating}
          </button>
        ))}
      </div>
    </section>
  );
}
