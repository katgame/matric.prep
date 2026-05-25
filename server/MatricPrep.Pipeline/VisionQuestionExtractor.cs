using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace MatricPrep.Pipeline;

/// <summary>
/// Calls Claude's vision API to extract LaTeX-formatted questions from scanned PDF exam papers.
/// </summary>
public static class VisionQuestionExtractor
{
    private const string AnthropicUrl = "https://api.anthropic.com/v1/messages";
    public const string DefaultModel = "claude-opus-4-7";

    public sealed record ExtractedQuestion(
        int Number,
        string Topic,
        int? TotalMarks,
        string LatexContent);

    public static async Task<IReadOnlyList<ExtractedQuestion>> ExtractAsync(
        string pdfPath,
        string apiKey,
        string model = DefaultModel,
        int timeoutSeconds = 180,
        CancellationToken ct = default)
    {
        if (!File.Exists(pdfPath))
            throw new FileNotFoundException("Paper PDF not found.", pdfPath);

        Console.Write($"  Reading {Path.GetFileName(pdfPath)}... ");
        var pdfBytes = await File.ReadAllBytesAsync(pdfPath, ct);
        Console.WriteLine($"{pdfBytes.Length / 1024} KB");
        var pdfBase64 = Convert.ToBase64String(pdfBytes);

        const string system = """
            You extract NSC (South African) exam questions into LaTeX-formatted markdown.

            LaTeX rules:
            - Inline math: $expression$  — wrap ALL equations and math expressions
            - Superscripts: $x^{2}$, $2^{x+4}$, $T_{n}$
            - Fractions: $\frac{a}{b}$
            - Roots: $\sqrt{x+2}$, $\sqrt[3]{8}$
            - Symbols: $\leq$ $\geq$ $\neq$ $\pm$ $\in$ $\infty$ $\therefore$ $\times$
            - Greek: $\theta$ $\pi$ $\alpha$ $\beta$
            Keep instruction words (Solve, Calculate, Show that, Determine…) as plain text.
            Never write plain-text equations — always use $...$
            """;

        const string user = """
            Extract every QUESTION from this exam paper using this exact format:

            ---QUESTION 1---
            TOPIC: Algebra and Equations
            MARKS: 25

            **1.1** Solve for $x$:

            **1.1.1** $x^2 - 3x - 10 = 0$ (3)

            **1.1.2** $3x^2 + 6x + 1 = 0$ (correct to TWO decimal places) (3)

            **1.2** A rectangle … (6)

            **[25]**
            ---END---

            ---QUESTION 2---
            TOPIC: Number Patterns
            MARKS: 20

            [question content]
            ---END---

            Rules:
            - Bold sub-question refs: **1.1**, **1.1.1**
            - Mark allocation at end of each line: (3)
            - Question total on own line: **[25]**
            - ALL math in $...$
            - TOPIC = short descriptive label (e.g. "Financial Mathematics")
            - MARKS = integer total for that question
            - Do NOT include cover-page instructions, solutions, or marking guidance
            """;

        var requestBody = new
        {
            model,
            max_tokens = 8192,
            system,
            messages = new[]
            {
                new
                {
                    role = "user",
                    content = new object[]
                    {
                        new
                        {
                            type = "document",
                            source = new
                            {
                                type = "base64",
                                media_type = "application/pdf",
                                data = pdfBase64
                            }
                        },
                        new { type = "text", text = user }
                    }
                }
            }
        };

        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(timeoutSeconds) };
        http.DefaultRequestHeaders.Add("x-api-key", apiKey);
        http.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");

        var jsonBody = JsonSerializer.Serialize(requestBody, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        Console.Write("  Calling Claude vision API... ");
        using var response = await http.PostAsync(
            AnthropicUrl,
            new StringContent(jsonBody, Encoding.UTF8, "application/json"),
            ct);
        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Claude API {(int)response.StatusCode}: {body}");

        using var doc = JsonDocument.Parse(body);
        var text = doc.RootElement
            .GetProperty("content")[0]
            .GetProperty("text")
            .GetString() ?? "";

        var questions = ParseBlocks(text);
        Console.WriteLine($"extracted {questions.Count} question(s).");
        return questions;
    }

    private static IReadOnlyList<ExtractedQuestion> ParseBlocks(string text)
    {
        var results = new List<ExtractedQuestion>();
        var blockRx = new Regex(@"---QUESTION\s+(\d+)---([\s\S]+?)---END---", RegexOptions.IgnoreCase);
        var topicRx = new Regex(@"^TOPIC:\s*(.+)$", RegexOptions.Multiline);
        var marksRx = new Regex(@"^MARKS:\s*(\d+)", RegexOptions.Multiline);

        foreach (Match m in blockRx.Matches(text))
        {
            if (!int.TryParse(m.Groups[1].Value, out var num)) continue;
            var content = m.Groups[2].Value;

            var topic = topicRx.Match(content).Groups[1].Value.Trim();
            if (string.IsNullOrWhiteSpace(topic)) topic = "General";

            int? marks = null;
            var mm = marksRx.Match(content);
            if (mm.Success && int.TryParse(mm.Groups[1].Value, out var mv)) marks = mv;

            // Strip metadata lines; keep the question body
            var body = topicRx.Replace(content, "");
            body = marksRx.Replace(body, "");
            body = body.TrimStart('\r', '\n', ' ').Trim();

            results.Add(new ExtractedQuestion(num, topic, marks, body));
        }

        return results;
    }
}
