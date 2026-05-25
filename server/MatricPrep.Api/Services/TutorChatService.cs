using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using MatricPrep.Api.Data;
using Microsoft.Extensions.Options;

namespace MatricPrep.Api.Services;

public sealed class TutorChatService
{
    public const string ProviderOllama = "ollama";
    public const string ProviderOpenAi = "openai";

    private readonly IOptions<MatricPrepOptions> _options;

    public TutorChatService(IOptions<MatricPrepOptions> options)
    {
        _options = options;
    }

    public bool IsConfigured()
    {
        var tc = _options.Value.TutorChat;
        if (!tc.Enabled) return false;
        var provider = (tc.Provider ?? ProviderOllama).Trim().ToLowerInvariant();
        if (provider == ProviderOpenAi)
        {
            var key = tc.OpenAiApiKey?.Trim()
                ?? Environment.GetEnvironmentVariable("OPENAI_API_KEY");
            return !string.IsNullOrWhiteSpace(key);
        }

        return true;
    }

    public async Task<string> CompleteAsync(
        Question question,
        Paper paper,
        IReadOnlyList<TutorChatMessage> messages,
        CancellationToken ct = default)
    {
        var system = BuildChatSystemPrompt(question, paper);
        var chatMessages = new List<TutorChatMessage> { new() { Role = "system", Content = system } };
        foreach (var m in messages)
        {
            var role = m.Role.Trim().ToLowerInvariant();
            if (role is not ("user" or "assistant")) continue;
            chatMessages.Add(new TutorChatMessage { Role = role, Content = m.Content });
        }
        return await CallProviderAsync(chatMessages, ct);
    }

    public async Task<string> BuildBreakdownAsync(
        Question question,
        Paper paper,
        string? studentAnswer,
        CancellationToken ct = default)
    {
        var systemPrompt = BuildBreakdownSystemPrompt(question, paper);
        var userPrompt = BuildBreakdownUserPrompt(question, paper, studentAnswer);

        var messages = new List<TutorChatMessage>
        {
            new() { Role = "system", Content = systemPrompt },
            new() { Role = "user", Content = userPrompt }
        };

        return await CallProviderAsync(messages, ct);
    }

    public async Task<string> GenerateStructuredAsync(
        string feature,
        string grounding,
        string outputContract,
        CancellationToken ct = default)
    {
        var chatMessages = new List<TutorChatMessage>
        {
            new()
            {
                Role = "system",
                Content = $"""
                    You are MatricPrep's AI exam-prep generator for South African NSC learners.
                    Generate {feature} content only from the provided paper/question/topic inventory.
                    Return valid JSON only. Do not include Markdown fences or commentary.

                    Output contract:
                    {outputContract}
                    """
            },
            new() { Role = "user", Content = grounding }
        };

        return await CallProviderAsync(chatMessages, ct, temperature: 0.25);
    }

    // ── Provider dispatch ────────────────────────────────────────────────────

    private async Task<string> CallProviderAsync(
        List<TutorChatMessage> messages,
        CancellationToken ct,
        double temperature = 0.4)
    {
        var tc = _options.Value.TutorChat;
        var provider = (tc.Provider ?? ProviderOllama).Trim().ToLowerInvariant();
        if (provider is not (ProviderOllama or ProviderOpenAi))
            throw new InvalidOperationException($"Unknown TutorChat provider '{tc.Provider}'.");

        var timeoutSec = tc.RequestTimeoutSeconds > 0 ? tc.RequestTimeoutSeconds : 600;
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(timeoutSec) };

        if (provider == ProviderOllama)
        {
            var baseUrl = NormalizeOllamaBase(tc.OllamaBaseUrl ?? Environment.GetEnvironmentVariable("OLLAMA_BASE_URL"));
            http.BaseAddress = baseUrl;
            var body = new
            {
                model = tc.Model,
                stream = false,
                messages = ToChatPayload(messages),
                options = new { temperature }
            };
            using var response = await http.PostAsJsonAsync("api/chat", body, ct);
            var responseBody = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode)
                throw new InvalidOperationException($"Ollama error {(int)response.StatusCode}: {responseBody}");
            var parsed = JsonSerializer.Deserialize<OllamaChatResponse>(responseBody, JsonOpts());
            var text = parsed?.Message?.Content?.Trim() ?? "";
            if (string.IsNullOrEmpty(text))
                throw new InvalidOperationException("Ollama returned no message content.");
            return text;
        }

        var openAiKey = tc.OpenAiApiKey?.Trim()
            ?? Environment.GetEnvironmentVariable("OPENAI_API_KEY");
        if (string.IsNullOrWhiteSpace(openAiKey))
            throw new InvalidOperationException("OpenAI API key is not configured.");

        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", openAiKey);
        var openAiBase = tc.OpenAiBaseUrl?.Trim()
            ?? Environment.GetEnvironmentVariable("OPENAI_BASE_URL")
            ?? "https://api.openai.com/v1";
        if (!openAiBase.EndsWith('/')) openAiBase += "/";
        http.BaseAddress = new Uri(openAiBase);
        var model = string.IsNullOrWhiteSpace(tc.Model) ? "gpt-4o-mini" : tc.Model;
        var openBody = new
        {
            model,
            input = ToOpenAiInput(messages),
            temperature,
        };
        using var openResponse = await http.PostAsJsonAsync("responses", openBody, ct);
        var openBodyText = await openResponse.Content.ReadAsStringAsync(ct);
        if (!openResponse.IsSuccessStatusCode)
            throw new InvalidOperationException($"OpenAI error {(int)openResponse.StatusCode}: {openBodyText}");
        var openParsed = JsonSerializer.Deserialize<OpenAiResponsesResponse>(openBodyText, JsonOpts());
        var reply = ExtractOpenAiText(openParsed).Trim();
        if (string.IsNullOrEmpty(reply))
            throw new InvalidOperationException(BuildOpenAiEmptyMessage(openParsed));
        return reply;
    }

    // ── Prompt builders ──────────────────────────────────────────────────────

    private static string InferSubjectLabel(string? subjectId) => (subjectId ?? "").Trim().ToLowerInvariant() switch
    {
        "maths" => "Mathematics",
        "physical-science" => "Physical Sciences",
        "life-sciences" => "Life Sciences",
        "accounting" => "Accounting",
        _ => "NSC"
    };

    private static string BuildChatSystemPrompt(Question question, Paper paper)
    {
        var subject = InferSubjectLabel(paper.SubjectId);
        return $"""
            You are Kago, a warm, patient and encouraging NSC {subject} tutor for South African Grade 12 learners.

            Your teaching philosophy (follow strictly):
            - NEVER give the final answer immediately. Guide students to discover it through questions and progressive hints.
            - When asked "what's the answer?", first ask: "What have you tried so far?" — then give a concept hint, then a method hint, then reveal the full solution only if needed.
            - Celebrate correct reasoning before correcting errors: "You've identified the right formula — now let's apply it!"
            - Use encouraging language: "You're on the right track!", "That's a common slip-up — here's the trick...", "Great question!"
            - Keep responses concise (3–5 sentences per turn) unless the student asks for more.
            - Use **bold** for key terms, formulae, and mark-bearing steps.
            - For maths and science: show step-by-step working; never skip steps.
            - Use South African context (Rands, local examples) where relevant.
            - If asked something off-topic: "Let's nail this question first — happy to discuss more after!"

            Rules:
            - Ground ALL explanations in the official memorandum below. Never contradict it.
            - Use LaTeX notation for maths: $inline$ for inline expressions, $$display$$ for equations on their own line. NEVER use \[...\] or \(...\) delimiters — use $...$ and $$...$$ only.
            - Normalise errors — struggle is how the brain grows. Never make the student feel bad.

            --- Paper ---
            {paper.Title} · {paper.PaperLabel}
            Subject: {subject}

            --- Question ---
            Topic: {question.Topic}
            Type: {question.QuestionType}
            Marks: {question.Marks?.ToString() ?? "n/a"}

            --- Question text ---
            {Clip(question.Prompt, 24_000)}

            --- Official marking guidance ---
            {Clip(question.MarkingNotes, 12_000)}

            --- Memorandum answer ---
            {Clip(question.MemoAnswer, 24_000)}

            --- Explanation (question bank) ---
            {Clip(question.Explanation, 12_000)}
            """;
    }

    private static string BuildBreakdownSystemPrompt(Question question, Paper paper)
    {
        var subject = InferSubjectLabel(paper.SubjectId);
        return $"""
            You are Kago, an expert NSC {subject} tutor for South African Grade 12 learners.
            You create structured, encouraging 5-stage learning walkthroughs grounded in the official memorandum.

            Writing rules:
            - Use **bold** for key terms, formulae, and mark-bearing steps.
            - Use LaTeX notation for maths: $inline$ and $$display$$. NEVER use \[...\] or \(...\) — only $...$ and $$...$$.
            - Keep each stage concise but complete — students read one stage at a time.
            - Use a warm, direct tone. Normalise struggle. Celebrate understanding.
            - Never contradict the official memorandum. Never invent mark allocations.
            - Write for a Grade 12 student — clear and accessible, not patronising.
            """;
    }

    private static string BuildBreakdownUserPrompt(Question question, Paper paper, string? studentAnswer)
    {
        var subject = InferSubjectLabel(paper.SubjectId);
        var hasAttempt = !string.IsNullOrWhiteSpace(studentAnswer?.Trim());
        var attempt = studentAnswer?.Trim();

        var feedbackInstruction = hasAttempt
            ? $"""
               The student wrote this attempt:
               "{Clip(attempt, 600)}"

               In 2–3 warm, specific sentences: first acknowledge what they got right (even identifying the topic counts!). Then pinpoint the key gap in their thinking. Finally, tell them what this walkthrough will clarify. Start with something genuinely positive. Be specific — reference their actual attempt.
               """
            : """Write exactly: "Let's work through this step by step. I'll guide you from understanding exactly what's being asked all the way to the final answer — you'll have it mastered by the end." """;

        return $"""
            Create a 5-stage guided learning walkthrough for this NSC exam question.
            Write in clear, accessible English for a Grade 12 learner.
            Return EXACTLY these six sections — the app reveals them one stage at a time:

            PERSONALIZED_FEEDBACK:
            {feedbackInstruction}

            FRAME:
            In 2–3 sentences: translate the question from exam language into plain English. What type of question is this? What exactly must the student produce or calculate? What are the key constraints or given values worth noticing?

            RECALL:
            A bullet list of the 2–4 most essential concepts, formulae, definitions, or facts needed to solve this question. Include formulae in LaTeX. Keep it short — only what's needed right now.

            PLAN:
            The approach in 3–5 numbered steps (the plan only, no calculations yet). After the steps, add one sentence explaining WHY this method works for this type of question.

            SOLVE:
            The full solution worked step by step. Number every step. Show ALL working — never skip steps. Reference specific values from the question. Use LaTeX for all mathematical expressions. End with the final answer in **bold**.

            REVIEW:
            State the final answer in one clear sentence. Then list 1–2 common mistakes students make on this question type. End with one examiner tip — what the marker specifically checks for when awarding marks.

            ---
            Paper: {paper.Title} ({paper.PaperLabel})
            Subject: {subject}
            Topic: {question.Topic}
            Type: {question.QuestionType}
            Marks: {question.Marks?.ToString() ?? "n/a"}

            Question text:
            {Clip(question.Prompt, 24_000)}

            Official memorandum:
            {Clip(question.MemoAnswer, 16_000)}

            Marking notes:
            {Clip(question.MarkingNotes, 8_000)}
            """;
    }

    // ── Serialisation helpers ────────────────────────────────────────────────

    private static JsonSerializerOptions JsonOpts() =>
        new() { PropertyNameCaseInsensitive = true };

    private static object[] ToChatPayload(IEnumerable<TutorChatMessage> messages) =>
        messages.Select(m => new { role = m.Role.Trim().ToLowerInvariant(), content = m.Content }).ToArray();

    private static object[] ToOpenAiInput(IEnumerable<TutorChatMessage> messages) =>
        messages.Select(m => new
        {
            role = m.Role.Trim().ToLowerInvariant(),
            content = new object[] { new { type = "input_text", text = m.Content } }
        }).ToArray();

    private static string ExtractOpenAiText(OpenAiResponsesResponse? response)
    {
        var outputText = response?.OutputText?.Trim();
        if (!string.IsNullOrWhiteSpace(outputText)) return outputText;

        var parts = response?.Output?
            .SelectMany(item => item.Content ?? [])
            .Select(part => part.Text)
            .Where(text => !string.IsNullOrWhiteSpace(text))
            .Select(text => text!.Trim())
            .ToArray() ?? [];

        return parts.Length == 0 ? "" : string.Join("\n\n", parts);
    }

    private static string BuildOpenAiEmptyMessage(OpenAiResponsesResponse? response)
    {
        if (response is null) return "OpenAI returned no parseable response payload.";

        var details = new List<string>();
        if (!string.IsNullOrWhiteSpace(response.Status)) details.Add($"status={response.Status}");
        if (!string.IsNullOrWhiteSpace(response.Error?.Message)) details.Add($"error={response.Error.Message}");
        if (!string.IsNullOrWhiteSpace(response.IncompleteDetails?.Reason)) details.Add($"incomplete={response.IncompleteDetails.Reason}");

        var refusals = response.Output?
            .SelectMany(item => item.Content ?? [])
            .Select(part => part.Refusal)
            .Where(refusal => !string.IsNullOrWhiteSpace(refusal))
            .Select(refusal => refusal!.Trim())
            .ToArray() ?? [];
        if (refusals.Length > 0) details.Add($"refusal={string.Join(" | ", refusals)}");

        return details.Count == 0
            ? "OpenAI returned no message content."
            : $"OpenAI returned no message content ({string.Join("; ", details)}).";
    }

    private static Uri NormalizeOllamaBase(string? raw)
    {
        var s = string.IsNullOrWhiteSpace(raw) ? "http://localhost:11434" : raw.Trim();
        if (!s.EndsWith('/')) s += "/";
        return new Uri(s);
    }

    private static string Clip(string? s, int max)
    {
        if (string.IsNullOrEmpty(s)) return "";
        s = s.Trim();
        return s.Length <= max ? s : s[..max] + "…";
    }

    // ── Response types ───────────────────────────────────────────────────────

    private sealed class OllamaChatResponse
    {
        [JsonPropertyName("message")]
        public OllamaMsg? Message { get; set; }

        public sealed class OllamaMsg
        {
            [JsonPropertyName("content")]
            public string? Content { get; set; }
        }
    }

    private sealed class OpenAiResponsesResponse
    {
        [JsonPropertyName("output_text")]
        public string? OutputText { get; set; }

        [JsonPropertyName("status")]
        public string? Status { get; set; }

        [JsonPropertyName("error")]
        public OpenAiResponseError? Error { get; set; }

        [JsonPropertyName("incomplete_details")]
        public OpenAiIncompleteDetails? IncompleteDetails { get; set; }

        [JsonPropertyName("output")]
        public List<OpenAiOutputItem>? Output { get; set; }
    }

    private sealed class OpenAiOutputItem
    {
        [JsonPropertyName("content")]
        public List<OpenAiOutputContent>? Content { get; set; }
    }

    private sealed class OpenAiOutputContent
    {
        [JsonPropertyName("text")]
        public string? Text { get; set; }

        [JsonPropertyName("refusal")]
        public string? Refusal { get; set; }
    }

    private sealed class OpenAiResponseError
    {
        [JsonPropertyName("message")]
        public string? Message { get; set; }
    }

    private sealed class OpenAiIncompleteDetails
    {
        [JsonPropertyName("reason")]
        public string? Reason { get; set; }
    }
}

public sealed class TutorChatMessage
{
    public string Role { get; set; } = "";
    public string Content { get; set; } = "";
}
