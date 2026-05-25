namespace MatricPrep.Api;

/// <summary>Nested under MatricPrep configuration for POST /tutor-chat.</summary>
public sealed class TutorChatOptions
{
    public bool Enabled { get; set; }

    /// <summary><c>ollama</c> or <c>openai</c>.</summary>
    public string Provider { get; set; } = "ollama";

    public string Model { get; set; } = "llama3.2";

    /// <summary>Ollama server root, e.g. http://localhost:11434</summary>
    public string? OllamaBaseUrl { get; set; }

    /// <summary>OpenAI API key; falls back to OPENAI_API_KEY when using openai provider.</summary>
    public string? OpenAiApiKey { get; set; }

    /// <summary>
    /// Base URL for the OpenAI-compatible endpoint. Defaults to https://api.openai.com/v1.
    /// Override to point at a local vLLM server: http://localhost:8000/v1
    /// </summary>
    public string? OpenAiBaseUrl { get; set; }

    /// <summary>HTTP timeout for the LLM request (Ollama/OpenAI). Local models with long prompts often need several minutes.</summary>
    public int RequestTimeoutSeconds { get; set; } = 600;
}
