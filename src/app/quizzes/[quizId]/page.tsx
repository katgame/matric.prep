import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { QuizRunner } from "@/components/quiz-runner";
import { fetchQuiz } from "@/lib/api";

type PageProps = {
  params: Promise<{ quizId: string }>;
};

export default async function QuizPage({ params }: PageProps) {
  const { quizId } = await params;
  const quiz = await fetchQuiz(quizId).catch(() => null);
  if (!quiz) notFound();

  return (
    <div className="ai-shell flex min-h-full flex-col">
      <AppHeader backHref="/quizzes" backLabel="Back to quizzes" title="Quiz" />
      <main id="main-content" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <QuizRunner quiz={quiz} />
      </main>
    </div>
  );
}
