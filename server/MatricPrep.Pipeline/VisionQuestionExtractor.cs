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

            Figures and diagrams — CRITICAL:
            Whenever a question contains a graph, diagram, or figure, you MUST represent it using one of the two block formats below. Place the block immediately after the question's introductory text and before the numbered sub-questions.

            [GRAPH] — for questions whose diagram is a Cartesian graph of mathematical functions:
            [GRAPH]
            fn: <JavaScript expression, e.g.  4/(x-3) + 4>
            fn: <second function if present, e.g.  x + 1>
            xRange: <min> to <max>
            yRange: <min> to <max>
            points: <Label(x,y) pairs, e.g.  M(3,4), C(5,0), D(0,1.67)>
            vAsymptote: <x-value(s) of vertical asymptote(s), e.g.  3>
            hAsymptote: <y-value(s) of horizontal asymptote(s), e.g.  4>
            [/GRAPH]

            Expression rules for fn:
            - Use / for division:  4/(x-3)+4
            - Use ** for powers:  x**2  (not x^2)
            - Use Math.sqrt(x), Math.sin(x), Math.cos(x), Math.tan(x), Math.log(x) for special functions
            - Do NOT prefix with "f(x) =" — just the expression

            [FIGURE] — for all other diagrams (geometry, statistics, data charts, number lines, etc.):
            [FIGURE]
            <One or two sentences describing exactly what is shown: key measurements, labeled points, angles, features a student needs to answer the sub-questions.>
            [/FIGURE]

            If there is NO figure, do not include either block.
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

            ---QUESTION 4---
            TOPIC: Functions (Hyperbola)
            MARKS: 15

            The graph of $f(x) = \frac{4}{x-3} + 4$ is drawn below. M is the point where the asymptotes of $f$ intersect. C and D are the $x$- and $y$-intercepts respectively of $f$. A is the point on $f$ that is closest to M.

            [GRAPH]
            fn: 4/(x-3) + 4
            xRange: -5 to 10
            yRange: -10 to 12
            points: M(3,4), C(5,0), D(0,1.67)
            vAsymptote: 3
            hAsymptote: 4
            [/GRAPH]

            **4.1** Write down the coordinates of M. (2)

            **4.2** Calculate the coordinates of D. (2)

            **[15]**
            ---END---

            ---QUESTION 5---
            TOPIC: Euclidean Geometry
            MARKS: 12

            In the diagram, triangle ABC has vertices A(0, 5), B(−3, 0) and C(4, 0). D is the midpoint of AB.

            [FIGURE]
            Triangle ABC with A at (0,5), B at (−3,0) and C at (4,0). D is the midpoint of AB. A line segment DE is drawn parallel to BC. The diagram shows the triangle with all three vertices labeled and the midpoint D marked on side AB.
            [/FIGURE]

            **5.1** Determine the length of BC. (2)

            **[12]**
            ---END---

            Rules:
            - Bold sub-question refs: **1.1**, **1.1.1**
            - Mark allocation at end of each line: (3)
            - Question total on own line: **[25]**
            - ALL math in $...$
            - TOPIC = short descriptive label (e.g. "Financial Mathematics")
            - MARKS = integer total for that question
            - Do NOT include cover-page instructions, solutions, or marking guidance
            - Include [GRAPH] or [FIGURE] blocks for every question that has a diagram
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
