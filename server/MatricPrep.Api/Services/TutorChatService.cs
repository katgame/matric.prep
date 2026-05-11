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
        var tc = _options.Value.TutorChat;
        var provider = (tc.Provider ?? ProviderOllama).Trim().ToLowerInvariant();
        if (provider is not (ProviderOllama or ProviderOpenAi))
            throw new InvalidOperationException($"Unknown TutorChat provider '{tc.Provider}'.");

        var system = BuildSystemPrompt(question, paper);
        var chatMessages = new List<TutorChatMessage> { new() { Role = "system", Content = system } };
        foreach (var m in messages)
        {
            var role = m.Role.Trim().ToLowerInvariant();
            if (role is not ("user" or "assistant")) continue;
            chatMessages.Add(new TutorChatMessage { Role = role, Content = m.Content });
        }

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
                messages = ToChatPayload(chatMessages),
                options = new { temperature = 0.4 }
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
        http.BaseAddress = new Uri("https://api.openai.com/v1/");
        var openBody = new
        {
            model = string.IsNullOrWhiteSpace(tc.Model) ? "gpt-4o-mini" : tc.Model,
            input = ToOpenAiInput(chatMessages),
            temperature = 0.4,
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

    public async Task<string> BuildBreakdownAsync(
        Question question,
        Paper paper,
        string? studentAnswer,
        CancellationToken ct = default)
    {
        var answer = studentAnswer?.Trim();
        var userPrompt = $"""
            Break down this exact exam question for me and include a full worked solution.
            Return exactly these four headings so the app can display the answer:
            Context:
            Method:
            Worked Solution:
            Final Answer:

            Paper: {paper.Title} ({paper.PaperLabel})
            Topic: {question.Topic}
            Marks: {question.Marks?.ToString() ?? "n/a"}

            Question:
            {Clip(question.Prompt, 24_000)}

            Official memo / marking guidance:
            {Clip(question.MemoAnswer, 16_000)}

            Marking notes:
            {Clip(question.MarkingNotes, 8_000)}

            My current answer attempt:
            {(string.IsNullOrWhiteSpace(answer) ? "No attempt yet." : answer)}
            """;

        var messages = new List<TutorChatMessage>
        {
            new() { Role = "user", Content = userPrompt }
        };

        return await CompleteAsync(question, paper, messages, ct);
    }

    public async Task<string> GenerateStructuredAsync(
        string feature,
        string grounding,
        string outputContract,
        CancellationToken ct = default)
    {
        var tc = _options.Value.TutorChat;
        var provider = (tc.Provider ?? ProviderOllama).Trim().ToLowerInvariant();
        if (provider is not (ProviderOllama or ProviderOpenAi))
            throw new InvalidOperationException($"Unknown TutorChat provider '{tc.Provider}'.");

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
                messages = ToChatPayload(chatMessages),
                options = new { temperature = 0.25 }
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
        http.BaseAddress = new Uri("https://api.openai.com/v1/");
        var openBody = new
        {
            model = string.IsNullOrWhiteSpace(tc.Model) ? "gpt-4o-mini" : tc.Model,
            input = ToOpenAiInput(chatMessages),
            temperature = 0.25,
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

    private static string BuildSystemPrompt(Question question, Paper paper)
    {
        return $"""
            You are a patient NSC (South Africa) accounting tutor. Help the student understand this exam question and how to reach the solution described in the official memorandum material below.

            Rules:
            - Ground your explanations in the memorandum and marking notes below. Do not invent mark allocations or official answers that contradict them.
            - Use clear steps suitable for a Grade 12 learner. Reference the problem statement when helpful.
            - If asked something unrelated to this question, briefly redirect to this question.
            - Do not reproduce long copyrighted exam text verbatim; paraphrase when explaining.

            --- Paper ---
            Title: {paper.Title}
            Paper: {paper.PaperLabel}

            --- Question ---
            Topic: {question.Topic}
            Type: {question.QuestionType}
            Marks (if set): {question.Marks?.ToString() ?? "n/a"}

            --- Question text (prompt) ---
            {Clip(question.Prompt, 24_000)}

            --- Marking notes ---
            {Clip(question.MarkingNotes, 12_000)}

            --- Memorandum answer (may be structured) ---
            {Clip(question.MemoAnswer, 24_000)}

            --- Explanation / approach (from question bank) ---
            {Clip(question.Explanation, 12_000)}
            """;
    }

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
