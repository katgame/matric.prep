using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace MatricPrep.Ingestion;

public sealed class ManifestPaperResolver
{
    private static readonly Regex PaperFile = new(
        @"^Paper\s+(\d+)\s+\((English|Afrikaans)\)\.pdf$",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex MemoFile = new(
        @"^Memo\s+(\d+)\s+\((English|Afrikaans)\)\.pdf$",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public sealed record ResolvedPaths(
        string PaperRelativePath,
        string MemoRelativePath,
        string PaperTitle,
        string MemoTitle);

    /// <summary>Subject folder under non-languages/, paper number, language, and manifest-relative paths.</summary>
    public sealed record ManifestPaperPair(
        string SubjectFolder,
        int PaperNumber,
        string Language,
        string PaperRelativePath,
        string MemoRelativePath);

    public static ResolvedPaths Resolve(
        string examRoot,
        string session,
        string subjectFolder,
        int paperNumber,
        string language)
    {
        var manifestPath = Path.Combine(examRoot, session, "manifest.json");
        if (!File.Exists(manifestPath))
            throw new FileNotFoundException("manifest.json not found. Expected: " + manifestPath);

        var json = File.ReadAllText(manifestPath);
        var manifest = JsonSerializer.Deserialize<ManifestRoot>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });
        if (manifest?.Files is null || manifest.Files.Count == 0)
            throw new InvalidOperationException("Manifest has no files.");

        var prefix = $"non-languages/{subjectFolder.Trim().Trim('/')}/";
        string? paperPath = null;
        string? memoPath = null;
        string? paperTitle = null;
        string? memoTitle = null;

        foreach (var f in manifest.Files)
        {
            if (f.RelativePath is null) continue;
            if (!f.RelativePath.Replace('\\', '/').StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                continue;

            var fileName = Path.GetFileName(f.RelativePath);
            var pm = PaperFile.Match(fileName);
            if (pm.Success && int.Parse(pm.Groups[1].Value) == paperNumber &&
                string.Equals(pm.Groups[2].Value, language, StringComparison.OrdinalIgnoreCase))
            {
                paperPath = f.RelativePath.Replace('\\', '/');
                paperTitle = f.Title;
            }

            var mm = MemoFile.Match(fileName);
            if (mm.Success && int.Parse(mm.Groups[1].Value) == paperNumber &&
                string.Equals(mm.Groups[2].Value, language, StringComparison.OrdinalIgnoreCase))
            {
                memoPath = f.RelativePath.Replace('\\', '/');
                memoTitle = f.Title;
            }
        }

        if (paperPath is null)
            throw new InvalidOperationException(
                $"No question paper found for {prefix} Paper {paperNumber} ({language}). Check manifest and filenames.");

        if (memoPath is null)
            throw new InvalidOperationException(
                $"No memorandum found for {prefix} Memo {paperNumber} ({language}). Check manifest and filenames.");

        return new ResolvedPaths(paperPath, memoPath, paperTitle ?? "", memoTitle ?? "");
    }

    /// <summary>
    /// Lists all non-language paper+memo pairs that match the standard filename pattern.
    /// </summary>
    public static IReadOnlyList<ManifestPaperPair> ListNonLanguagePairs(
        string examRoot,
        string session,
        string? subjectFolderFilter)
    {
        var manifestPath = Path.Combine(examRoot, session, "manifest.json");
        if (!File.Exists(manifestPath))
            throw new FileNotFoundException("manifest.json not found. Expected: " + manifestPath);

        var json = File.ReadAllText(manifestPath);
        var manifest = JsonSerializer.Deserialize<ManifestRoot>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });
        if (manifest?.Files is null || manifest.Files.Count == 0)
            return Array.Empty<ManifestPaperPair>();

        var papers = new Dictionary<(string Subject, int Num, string Lang), string>();
        var memos = new Dictionary<(string Subject, int Num, string Lang), string>();

        foreach (var f in manifest.Files)
        {
            if (f.RelativePath is null) continue;
            var norm = f.RelativePath.Replace('\\', '/');
            if (!norm.StartsWith("non-languages/", StringComparison.OrdinalIgnoreCase)) continue;

            var parts = norm.Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length < 3) continue;
            var subject = parts[1];
            if (subjectFolderFilter is not null &&
                !subject.Equals(subjectFolderFilter.Trim().Trim('/'), StringComparison.OrdinalIgnoreCase))
                continue;

            var fileName = Path.GetFileName(norm);
            var pm = PaperFile.Match(fileName);
            if (pm.Success)
            {
                var key = (subject, int.Parse(pm.Groups[1].Value), pm.Groups[2].Value);
                papers[key] = norm;
            }

            var mm = MemoFile.Match(fileName);
            if (mm.Success)
            {
                var key = (subject, int.Parse(mm.Groups[1].Value), mm.Groups[2].Value);
                memos[key] = norm;
            }
        }

        var pairs = new List<ManifestPaperPair>();
        foreach (var kv in papers)
        {
            if (!memos.TryGetValue(kv.Key, out var memoPath)) continue;
            pairs.Add(new ManifestPaperPair(
                kv.Key.Subject,
                kv.Key.Num,
                kv.Key.Lang,
                kv.Value,
                memoPath));
        }

        return pairs
            .OrderBy(p => p.SubjectFolder, StringComparer.OrdinalIgnoreCase)
            .ThenBy(p => p.PaperNumber)
            .ThenBy(p => p.Language, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private sealed class ManifestRoot
    {
        [JsonPropertyName("files")]
        public List<ManifestFile>? Files { get; set; }
    }

    private sealed class ManifestFile
    {
        public string? Title { get; set; }
        public string? RelativePath { get; set; }
    }
}
