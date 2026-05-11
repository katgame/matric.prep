using System.Globalization;
using System.Text.RegularExpressions;
using MatricPrep.Contracts;

namespace MatricPrep.Ingestion;

/// <summary>
/// Builds <see cref="PaperImportDto"/> from extracted paper + memo text without an LLM (QUESTION-block heuristic).
/// </summary>
public static class DeterministicPaperImportBuilder
{
    public static PaperImportDto Build(
        string session,
        string subjectFolder,
        int paperNumber,
        string language,
        string paperRelativePath,
        string memoRelativePath,
        string paperText,
        string memoText,
        string? note = null)
    {
        var subjectSlug = subjectFolder.Trim().Trim('/').Split('/').Last();
        var subjectLabel = ToTitleCase(subjectSlug.Replace('-', ' '));
        var examPrefix = $"exam-papers/{session}";
        var paperRel = $"{examPrefix}/{paperRelativePath}";
        var memoRel = $"{examPrefix}/{memoRelativePath}";
        return BuildFallbackPaperImportDto(
            session,
            subjectSlug,
            subjectLabel,
            paperNumber,
            language,
            paperRel,
            memoRel,
            paperText,
            memoText,
            note ?? "Deterministic import (no LLM).");
    }

    private static PaperImportDto BuildFallbackPaperImportDto(
        string session,
        string subjectSlug,
        string subjectLabel,
        int paperNumber,
        string language,
        string paperRel,
        string memoRel,
        string paperText,
        string memoText,
        string reason)
    {
        var langSuffix = language.Length >= 2
            ? language[..2].ToLowerInvariant()
            : language.ToLowerInvariant();
        var id = $"{session}-{subjectSlug}-p{paperNumber}-{langSuffix}";
        var title = $"NSC {subjectLabel} Paper {paperNumber} ({language})";
        var questions = ExtractStructuredQuestions(id, paperText, memoText);
        var topics = questions.Select(q => q.Topic).Distinct(StringComparer.OrdinalIgnoreCase).Take(8).ToArray();
        if (topics.Length == 0) topics = ["General"];

        if (questions.Count == 0)
        {
            questions.Add(new QuestionImportDto(
                $"{id}-q1",
                1,
                "structured",
                "General",
                "moderate",
                "Full paper imported as one structured question block (fallback parser).",
                Array.Empty<object>(),
                null,
                Truncate(memoText, 1500),
                reason,
                null,
                "Fallback parser used because no QUESTION blocks were detected."));
        }

        return new PaperImportDto(
            id,
            subjectSlug,
            subjectLabel,
            InferYear(session),
            title,
            $"Paper {paperNumber}",
            120,
            topics,
            paperRel,
            memoRel,
            questions);
    }

    private static List<QuestionImportDto> ExtractStructuredQuestions(string paperId, string paperText, string memoText)
    {
        var results = new List<QuestionImportDto>();
        // Handles all NSC heading formats:
        //   "QUESTION 1"  "QUESTION 1."  "QUESTION 3: Algebra"
        //   "QUESTION 1/VRAAG 1"  (bilingual format A)
        //   "QUESTION/VRAAG 2"    (bilingual format B — no space before /VRAAG)
        var headingRx = new Regex(
            @"QUESTION(?:/VRAAG)?\s+(\d+)(?:/VRAAG\s+\d+)?\s*[:.]*\s*([^\r\n([]*)",
            RegexOptions.IgnoreCase);

        // When the question paper is image-only (no text layer), fall back to the memo.
        var sourceText = string.IsNullOrWhiteSpace(paperText) ? memoText : paperText;
        var headings = headingRx.Matches(sourceText).Cast<Match>().ToList();
        if (headings.Count == 0) return results;

        for (var i = 0; i < headings.Count; i++)
        {
            var qNo = headings[i].Groups[1].Value;
            var topic = Clean(headings[i].Groups[2].Value);
            var start = headings[i].Index;
            var end = i + 1 < headings.Count ? headings[i + 1].Index : sourceText.Length;
            var block = sourceText[start..Math.Min(end, sourceText.Length)];

            var topicLabel = LooksLikeTopic(topic) ? topic : "General";
            var prompt = BuildPromptFromPaperBlock(block, topicLabel);
            var memoBlock = string.IsNullOrWhiteSpace(paperText)
                ? block  // source IS the memo, so block == memo content
                : ExtractMemoBlock(memoText, qNo);
            var marks = TryParseMarksFromHeading(block);

            results.Add(new QuestionImportDto(
                $"{paperId}-q{qNo}",
                int.TryParse(qNo, out var n) ? n : i + 1,
                "structured",
                topicLabel,
                "moderate",
                prompt,
                Array.Empty<object>(),
                null,
                string.IsNullOrWhiteSpace(memoBlock) ? null : Truncate(memoBlock, 2000),
                null,
                marks,
                "Imported from exam paper + memorandum text via fallback parser."));
        }

        return results;
    }

    private static string BuildPromptFromPaperBlock(string block, string topic)
    {
        var clean = Clean(block);
        var subQ = Regex.Matches(clean, @"\b\d+\.\d+\b").Cast<Match>().Select(m => m.Value).Distinct().Take(10).ToArray();
        var excerpt = Truncate(clean, 1200);
        var nl = Environment.NewLine;
        if (subQ.Length > 0)
        {
            return $"Topic: {topic}.{nl}Sub-questions: {string.Join(", ", subQ)}.{nl}Paper section excerpt:{nl}{excerpt}";
        }

        return $"Topic: {topic}.{nl}Paper section excerpt:{nl}{excerpt}";
    }

    private static string ExtractMemoBlock(string memoText, string qNo)
    {
        // Match both bilingual formats: "QUESTION 1/VRAAG 1" and "QUESTION/VRAAG 2"
        var rx = new Regex($@"QUESTION(?:/VRAAG)?\s+{Regex.Escape(qNo)}\b", RegexOptions.IgnoreCase);
        var all = rx.Matches(memoText).Cast<Match>().ToList();
        if (all.Count == 0) return string.Empty;
        var start = all[0].Index;
        var nextRx = new Regex(@"QUESTION(?:/VRAAG)?\s+\d+\b", RegexOptions.IgnoreCase);
        var after = nextRx.Matches(memoText).Cast<Match>().FirstOrDefault(m => m.Index > start);
        var end = after is null ? memoText.Length : after.Index;
        return memoText[start..Math.Min(end, memoText.Length)];
    }

    private static int? TryParseMarksFromHeading(string headingBlock)
    {
        var m = Regex.Match(headingBlock, @"\((\d+)\s*marks", RegexOptions.IgnoreCase);
        return m.Success && int.TryParse(m.Groups[1].Value, out var marks) ? marks : null;
    }

    private static string Clean(string s) => Regex.Replace(s ?? string.Empty, @"\s+", " ").Trim();

    /// <summary>
    /// Returns true only when the captured text looks like a human-readable topic label
    /// (e.g. "Algebra and Equations") rather than mathematical content or memo answers.
    /// </summary>
    private static bool LooksLikeTopic(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return false;
        var t = text.Trim();
        // Must start with a letter
        if (!char.IsLetter(t[0])) return false;
        // Must contain at least one real word (2+ consecutive letters)
        if (!Regex.IsMatch(t, @"[a-zA-Z]{2,}")) return false;
        // Discard if it contains digits (e.g. "x 0 6.1") or math/memo markers
        if (t.Any(c => char.IsDigit(c) || c is '✓' or '✗' or '−' or '=' or '+' or '×' or '÷' or '<' or '>' or '∈' or '∞' or '∴' or '∀'))
            return false;
        return true;
    }

    private static int InferYear(string session)
    {
        foreach (var part in session.Split('-', StringSplitOptions.RemoveEmptyEntries))
        {
            if (part.Length == 4 && int.TryParse(part, out var y) && y is >= 1990 and <= 2100)
                return y;
        }

        return DateTime.UtcNow.Year;
    }

    private static string ToTitleCase(string s)
    {
        if (string.IsNullOrEmpty(s)) return s;
        return CultureInfo.InvariantCulture.TextInfo.ToTitleCase(s.ToLowerInvariant());
    }

    private static string Truncate(string text, int max)
    {
        if (string.IsNullOrEmpty(text) || text.Length <= max) return text;
        return text[..max] + "\n\n[truncated]";
    }
}
