using System.Globalization;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using MatricPrep.Contracts;
using MatricPrep.Ingestion;

namespace MatricPrep.Pipeline;

/// <summary>
/// Calls an OpenAI-compatible chat API (local Ollama by default, or OpenAI) to build a <see cref="PaperImportDto"/>.
/// </summary>
public static class LlmImportGenerator
{
    public const string ProviderOllama = "ollama";
    public const string ProviderOpenAi = "openai";

    public static async Task<PaperImportDto> GenerateAsync(
        string paperText,
        string memoText,
        string session,
        string subjectFolder,
        string paperRelativePath,
        string memoRelativePath,
        int paperNumber,
        string language,
        LlmGenerateOptions options,
        CancellationToken ct = default)
    {
        var provider = options.Provider.Trim().ToLowerInvariant();
        if (provider is not (ProviderOllama or ProviderOpenAi))
            throw new ArgumentException($"Unknown provider '{options.Provider}'. Use '{ProviderOllama}' or '{ProviderOpenAi}'.");

        if (provider == ProviderOpenAi)
        {
            var key = options.OpenAiApiKey ?? Environment.GetEnvironmentVariable("OPENAI_API_KEY");
            if (string.IsNullOrWhiteSpace(key))
                throw new InvalidOperationException(
                    $"Provider '{ProviderOpenAi}' requires OPENAI_API_KEY or --openai-key.");
        }

        var subjectSlug = subjectFolder.Trim().Trim('/').Split('/').Last();
        var year = InferYear(session);
        var subjectLabel = ToTitleCase(subjectSlug.Replace('-', ' '));

        var system = """
            You are an expert exam content importer for South African NSC National Senior Certificate papers.
            You receive raw text extracted from a question paper PDF and from its official memorandum PDF.
            Your job is to produce a SINGLE JSON OBJECT only (no markdown, no prose, no questions back to the user).
            The JSON MUST be valid and MUST start with '{' and end with '}'.
            If some fields are unknown, use null or best-effort inference; do NOT ask clarifying questions.

            Output must match this schema:

            id: string (slug format: lowercase letters, digits, hyphens; include session and subject and paper number, e.g. "2025-may-june-accounting-p1-en")
            subjectId: string (short slug, e.g. "accounting")
            subjectLabel: string (human-readable subject name)
            year: number
            title: string (e.g. "NSC Accounting Paper 1 (English)")
            paperLabel: string (e.g. "Paper 1")
            durationMinutes: number (use 180 for most exams unless clearly shorter)
            topics: string[] (2–8 short topic tags inferred from the paper)
            sourcePaperPdfRelativePath: string (repo-relative path starting with exam-papers/...)
            sourceMemoPdfRelativePath: string (repo-relative path starting with exam-papers/...)
            questions: array of objects, each with:
              id: string (unique within paper)
              sortOrder: number (1-based)
              questionType: "mcq"
              topic: string
              difficulty: one of "easy", "moderate", "hard"
              prompt: string (the exact question stem / wording from the paper; plain text)
              options: exactly five answers as { "id": "A"|"B"|"C"|"D"|"E", "text": "..." }
              correctOptionId: one of "A"|"B"|"C"|"D"|"E"
              memoAnswer: string (official answer / marking guidance from the memorandum for this question)
              markingNotes: string or null (mark allocation or method notes if visible)
              marks: number or null
              explanation: string or null (short learner-facing explanation)

            Rules:
            - Prefer splitting by question numbers (e.g. QUESTION 1, 1.1, 2.3, etc.). Each sub-question can be its own item.
            - Convert every extracted question into a five-option multiple-choice question.
            - Preserve the original exam question wording in prompt; do not rewrite it into a new question.
            - Use the memo to create one correct answer and four plausible distractors.
            - Do not leak obvious memo wording into the distractors.
            - Use option IDs exactly A, B, C, D, and E.
            - Align memo answers with memo text for the same question numbers.
            - Use relative paths exactly as given in the user message for source PDF fields (prefixed with exam-papers/...).
            """;

        var examPrefix = $"exam-papers/{session}";
        var paperRel = $"{examPrefix}/{paperRelativePath}";
        var memoRel = $"{examPrefix}/{memoRelativePath}";

        var user = $"""
            session: {session}
            subjectFolder: {subjectFolder}
            paperNumber: {paperNumber}
            language: {language}
            year: {year}
            inferred subjectLabel: {subjectLabel}
            sourcePaperPdfRelativePath: {paperRel}
            sourceMemoPdfRelativePath: {memoRel}

            --- QUESTION PAPER TEXT ---
            {Truncate(paperText, 80_000)}

            --- MEMORANDUM TEXT ---
            {Truncate(memoText, 80_000)}
            """;

        using var http = new HttpClient();
        http.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
        var baseUri = provider == ProviderOllama
            ? NormalizeBase(options.OllamaBaseUrl ?? Environment.GetEnvironmentVariable("OLLAMA_BASE_URL") ?? "http://localhost:11434")
            : NormalizeBase(options.OpenAiBaseUrl ?? Environment.GetEnvironmentVariable("OPENAI_BASE_URL") ?? "https://api.openai.com/v1");
        http.BaseAddress = baseUri;

        if (provider == ProviderOpenAi)
        {
            var key = options.OpenAiApiKey ?? Environment.GetEnvironmentVariable("OPENAI_API_KEY");
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", key);
        }

        string content;
        if (provider == ProviderOllama)
        {
            // Use Ollama native endpoint with enforced JSON output.
            var schema = PaperImportJsonSchema();
            var body = new
            {
                model = options.Model,
                stream = false,
                // Prefer JSON schema enforcement (more reliable than format=\"json\" on some models).
                format = schema,
                messages = new object[]
                {
                    new { role = "system", content = system },
                    new { role = "user", content = user }
                },
                options = new { temperature = 0 }
            };

            using var response = await http.PostAsJsonAsync("api/chat", body, cancellationToken: ct);
            var responseBody = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode)
                throw new InvalidOperationException($"Ollama error {(int)response.StatusCode}: {responseBody}");

            var parsed = JsonSerializer.Deserialize<OllamaChatResponse>(responseBody, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
            content = parsed?.Message?.Content ?? "";
            if (string.IsNullOrWhiteSpace(content))
                throw new InvalidOperationException("Ollama returned no message content.");
        }
        else
        {
            var body = new
            {
                model = options.Model,
                messages = new object[]
                {
                    new { role = "system", content = system },
                    new { role = "user", content = user }
                },
                response_format = new { type = "json_object" }
            };

            using var response = await http.PostAsJsonAsync("chat/completions", body, cancellationToken: ct);
            var responseBody = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode)
                throw new InvalidOperationException($"OpenAI error {(int)response.StatusCode}: {responseBody}");

            var parsed = JsonSerializer.Deserialize<ChatCompletionResponse>(responseBody, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
            content = parsed?.Choices?.FirstOrDefault()?.Message?.Content ?? "";
            if (string.IsNullOrWhiteSpace(content))
                throw new InvalidOperationException("OpenAI returned no message content.");
        }

        var contentTrimmed = content.TrimStart();
        var jsonPayload = contentTrimmed;
        if (!contentTrimmed.StartsWith("{", StringComparison.Ordinal))
        {
            // Some local models wrap the JSON in prose. Try to salvage the first top-level object.
            var first = contentTrimmed.IndexOf('{');
            var last = contentTrimmed.LastIndexOf('}');
            if (first >= 0 && last > first)
            {
                jsonPayload = contentTrimmed[first..(last + 1)];
            }
            else
            {
                var dumpPath = DumpNonJson(provider, options.Model, contentTrimmed);
                // Some models refuse despite JSON mode; fall back to deterministic parsing from paper/memo text.
                return DeterministicPaperImportBuilder.Build(
                    session,
                    subjectFolder,
                    paperNumber,
                    language,
                    paperRelativePath,
                    memoRelativePath,
                    paperText,
                    memoText,
                    $"LLM non-JSON output. Dump: {dumpPath}");
            }
        }

        var opts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        PaperImportDto? dto;
        try
        {
            dto = JsonSerializer.Deserialize<PaperImportDto>(jsonPayload, opts);
        }
        catch (JsonException je)
        {
            var preview = jsonPayload.TrimStart();
            var dumpPath = DumpNonJson(provider, options.Model, preview);
            return DeterministicPaperImportBuilder.Build(
                session,
                subjectFolder,
                paperNumber,
                language,
                paperRelativePath,
                memoRelativePath,
                paperText,
                memoText,
                $"LLM JSON parse failure ({je.Message}). Dump: {dumpPath}");
        }
        if (dto is null)
        {
            return DeterministicPaperImportBuilder.Build(
                session,
                subjectFolder,
                paperNumber,
                language,
                paperRelativePath,
                memoRelativePath,
                paperText,
                memoText,
                "LLM returned null dto.");
        }

        return dto;
    }

    private static Uri NormalizeBase(string url)
    {
        var t = url.TrimEnd('/');
        return new Uri(t + "/");
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

    private sealed class ChatCompletionResponse
    {
        public List<ChatChoice>? Choices { get; set; }
    }

    private sealed class ChatChoice
    {
        public ChatMessage? Message { get; set; }
    }

    private sealed class ChatMessage
    {
        public string? Content { get; set; }
    }

    private sealed class OllamaChatResponse
    {
        public OllamaMessage? Message { get; set; }
    }

    private sealed class OllamaMessage
    {
        public string? Content { get; set; }
    }

    private static object PaperImportJsonSchema()
    {
        // Minimal schema to enforce a valid PaperImportDto JSON object.
        return new
        {
            type = "object",
            additionalProperties = false,
            required = new[]
            {
                "id",
                "subjectId",
                "subjectLabel",
                "year",
                "title",
                "paperLabel",
                "durationMinutes",
                "topics",
                "sourcePaperPdfRelativePath",
                "sourceMemoPdfRelativePath",
                "questions"
            },
            properties = new Dictionary<string, object>
            {
                ["id"] = new { type = "string" },
                ["subjectId"] = new { type = "string" },
                ["subjectLabel"] = new { type = "string" },
                ["year"] = new { type = "integer" },
                ["title"] = new { type = "string" },
                ["paperLabel"] = new { type = "string" },
                ["durationMinutes"] = new { type = "integer" },
                ["topics"] = new { type = "array", items = new { type = "string" } },
                ["sourcePaperPdfRelativePath"] = new { type = new[] { "string", "null" } },
                ["sourceMemoPdfRelativePath"] = new { type = new[] { "string", "null" } },
                ["questions"] = new
                {
                    type = "array",
                    items = new
                    {
                        type = "object",
                        additionalProperties = false,
                        required = new[]
                        {
                            "id",
                            "sortOrder",
                            "questionType",
                            "topic",
                            "difficulty",
                            "prompt",
                            "options",
                            "correctOptionId",
                            "memoAnswer",
                            "markingNotes",
                            "marks",
                            "explanation"
                        },
                        properties = new Dictionary<string, object>
                        {
                            ["id"] = new { type = "string" },
                            ["sortOrder"] = new { type = "integer" },
                            ["questionType"] = new { type = "string", @enum = new[] { "mcq" } },
                            ["topic"] = new { type = "string" },
                            ["difficulty"] = new { type = "string" },
                            ["prompt"] = new { type = "string" },
                            ["options"] = new
                            {
                                type = "array",
                                minItems = 5,
                                maxItems = 5,
                                items = new
                                {
                                    type = "object",
                                    additionalProperties = false,
                                    required = new[] { "id", "text" },
                                    properties = new Dictionary<string, object>
                                    {
                                        ["id"] = new { type = "string", @enum = new[] { "A", "B", "C", "D", "E" } },
                                        ["text"] = new { type = "string" }
                                    }
                                }
                            },
                            ["correctOptionId"] = new { type = "string", @enum = new[] { "A", "B", "C", "D", "E" } },
                            ["memoAnswer"] = new { type = new[] { "string", "null" } },
                            ["markingNotes"] = new { type = new[] { "string", "null" } },
                            ["marks"] = new { type = new[] { "integer", "null" } },
                            ["explanation"] = new { type = new[] { "string", "null" } }
                        }
                    }
                }
            }
        };
    }

    private static string DumpNonJson(string provider, string model, string text)
    {
        var safeProvider = string.Concat(provider.Where(ch => char.IsLetterOrDigit(ch) || ch == '-' || ch == '_'));
        var safeModel = string.Concat(model.Where(ch => char.IsLetterOrDigit(ch) || ch == '-' || ch == '_' || ch == '.'));
        var file = $"matricprep-llm-dump-{safeProvider}-{safeModel}-{DateTime.UtcNow:yyyyMMdd-HHmmss}-{Guid.NewGuid():N}.txt";
        var path = Path.Combine(Path.GetTempPath(), file);
        File.WriteAllText(path, text ?? string.Empty);
        return path;
    }

}

/// <summary>Options for <see cref="LlmImportGenerator.GenerateAsync"/>.</summary>
public sealed class LlmGenerateOptions
{
    /// <summary><see cref="LlmImportGenerator.ProviderOllama"/> or <see cref="LlmImportGenerator.ProviderOpenAi"/>.</summary>
    public required string Provider { get; init; }

    public required string Model { get; init; }

    public string? OpenAiApiKey { get; init; }

    /// <summary>Base URL for Ollama, e.g. http://localhost:11434</summary>
    public string? OllamaBaseUrl { get; init; }

    /// <summary>
    /// Base URL for the OpenAI-compatible endpoint. Defaults to https://api.openai.com/v1.
    /// Override to point at a local vLLM server: http://localhost:8000/v1
    /// </summary>
    public string? OpenAiBaseUrl { get; init; }

    /// <summary>HTTP timeout for the LLM request (seconds). Local models can take several minutes.</summary>
    public int TimeoutSeconds { get; init; } = 600;
}
