namespace MatricPrep.Pipeline;

public sealed class ExtractBundle
{
    public required string Session { get; init; }
    public required string SubjectFolder { get; init; }
    public required int PaperNumber { get; init; }
    public required string Language { get; init; }
    public required string PaperRelativePath { get; init; }
    public required string MemoRelativePath { get; init; }
    public required string PaperText { get; init; }
    public required string MemoText { get; init; }
}
