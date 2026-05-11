"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateFlashcardDeck, generateQuiz, generateRevisionPack, generateStudyPlan } from "@/lib/api";

type GeneratorButtonProps = {
  kind: "study-path" | "revision" | "flashcards" | "quiz";
  subjectId: string;
  topic?: string | null;
  paperId?: string | null;
  questionId?: string | null;
  children: React.ReactNode;
  className?: string;
};

export function GeneratorButton({
  kind,
  subjectId,
  topic,
  paperId,
  questionId,
  children,
  className,
}: GeneratorButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      if (kind === "study-path") {
        await generateStudyPlan({ subjectId, focusTopics: topic ? [topic] : undefined });
        router.push("/study-path");
      } else if (kind === "revision") {
        const pack = await generateRevisionPack({ subjectId, topic, paperId, questionId });
        router.push(`/revision/${pack.id}`);
      } else if (kind === "flashcards") {
        const deck = await generateFlashcardDeck({ subjectId, topic, paperId, questionId });
        router.push(`/flashcards/${deck.id}`);
      } else {
        const quiz = await generateQuiz({ subjectId, topic, paperId });
        router.push(`/quizzes/${quiz.id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate tool.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-2">
      <button
        type="button"
        onClick={() => void run()}
        disabled={loading}
        className={
          className ??
          "inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--accent)]/30 bg-[var(--accent-muted)] px-5 text-sm font-bold text-[var(--foreground)] transition hover:border-[var(--accent)] disabled:opacity-60"
        }
      >
        {loading ? "Generating..." : children}
      </button>
      {error ? <span className="max-w-xs text-xs text-[var(--danger)]">{error}</span> : null}
    </span>
  );
}
