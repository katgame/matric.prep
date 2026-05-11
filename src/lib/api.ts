import type {
  AnalyticsOverview,
  Flashcard,
  FlashcardDeck,
  LearnerProfile,
  McqOption,
  QuestionBreakdown,
  Quiz,
  QuizAttemptResult,
  RevisionPack,
  StudyPlan,
  TakePaper,
  TutorPaper,
} from "./types";

export function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url && typeof window !== "undefined") {
    console.warn("[MatricPrep] NEXT_PUBLIC_API_URL is not set — falling back to http://localhost:5179");
  }
  return url ?? "http://localhost:5179";
}

/** Normalizes API / JSON option arrays to MCQ options. */
export function parseMcqOptions(raw: unknown): McqOption[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((o) => {
    const x = o as { id?: unknown; text?: unknown };
    return { id: String(x.id ?? ""), text: String(x.text ?? "") };
  });
}

export async function fetchPaperTake(paperId: string): Promise<TakePaper | null> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/papers/${encodeURIComponent(paperId)}/take`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load paper (${res.status})`);
  const data = (await res.json()) as Record<string, unknown>;
  const questionsRaw = data.questions;
  if (!Array.isArray(questionsRaw)) {
    throw new Error("Invalid paper payload: missing questions");
  }
  const questions = questionsRaw.map((q) => {
    const row = q as Record<string, unknown>;
    return {
      id: String(row.id ?? ""),
      questionType: String(row.questionType ?? "mcq"),
      topic: String(row.topic ?? ""),
      difficulty: String(row.difficulty ?? ""),
      prompt: String(row.prompt ?? ""),
      options: parseMcqOptions(row.options),
      marks: (row.marks as number | null | undefined) ?? null,
    };
  });
  return {
    id: String(data.id ?? ""),
    subjectId: String(data.subjectId ?? ""),
    subjectLabel: String(data.subjectLabel ?? ""),
    year: Number(data.year ?? 0),
    title: String(data.title ?? ""),
    paperLabel: String(data.paperLabel ?? ""),
    durationMinutes: Number(data.durationMinutes ?? 0),
    questionCount: Number(data.questionCount ?? questions.length),
    topics: Array.isArray(data.topics) ? (data.topics as string[]) : [],
    sourcePaperPdfRelativePath:
      (data.sourcePaperPdfRelativePath as string | null | undefined) ?? null,
    sourceMemoPdfRelativePath:
      (data.sourceMemoPdfRelativePath as string | null | undefined) ?? null,
    questions,
  };
}

export async function fetchPaperTutor(paperId: string): Promise<TutorPaper | null> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/papers/${encodeURIComponent(paperId)}/tutor`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load tutor paper (${res.status})`);
  const data = (await res.json()) as Record<string, unknown>;
  const questionsRaw = data.questions;
  if (!Array.isArray(questionsRaw)) {
    throw new Error("Invalid tutor payload: missing questions");
  }
  const questions = questionsRaw.map((q) => {
    const row = q as Record<string, unknown>;
    return {
      id: String(row.id ?? ""),
      sortOrder: Number(row.sortOrder ?? 0),
      questionType: String(row.questionType ?? "structured"),
      topic: String(row.topic ?? ""),
      difficulty: String(row.difficulty ?? ""),
      prompt: String(row.prompt ?? ""),
      options: parseMcqOptions(row.options),
      marks: (row.marks as number | null | undefined) ?? null,
      memoAnswer: (row.memoAnswer as string | null | undefined) ?? null,
      markingNotes: (row.markingNotes as string | null | undefined) ?? null,
      explanation: (row.explanation as string | null | undefined) ?? null,
      correctOptionId: (row.correctOptionId as string | null | undefined) ?? null,
    };
  });
  return {
    id: String(data.id ?? ""),
    subjectId: String(data.subjectId ?? ""),
    subjectLabel: String(data.subjectLabel ?? ""),
    year: Number(data.year ?? 0),
    title: String(data.title ?? ""),
    paperLabel: String(data.paperLabel ?? ""),
    durationMinutes: Number(data.durationMinutes ?? 0),
    questionCount: Number(data.questionCount ?? questions.length),
    topics: Array.isArray(data.topics) ? (data.topics as string[]) : [],
    sourcePaperPdfRelativePath:
      (data.sourcePaperPdfRelativePath as string | null | undefined) ?? null,
    sourceMemoPdfRelativePath:
      (data.sourceMemoPdfRelativePath as string | null | undefined) ?? null,
    sourcePaperPdfUrl: (data.sourcePaperPdfUrl as string | null | undefined) ?? null,
    sourceMemoPdfUrl: (data.sourceMemoPdfUrl as string | null | undefined) ?? null,
    tutorChatEnabled: Boolean(data.tutorChatEnabled),
    questions,
  };
}

export type TutorChatMessage = { role: "user" | "assistant"; content: string };

export async function postTutorChat(
  paperId: string,
  questionId: string,
  messages: TutorChatMessage[],
): Promise<{ reply: string }> {
  const base = getApiBaseUrl();
  const res = await fetch(
    `${base}/api/papers/${encodeURIComponent(paperId)}/questions/${encodeURIComponent(questionId)}/tutor-chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    },
  );
  if (res.status === 503) {
    throw new Error("Tutor chat is disabled on the server.");
  }
  if (res.status === 404) throw new Error("Question not found.");
  if (!res.ok) {
    let msg = `Chat failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) msg = body.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const data = (await res.json()) as { reply?: string };
  const reply = data.reply?.trim() ?? "";
  if (!reply) throw new Error("Empty reply from tutor.");
  return { reply };
}

export async function fetchQuestionBreakdown(
  paperId: string,
  questionId: string,
  studentAnswer?: string,
): Promise<QuestionBreakdown> {
  const base = getApiBaseUrl();
  const res = await fetch(
    `${base}/api/papers/${encodeURIComponent(paperId)}/questions/${encodeURIComponent(questionId)}/breakdown`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentAnswer: studentAnswer?.trim() || null }),
    },
  );
  if (res.status === 503) throw new Error("Tutor breakdown is disabled on the server.");
  if (res.status === 404) throw new Error("Question not found.");
  if (!res.ok) {
    let msg = `Breakdown failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) msg = body.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  const data = (await res.json()) as Record<string, unknown>;
  return {
    context: String(data.context ?? ""),
    method: String(data.method ?? ""),
    workedSolution: String(data.workedSolution ?? ""),
    finalAnswer: String(data.finalAnswer ?? ""),
    raw: String(data.raw ?? ""),
  };
}

export type QuestionReviewPayload = {
  questionId: string;
  questionType: string;
  isCorrect: boolean;
  chosenOptionId: string | null;
  correctOptionId: string | null;
  memoAnswer: string | null;
  markingNotes: string | null;
  explanation: string | null;
};

export type AttemptResultPayload = {
  attemptId: string;
  correct: number;
  total: number;
  percent: number;
  reviews: QuestionReviewPayload[];
};

export async function submitAttempt(
  paperId: string,
  durationSeconds: number,
  answers: { questionId: string; optionId: string }[],
  learnerId = "demo-learner",
): Promise<AttemptResultPayload> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/attempts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paperId,
      durationSeconds,
      learnerId,
      answers: answers.map((a) => ({
        questionId: a.questionId,
        optionId: a.optionId,
      })),
    }),
  });
  if (res.status === 404) throw new Error("Paper not found");
  if (!res.ok) throw new Error(`Submit failed (${res.status})`);
  const data = (await res.json()) as Record<string, unknown>;
  const reviewsRaw = data.reviews;
  const reviews: QuestionReviewPayload[] = Array.isArray(reviewsRaw)
    ? reviewsRaw.map((r) => {
        const row = r as Record<string, unknown>;
        return {
          questionId: String(row.questionId ?? ""),
          questionType: String(row.questionType ?? ""),
          isCorrect: Boolean(row.isCorrect),
          chosenOptionId: (row.chosenOptionId as string | null) ?? null,
          correctOptionId: (row.correctOptionId as string | null) ?? null,
          memoAnswer: (row.memoAnswer as string | null) ?? null,
          markingNotes: (row.markingNotes as string | null) ?? null,
          explanation: (row.explanation as string | null) ?? null,
        };
      })
    : [];
  return {
    attemptId: String(data.attemptId ?? ""),
    correct: Number(data.correct ?? 0),
    total: Number(data.total ?? 0),
    percent: Number(data.percent ?? 0),
    reviews,
  };
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBaseUrl();
  const method = (init?.method ?? "GET").toUpperCase();
  const needsBody = method !== "GET" && method !== "HEAD";
  const res = await fetch(`${base}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      ...(needsBody ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) msg = body.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export async function ensureLearnerProfile(learnerId = "demo-learner"): Promise<LearnerProfile> {
  return fetchJson<LearnerProfile>("/api/me", {
    method: "POST",
    body: JSON.stringify({ id: learnerId, displayName: "Matric learner" }),
  });
}

export async function fetchAnalyticsOverview(learnerId = "demo-learner"): Promise<AnalyticsOverview> {
  return fetchJson<AnalyticsOverview>(`/api/analytics/overview?learnerId=${encodeURIComponent(learnerId)}`);
}

export async function fetchCurrentStudyPlan(learnerId = "demo-learner"): Promise<StudyPlan | null> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/study-plans/current?learnerId=${encodeURIComponent(learnerId)}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load study plan (${res.status})`);
  return (await res.json()) as StudyPlan;
}

export async function generateStudyPlan(input: {
  learnerId?: string;
  subjectId: string;
  targetDateUtc?: string | null;
  focusTopics?: string[];
}): Promise<StudyPlan> {
  return fetchJson<StudyPlan>("/api/study-plans/generate", {
    method: "POST",
    body: JSON.stringify({ learnerId: input.learnerId ?? "demo-learner", ...input }),
  });
}

export async function completeStudyPlanStep(planId: string, stepId: string): Promise<void> {
  await fetchJson(`/api/study-plans/${encodeURIComponent(planId)}/steps/${encodeURIComponent(stepId)}/complete`, {
    method: "POST",
  });
}

export async function fetchRevisionPacks(learnerId = "demo-learner"): Promise<RevisionPack[]> {
  return fetchJson<RevisionPack[]>(`/api/revision-packs?learnerId=${encodeURIComponent(learnerId)}`);
}

export async function fetchRevisionPack(packId: string): Promise<RevisionPack | null> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/revision-packs/${encodeURIComponent(packId)}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load revision pack (${res.status})`);
  return (await res.json()) as RevisionPack;
}

export async function generateRevisionPack(input: {
  learnerId?: string;
  subjectId: string;
  topic?: string | null;
  paperId?: string | null;
  questionId?: string | null;
}): Promise<RevisionPack> {
  return fetchJson<RevisionPack>("/api/revision-packs/generate", {
    method: "POST",
    body: JSON.stringify({ learnerId: input.learnerId ?? "demo-learner", ...input }),
  });
}

export async function fetchFlashcardDecks(learnerId = "demo-learner"): Promise<FlashcardDeck[]> {
  return fetchJson<FlashcardDeck[]>(`/api/flashcard-decks?learnerId=${encodeURIComponent(learnerId)}`);
}

export async function fetchFlashcardDeck(deckId: string): Promise<FlashcardDeck | null> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/flashcard-decks/${encodeURIComponent(deckId)}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load flashcard deck (${res.status})`);
  return (await res.json()) as FlashcardDeck;
}

export async function generateFlashcardDeck(input: {
  learnerId?: string;
  subjectId: string;
  topic?: string | null;
  paperId?: string | null;
  questionId?: string | null;
}): Promise<FlashcardDeck> {
  return fetchJson<FlashcardDeck>("/api/flashcard-decks/generate", {
    method: "POST",
    body: JSON.stringify({ learnerId: input.learnerId ?? "demo-learner", ...input }),
  });
}

export async function reviewFlashcard(cardId: string, rating: string): Promise<Flashcard> {
  return fetchJson<Flashcard>(`/api/flashcards/${encodeURIComponent(cardId)}/review`, {
    method: "POST",
    body: JSON.stringify({ rating }),
  });
}

function mapQuiz(raw: Quiz): Quiz {
  return {
    ...raw,
    questions: raw.questions.map((q) => ({ ...q, options: parseMcqOptions(q.options) })),
  };
}

export async function generateQuiz(input: {
  learnerId?: string;
  subjectId: string;
  topic?: string | null;
  paperId?: string | null;
  questionCount?: number;
}): Promise<Quiz> {
  const quiz = await fetchJson<Quiz>("/api/quizzes/generate", {
    method: "POST",
    body: JSON.stringify({ learnerId: input.learnerId ?? "demo-learner", ...input }),
  });
  return mapQuiz(quiz);
}

export async function fetchQuiz(quizId: string): Promise<Quiz | null> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/quizzes/${encodeURIComponent(quizId)}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load quiz (${res.status})`);
  return mapQuiz((await res.json()) as Quiz);
}

export async function submitQuizAttempt(
  quizId: string,
  answers: { quizQuestionId: string; optionId: string }[],
  learnerId = "demo-learner",
): Promise<QuizAttemptResult> {
  return fetchJson<QuizAttemptResult>(`/api/quizzes/${encodeURIComponent(quizId)}/attempts`, {
    method: "POST",
    body: JSON.stringify({ learnerId, answers }),
  });
}

export type PaperListPayload = {
  id: string;
  subjectId: string;
  subjectLabel: string;
  year: number;
  title: string;
  paperLabel: string;
  durationMinutes: number;
  questionCount: number;
  sourcePaperPdfRelativePath?: string | null;
  sourceMemoPdfRelativePath?: string | null;
};

export async function fetchPapers(): Promise<PaperListPayload[]> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/papers`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to list papers (${res.status})`);
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return data.map((p) => {
    const row = p as Record<string, unknown>;
    return {
      id: String(row.id ?? ""),
      subjectId: String(row.subjectId ?? ""),
      subjectLabel: String(row.subjectLabel ?? ""),
      year: Number(row.year ?? 0),
      title: String(row.title ?? ""),
      paperLabel: String(row.paperLabel ?? ""),
      durationMinutes: Number(row.durationMinutes ?? 0),
      questionCount: Number(row.questionCount ?? 0),
      sourcePaperPdfRelativePath:
        (row.sourcePaperPdfRelativePath as string | null | undefined) ?? null,
      sourceMemoPdfRelativePath:
        (row.sourceMemoPdfRelativePath as string | null | undefined) ?? null,
    };
  });
}

export type SubjectPayload = {
  id: string;
  label: string;
  description: string;
};

export async function fetchSubjects(): Promise<SubjectPayload[]> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/subjects`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to list subjects (${res.status})`);
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return data.map((s) => {
    const row = s as Record<string, unknown>;
    return {
      id: String(row.id ?? ""),
      label: String(row.label ?? ""),
      description: String(row.description ?? ""),
    };
  });
}
