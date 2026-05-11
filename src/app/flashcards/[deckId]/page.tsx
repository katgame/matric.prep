import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { FlashcardSession } from "@/components/flashcard-session";
import { fetchFlashcardDeck } from "@/lib/api";

type PageProps = {
  params: Promise<{ deckId: string }>;
};

export default async function FlashcardDeckPage({ params }: PageProps) {
  const { deckId } = await params;
  const deck = await fetchFlashcardDeck(deckId).catch(() => null);
  if (!deck) notFound();

  return (
    <div className="ai-shell flex min-h-full flex-col">
      <AppHeader backHref="/flashcards" backLabel="Back to flashcards" title="Flashcards" />
      <main id="main-content" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <FlashcardSession deck={deck} />
      </main>
    </div>
  );
}
