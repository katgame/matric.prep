namespace MatricPrep.Contracts;

/// <summary>
/// Import bundle for a single paper + questions (from paper.import.json or LLM output).
/// Paths are relative to the repo root (exam-papers/...).
/// </summary>
public record PaperImportDto(
    string Id,
    string SubjectId,
    string SubjectLabel,
    int Year,
    string Title,
    string PaperLabel,
    int DurationMinutes,
    string[] Topics,
    string? SourcePaperPdfRelativePath,
    string? SourceMemoPdfRelativePath,
    List<QuestionImportDto> Questions);

public record QuestionImportDto(
    string Id,
    int SortOrder,
    string QuestionType,
    string Topic,
    string Difficulty,
    string Prompt,
    object Options,
    string? CorrectOptionId,
    string? MemoAnswer,
    string? MarkingNotes,
    int? Marks,
    string? Explanation);
