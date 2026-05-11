namespace MatricPrep.Api;

/// <summary>Configuration under section "MatricPrep".</summary>
public sealed class MatricPrepOptions
{
    public const string SectionName = "MatricPrep";

    /// <summary>Absolute path to the folder that contains session subfolders (e.g. .../exam-papers).</summary>
    public string? ExamPapersRoot { get; set; }

    /// <summary>Maximum concurrent ingestion jobs processed by the background worker.</summary>
    public int MaxConcurrentIngestionJobs { get; set; } = 2;

    /// <summary>Optional conversational tutor (LLM) for /api/papers/.../tutor-chat.</summary>
    public TutorChatOptions TutorChat { get; set; } = new();

    /// <summary>Effective root folder (configuration or MATRICPREP_EXAM_PAPERS_ROOT).</summary>
    public string? ResolvedExamPapersRoot()
    {
        var r = ExamPapersRoot?.Trim();
        if (!string.IsNullOrEmpty(r)) return r;
        return Environment.GetEnvironmentVariable("MATRICPREP_EXAM_PAPERS_ROOT");
    }
}
