export type SubjectId = "maths" | "physical-science" | "life-sciences" | "accounting";

export type Difficulty = "easy" | "moderate" | "hard";

export type McqOption = {
  id: string;
  text: string;
};

export type McqQuestion = {
  id: string;
  topic: string;
  difficulty: Difficulty;
  prompt: string;
  options: McqOption[];
  correctOptionId: string;
  explanation: string;
};

export type PastPaper = {
  id: string;
  subjectId: SubjectId;
  subjectLabel: string;
  year: number;
  title: string;
  paperLabel: string;
  durationMinutes: number;
  questionCount: number;
  topics: string[];
  questions: McqQuestion[];
};

/** Loaded from GET /api/papers/{id}/take — no correct answers on questions. */
export type TakeQuestion = {
  id: string;
  questionType: string;
  topic: string;
  difficulty: string;
  prompt: string;
  options: McqOption[];
  marks: number | null;
};

export type TakePaper = {
  id: string;
  subjectId: string;
  subjectLabel: string;
  year: number;
  title: string;
  paperLabel: string;
  durationMinutes: number;
  questionCount: number;
  topics: string[];
  sourcePaperPdfRelativePath: string | null;
  sourceMemoPdfRelativePath: string | null;
  questions: TakeQuestion[];
};

export type TutorQuestion = {
  id: string;
  sortOrder: number;
  questionType: string;
  topic: string;
  difficulty: string;
  prompt: string;
  options: McqOption[];
  marks: number | null;
  memoAnswer: string | null;
  markingNotes: string | null;
  explanation: string | null;
  correctOptionId: string | null;
};

export type TutorPaper = {
  id: string;
  subjectId: string;
  subjectLabel: string;
  year: number;
  title: string;
  paperLabel: string;
  durationMinutes: number;
  questionCount: number;
  topics: string[];
  sourcePaperPdfRelativePath: string | null;
  sourceMemoPdfRelativePath: string | null;
  sourcePaperPdfUrl: string | null;
  /** Same origin as API when memo PDF exists on disk. */
  sourceMemoPdfUrl: string | null;
  /** Server has TutorChat enabled and provider credentials (e.g. Ollama or OpenAI key). */
  tutorChatEnabled: boolean;
  questions: TutorQuestion[];
};

export type SubjectSummary = {
  id: SubjectId;
  label: string;
  description: string;
  paperCount: number;
  accentClass: string;
};

export type QuestionBreakdown = {
  personalizedFeedback: string;
  frame: string;
  recall: string;
  plan: string;
  solve: string;
  review: string;
  raw: string;
};

export type LearnerProfile = {
  id: string;
  displayName: string;
  createdAtUtc: string;
  lastSeenAtUtc: string;
  targetExamDateUtc: string | null;
  subjectIds: string[];
};

export type TopicMastery = {
  subjectId: string;
  topic: string;
  attempts: number;
  correct: number;
  percent: number;
};

export type NextAction = {
  title: string;
  description: string;
  route: string;
  kind: string;
};

export type AnalyticsOverview = {
  readinessPercent: number;
  attempts: number;
  questionsAnswered: number;
  correctAnswers: number;
  weakTopics: TopicMastery[];
  strongTopics: TopicMastery[];
  nextActions: NextAction[];
};

export type StudyPlanStep = {
  id: string;
  sortOrder: number;
  stepType: string;
  title: string;
  description: string;
  subjectId: string | null;
  paperId: string | null;
  topic: string | null;
  toolRoute: string | null;
  isCompleted: boolean;
  completedAtUtc: string | null;
};

export type StudyPlan = {
  id: string;
  learnerId: string;
  subjectId: string;
  title: string;
  status: string;
  createdAtUtc: string;
  targetDateUtc: string | null;
  steps: StudyPlanStep[];
};

export type RevisionPack = {
  id: string;
  learnerId: string;
  subjectId: string;
  topic: string;
  title: string;
  summary: string;
  content: {
    sections?: { title: string; body: string }[];
    commonMistakes?: string[];
    drills?: string[];
  };
  sourcePaperId: string | null;
  sourceQuestionId: string | null;
  createdAtUtc: string;
};

export type Flashcard = {
  id: string;
  front: string;
  back: string;
  sourceQuestionId: string | null;
  difficulty: string;
  dueAtUtc: string;
  reviewCount: number;
};

export type FlashcardDeck = {
  id: string;
  learnerId: string;
  subjectId: string;
  topic: string;
  title: string;
  createdAtUtc: string;
  cards: Flashcard[];
};

export type QuizQuestion = {
  id: string;
  sortOrder: number;
  prompt: string;
  options: McqOption[];
  explanation: string | null;
  sourceQuestionId: string | null;
};

export type Quiz = {
  id: string;
  learnerId: string;
  subjectId: string;
  topic: string;
  title: string;
  createdAtUtc: string;
  questions: QuizQuestion[];
};

export type QuizAttemptResult = {
  attemptId: string;
  correct: number;
  total: number;
  percent: number;
  reviews: {
    quizQuestionId: string;
    isCorrect: boolean;
    chosenOptionId: string | null;
    correctOptionId: string | null;
    explanation: string | null;
  }[];
};
