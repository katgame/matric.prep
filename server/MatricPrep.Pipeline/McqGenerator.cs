using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace MatricPrep.Pipeline;

/// <summary>
/// Calls Claude or OpenAI to split a [latex]-tagged question block into per-sub-question MCQs (A–E).
/// </summary>
public static class McqGenerator
{
    private const string AnthropicUrl = "https://api.anthropic.com/v1/messages";
    private const string OpenAiUrl = "https://api.openai.com/v1/chat/completions";
    public const string DefaultModel = "claude-haiku-4-5-20251001";
    public const string DefaultOpenAiModel = "gpt-4o-mini";
    public const string ProviderAnthropic = "anthropic";
    public const string ProviderOpenAi = "openai";

    public sealed record McqOptionDto(string Id, string Text);
    public sealed record GeneratedMcq(string SubRef, string Stem, IReadOnlyList<McqOptionDto> Options, string CorrectOptionId);

    public static async Task<IReadOnlyList<GeneratedMcq>> GenerateForQuestionAsync(
        string questionTopic,
        string latexContent,
        string apiKey,
        string model = DefaultModel,
        int timeoutSeconds = 120,
        string provider = ProviderAnthropic,
        CancellationToken ct = default)
    {
        const string system = """
            You create multiple-choice exam questions from South African NSC Mathematics sub-questions.
            Rules:
            - For each numbered sub-question, produce EXACTLY 5 options labelled A, B, C, D, E.
            - One option must be correct; the rest must be plausible distractors (sign errors, wrong formula, arithmetic slips).
            - Use $...$ for all mathematical expressions in STEM and options.
            - Skip sub-questions that ask to "draw", "sketch", "prove", "show that", "describe", "explain", or are worth 0 marks.
            - Output ONLY the structured blocks below — no other text.
            """;

        var user = $"""
            Topic: {questionTopic}

            {latexContent}

            For EACH testable sub-question, output this exact block (repeat per sub-question):

            SUB: <ref e.g. 1.1.1>
            STEM: <self-contained question with LaTeX>
            A: <option with LaTeX if needed>
            B: <option>
            C: <option>
            D: <option>
            E: <option>
            CORRECT: <A|B|C|D|E>
            ---
            """;

        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(timeoutSeconds) };
        string responseText;

        if (provider == ProviderOpenAi)
        {
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            var requestBody = new
            {
                model,
                messages = new[]
                {
                    new { role = "system", content = system },
                    new { role = "user", content = user }
                },
                max_tokens = 4096
            };
            var jsonBody = JsonSerializer.Serialize(requestBody, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
            using var response = await http.PostAsync(OpenAiUrl, new StringContent(jsonBody, Encoding.UTF8, "application/json"), ct);
            var body = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode)
                throw new InvalidOperationException($"OpenAI API {(int)response.StatusCode}: {body}");
            using var doc = JsonDocument.Parse(body);
            responseText = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString() ?? "";
        }
        else
        {
            http.DefaultRequestHeaders.Add("x-api-key", apiKey);
            http.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");
            var requestBody = new
            {
                model,
                max_tokens = 4096,
                system,
                messages = new[] { new { role = "user", content = user } }
            };
            var jsonBody = JsonSerializer.Serialize(requestBody, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
            using var response = await http.PostAsync(AnthropicUrl, new StringContent(jsonBody, Encoding.UTF8, "application/json"), ct);
            var body = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode)
                throw new InvalidOperationException($"Claude API {(int)response.StatusCode}: {body}");
            using var doc = JsonDocument.Parse(body);
            responseText = doc.RootElement
                .GetProperty("content")[0]
                .GetProperty("text")
                .GetString() ?? "";
        }

        return ParseBlocks(responseText);
    }

    private static IReadOnlyList<GeneratedMcq> ParseBlocks(string text)
    {
        var results = new List<GeneratedMcq>();
        var blocks = Regex.Split(text.Trim(), @"\n---+\n?|\n---+$")
            .Select(b => b.Trim())
            .Where(b => b.Length > 0 && b.Contains("SUB:"));

        foreach (var block in blocks)
        {
            var sub = FieldValue(block, "SUB");
            var stem = FieldValue(block, "STEM");
            var correct = FieldValue(block, "CORRECT");

            if (string.IsNullOrWhiteSpace(sub) || string.IsNullOrWhiteSpace(stem) || string.IsNullOrWhiteSpace(correct))
                continue;

            var options = new List<McqOptionDto>();
            foreach (var letter in new[] { "A", "B", "C", "D", "E" })
            {
                var val = FieldValue(block, letter);
                if (string.IsNullOrWhiteSpace(val)) break;
                options.Add(new McqOptionDto(letter, val));
            }

            if (options.Count != 5) continue;

            var correctNorm = correct.Trim().ToUpperInvariant();
            if (correctNorm.Length > 1) correctNorm = correctNorm[..1];
            if (!new[] { "A", "B", "C", "D", "E" }.Contains(correctNorm)) continue;

            results.Add(new GeneratedMcq(sub, stem, options, correctNorm));
        }

        return results;
    }

    private static string FieldValue(string block, string fieldName)
    {
        var m = Regex.Match(block, $@"^{Regex.Escape(fieldName)}:\s*(.+)$", RegexOptions.Multiline);
        return m.Success ? m.Groups[1].Value.Trim() : "";
    }
}
