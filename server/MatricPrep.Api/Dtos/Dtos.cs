using System.Text.Json.Serialization;

namespace MatricPrep.Api.Dtos;

public record SubjectDto(string Id, string Label, string Description);

public record PaperListDto(
    string Id,
    string SubjectId,
    string SubjectLabel,
    int Year,
    string Title,
    string PaperLabel,
    int DurationMinutes,
    int QuestionCount,
    string? SourcePaperPdfRelativePath,
    string? SourceMemoPdfRelativePath);

/// <summary>Student-safe payload for taking a test (no correct answers or memo).</summary>
public record PaperTakeDetailDto(
    string Id,
    string SubjectId,
    string SubjectLabel,
    int Year,
    string Title,
    string PaperLabel,
    int DurationMinutes,
    int QuestionCount,
    string[] Topics,
    string? SourcePaperPdfRelativePath,
    string? SourceMemoPdfRelativePath,
    List<QuestionTakeDto> Questions);

public record QuestionTakeDto(
    string Id,
    string QuestionType,
    string Topic,
    string Difficulty,
    string Prompt,
    object Options,
    int? Marks);

public record CreateAttemptRequest(string PaperId, int DurationSeconds, List<CreateAttemptAnswer> Answers, string? LearnerId = null);

public record CreateAttemptAnswer(string QuestionId, string OptionId);

public record AttemptResultDto(
    Guid AttemptId,
    int Correct,
    int Total,
    int Percent,
    List<QuestionReviewDto> Reviews);

public record QuestionReviewDto(
    string QuestionId,
    string QuestionType,
    bool IsCorrect,
    string? ChosenOptionId,
    string? CorrectOptionId,
    string? MemoAnswer,
    string? MarkingNotes,
    string? Explanation);

/// <summary>Guided learning payload (includes memo and explanations).</summary>
public record PaperTutorDetailDto(
    string Id,
    string SubjectId,
    string SubjectLabel,
    int Year,
    string Title,
    string PaperLabel,
    int DurationMinutes,
    int QuestionCount,
    string[] Topics,
    string? SourcePaperPdfRelativePath,
    string? SourceMemoPdfRelativePath,
    string? SourcePaperPdfUrl,
    string? SourceMemoPdfUrl,
    bool TutorChatEnabled,
    List<QuestionTutorDto> Questions);

public record TutorChatRequest([property: JsonPropertyName("messages")] List<TutorChatMessageDto>? Messages);

public record TutorChatMessageDto(
    [property: JsonPropertyName("role")] string Role,
    [property: JsonPropertyName("content")] string Content);

public record TutorChatResponse(string Reply);

public record BreakdownRequest(
    [property: JsonPropertyName("studentAnswer")] string? StudentAnswer);

public record BreakdownResponse(
    string PersonalizedFeedback,
    string Frame,
    string Recall,
    string Plan,
    string Solve,
    string Review,
    string Raw);

public record QuestionTutorDto(
    string Id,
    int SortOrder,
    string QuestionType,
    string Topic,
    string Difficulty,
    string Prompt,
    object Options,
    int? Marks,
    string? MemoAnswer,
    string? MarkingNotes,
    string? Explanation,
    string? CorrectOptionId);

public record EnqueueSingleJobRequest(
    string Session,
    string SubjectFolder,
    int PaperNumber,
    string Language);

public record BulkEnqueueJobsRequest(string Session, string? SubjectFolder);

public record IngestionJobDto(
    Guid Id,
    string Status,
    string Session,
    string SubjectFolder,
    int PaperNumber,
    string Language,
    string? ResultPaperId,
    string? ErrorMessage,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? StartedAtUtc,
    DateTimeOffset? CompletedAtUtc);

public record LearnerProfileDto(
    string Id,
    string DisplayName,
    DateTime CreatedAtUtc,
    DateTime LastSeenAtUtc,
    DateTime? TargetExamDateUtc,
    string[] SubjectIds);

public record UpsertLearnerProfileRequest(
    string? Id,
    string? DisplayName,
    DateTime? TargetExamDateUtc,
    string[]? SubjectIds);

public record AnalyticsOverviewDto(
    int ReadinessPercent,
    int Attempts,
    int QuestionsAnswered,
    int CorrectAnswers,
    List<TopicMasteryDto> WeakTopics,
    List<TopicMasteryDto> StrongTopics,
    List<NextActionDto> NextActions);

public record TopicMasteryDto(
    string SubjectId,
    string Topic,
    int Attempts,
    int Correct,
    int Percent);

public record NextActionDto(
    string Title,
    string Description,
    string Route,
    string Kind);

public record GenerateStudyPlanRequest(
    string LearnerId,
    string SubjectId,
    DateTime? TargetDateUtc,
    string[]? FocusTopics);

public record StudyPlanDto(
    Guid Id,
    string LearnerId,
    string SubjectId,
    string Title,
    string Status,
    DateTime CreatedAtUtc,
    DateTime? TargetDateUtc,
    List<StudyPlanStepDto> Steps);

public record StudyPlanStepDto(
    Guid Id,
    int SortOrder,
    string StepType,
    string Title,
    string Description,
    string? SubjectId,
    string? PaperId,
    string? Topic,
    string? ToolRoute,
    bool IsCompleted,
    DateTime? CompletedAtUtc);

public record GenerateRevisionPackRequest(
    string LearnerId,
    string SubjectId,
    string? Topic,
    string? PaperId,
    string? QuestionId);

public record RevisionPackDto(
    Guid Id,
    string LearnerId,
    string SubjectId,
    string Topic,
    string Title,
    string Summary,
    object Content,
    string? SourcePaperId,
    string? SourceQuestionId,
    DateTime CreatedAtUtc);

public record GenerateFlashcardDeckRequest(
    string LearnerId,
    string SubjectId,
    string? Topic,
    string? PaperId,
    string? QuestionId);

public record FlashcardDeckDto(
    Guid Id,
    string LearnerId,
    string SubjectId,
    string Topic,
    string Title,
    DateTime CreatedAtUtc,
    List<FlashcardDto> Cards);

public record FlashcardDto(
    Guid Id,
    string Front,
    string Back,
    string? SourceQuestionId,
    string Difficulty,
    DateTime DueAtUtc,
    int ReviewCount);

public record ReviewFlashcardRequest(string Rating);

public record GenerateQuizRequest(
    string LearnerId,
    string SubjectId,
    string? Topic,
    string? PaperId,
    int? QuestionCount);

public record QuizDto(
    Guid Id,
    string LearnerId,
    string SubjectId,
    string Topic,
    string Title,
    DateTime CreatedAtUtc,
    List<QuizQuestionDto> Questions);

public record QuizQuestionDto(
    Guid Id,
    int SortOrder,
    string Prompt,
    object Options,
    string? Explanation,
    string? SourceQuestionId);

public record SubmitQuizAttemptRequest(
    string LearnerId,
    List<SubmitQuizAnswer> Answers);

public record SubmitQuizAnswer(Guid QuizQuestionId, string OptionId);

public record QuizAttemptResultDto(
    Guid AttemptId,
    int Correct,
    int Total,
    int Percent,
    List<QuizQuestionReviewDto> Reviews);

public record QuizQuestionReviewDto(
    Guid QuizQuestionId,
    bool IsCorrect,
    string? ChosenOptionId,
    string? CorrectOptionId,
    string? Explanation);
