namespace MatricPrep.Api.Data;

public class Subject
{
    public required string Id { get; set; }
    public required string Label { get; set; }
    public required string Description { get; set; }
    public int SortOrder { get; set; }
}

public class Paper
{
    public required string Id { get; set; }
    public required string SubjectId { get; set; }
    public required string SubjectLabel { get; set; }
    public int Year { get; set; }
    public required string Title { get; set; }
    public required string PaperLabel { get; set; }
    public int DurationMinutes { get; set; }
    public int QuestionCount { get; set; }
    public string[] Topics { get; set; } = [];

    /// <summary>Relative path from repo root or configured content root (exam-papers/...).</summary>
    public string? SourcePaperPdfRelativePath { get; set; }

    /// <summary>Memorandum PDF (official answers / marking guidelines).</summary>
    public string? SourceMemoPdfRelativePath { get; set; }
}

public class Question
{
    public required string Id { get; set; }
    public required string PaperId { get; set; }
    public int SortOrder { get; set; }

    /// <summary>mcq, numeric, short_text, etc.</summary>
    public required string QuestionType { get; set; }

    public required string Topic { get; set; }
    public required string Difficulty { get; set; }

    /// <summary>Question stem (may include LaTeX-style math).</summary>
    public required string Prompt { get; set; }

    /// <summary>MCQ options as JSON array of { id, text }. Empty array for non-MCQ.</summary>
    public required string OptionsJson { get; set; }

    /// <summary>Correct option letter for MCQ; null for other types until supported.</summary>
    public string? CorrectOptionId { get; set; }

    /// <summary>Official answer / solution text from the memorandum.</summary>
    public string? MemoAnswer { get; set; }

    /// <summary>Optional extra marking guidance from the memo.</summary>
    public string? MarkingNotes { get; set; }

    /// <summary>Marks for this question (from exam paper), if known.</summary>
    public int? Marks { get; set; }

    /// <summary>Short learner-facing explanation (may mirror memo for MCQ).</summary>
    public string? Explanation { get; set; }
}

public class Attempt
{
    public Guid Id { get; set; }
    public string? LearnerId { get; set; }
    public required string PaperId { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public int DurationSeconds { get; set; }
    public int CorrectCount { get; set; }
    public int TotalCount { get; set; }
}

public class LearnerProfile
{
    public required string Id { get; set; }
    public string DisplayName { get; set; } = "Matric learner";
    public DateTime CreatedAtUtc { get; set; }
    public DateTime LastSeenAtUtc { get; set; }
    public DateTime? TargetExamDateUtc { get; set; }
    public string[] SubjectIds { get; set; } = [];
}

public class AttemptAnswer
{
    public Guid Id { get; set; }
    public Guid AttemptId { get; set; }
    public required string PaperId { get; set; }
    public required string QuestionId { get; set; }
    public string? Topic { get; set; }
    public string? ChosenOptionId { get; set; }
    public string? CorrectOptionId { get; set; }
    public bool IsCorrect { get; set; }
    public bool IsScorable { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public class StudyPlan
{
    public Guid Id { get; set; }
    public required string LearnerId { get; set; }
    public required string SubjectId { get; set; }
    public required string Title { get; set; }
    public string Status { get; set; } = "Active";
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? TargetDateUtc { get; set; }
}

public class StudyPlanStep
{
    public Guid Id { get; set; }
    public Guid StudyPlanId { get; set; }
    public int SortOrder { get; set; }
    public required string StepType { get; set; }
    public required string Title { get; set; }
    public string Description { get; set; } = "";
    public string? SubjectId { get; set; }
    public string? PaperId { get; set; }
    public string? Topic { get; set; }
    public string? ToolRoute { get; set; }
    public bool IsCompleted { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
}

public class RevisionPack
{
    public Guid Id { get; set; }
    public required string LearnerId { get; set; }
    public required string SubjectId { get; set; }
    public required string Topic { get; set; }
    public required string Title { get; set; }
    public string Summary { get; set; } = "";
    public string ContentJson { get; set; } = "{}";
    public string? SourcePaperId { get; set; }
    public string? SourceQuestionId { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public class FlashcardDeck
{
    public Guid Id { get; set; }
    public required string LearnerId { get; set; }
    public required string SubjectId { get; set; }
    public required string Topic { get; set; }
    public required string Title { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public class Flashcard
{
    public Guid Id { get; set; }
    public Guid DeckId { get; set; }
    public required string Front { get; set; }
    public required string Back { get; set; }
    public string? SourceQuestionId { get; set; }
    public string Difficulty { get; set; } = "new";
    public DateTime DueAtUtc { get; set; }
    public int ReviewCount { get; set; }
    public double Ease { get; set; } = 2.5;
}

public class Quiz
{
    public Guid Id { get; set; }
    public required string LearnerId { get; set; }
    public required string SubjectId { get; set; }
    public required string Topic { get; set; }
    public required string Title { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public class QuizQuestion
{
    public Guid Id { get; set; }
    public Guid QuizId { get; set; }
    public int SortOrder { get; set; }
    public required string Prompt { get; set; }
    public required string OptionsJson { get; set; }
    public string? CorrectOptionId { get; set; }
    public string? Explanation { get; set; }
    public string? SourceQuestionId { get; set; }
}

public class QuizAttempt
{
    public Guid Id { get; set; }
    public Guid QuizId { get; set; }
    public required string LearnerId { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public int CorrectCount { get; set; }
    public int TotalCount { get; set; }
}

public class QuizAttemptAnswer
{
    public Guid Id { get; set; }
    public Guid QuizAttemptId { get; set; }
    public Guid QuizQuestionId { get; set; }
    public string? OptionId { get; set; }
    public bool IsCorrect { get; set; }
}

public class IngestionJob
{
    public Guid Id { get; set; }

    /// <summary>Pending, Running, Completed, Failed</summary>
    public required string Status { get; set; }

    public required string Session { get; set; }

    public required string SubjectFolder { get; set; }

    public int PaperNumber { get; set; }

    public required string Language { get; set; }

    /// <summary>Path relative to the session folder (e.g. non-languages/accounting/Paper 1 (English).pdf).</summary>
    public required string PaperRelativePath { get; set; }

    public required string MemoRelativePath { get; set; }

    public string? ResultPaperId { get; set; }

    public string? ErrorMessage { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? StartedAtUtc { get; set; }

    public DateTimeOffset? CompletedAtUtc { get; set; }
}

