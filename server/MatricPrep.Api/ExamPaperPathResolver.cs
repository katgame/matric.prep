using System.Diagnostics.CodeAnalysis;

namespace MatricPrep.Api;

/// <summary>Resolves <c>exam-papers/...</c> paths under <see cref="MatricPrepOptions.ResolvedExamPapersRoot"/>.</summary>
public static class ExamPaperPathResolver
{
    public const string Prefix = "exam-papers/";

    public static bool TryResolve(string? examRoot, string? relativePath, [NotNullWhen(true)] out string? absolutePath)
    {
        absolutePath = null;
        if (string.IsNullOrWhiteSpace(examRoot) || !Directory.Exists(examRoot)) return false;
        if (string.IsNullOrWhiteSpace(relativePath)) return false;
        var relative = relativePath.Replace('\\', '/');
        if (!relative.StartsWith(Prefix, StringComparison.OrdinalIgnoreCase)) return false;
        var fromExamRoot = relative[Prefix.Length..];
        var path = Path.Combine(examRoot, fromExamRoot.Replace('/', Path.DirectorySeparatorChar));
        if (!File.Exists(path)) return false;
        absolutePath = path;
        return true;
    }
}
