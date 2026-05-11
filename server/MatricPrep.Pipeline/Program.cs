using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using MatricPrep.Contracts;
using MatricPrep.Ingestion;

namespace MatricPrep.Pipeline;

internal static class Program
{
    public static async Task<int> Main(string[] args)
    {
        if (args.Length == 0 || args[0] is "-h" or "--help" or "help")
        {
            PrintHelp();
            return 0;
        }

        var cmd = args[0].ToLowerInvariant();
        var rest = args.Skip(1).ToArray();
        var opts = ParseArgs(rest);

        try
        {
            return cmd switch
            {
                "extract" => await ExtractCommand(opts),
                "generate" => await GenerateCommand(opts),
                "import" => await ImportCommand(opts),
                "run" => await RunCommand(opts),
                "batch" => await BatchCommand(opts),
                _ => Unknown(cmd)
            };
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.Message);
            if (ex.InnerException != null) Console.Error.WriteLine(ex.InnerException.Message);
            return 1;
        }
    }

    private static int Unknown(string cmd)
    {
        Console.Error.WriteLine($"Unknown command: {cmd}");
        PrintHelp();
        return 1;
    }

    private static void PrintHelp()
    {
        Console.WriteLine(
            """
            MatricPrep.Pipeline — PDF text → LLM → paper.import.json → POST /api/ingestion/papers

            extract
              --exam-root <dir>     Folder containing session subfolders (default: search upward for exam-papers/)
              --session <name>      e.g. 2025-may-june
              --subject <folder>    e.g. accounting  (under non-languages/)
              --paper <n>           Paper number, e.g. 1
              --language English|Afrikaans
              --out <file>          Write extract bundle JSON (default: paper.extract.json)

            extract (explicit PDFs)
              --paper-pdf <path> --memo-pdf <path>
              --session --subject --paper --language (for metadata in bundle)
              --out <file>

            generate
              --extract <file>      Bundle from extract
              --out <file>          paper.import.json (default)
              --deterministic       Skip LLM; use QUESTION-block parser only (same as bulk ingestion server path)
              --provider ollama|openai   default: ollama (or MATRICPREP_LLM). OpenAI needs OPENAI_API_KEY.
              --model <name>        Ollama: OLLAMA_MODEL or llama3.2. OpenAI: OPENAI_MODEL or gpt-4o-mini
              --ollama-url <url>    Ollama base URL, default http://localhost:11434
              --timeout-seconds <n> LLM request timeout, default 600 (increase for slower models)
              --openai-key <key>    optional for provider openai; else OPENAI_API_KEY

            import
              --file <paper.import.json>
              --api <base>          e.g. http://localhost:5179

            batch
              Bulk non-language papers: deterministic extract + import (no LLM) or enqueue server jobs.
              --session <name>      e.g. 2025-may-june
              --exam-root <dir>     Folder containing session subfolders (default: search upward for exam-papers/)
              --subject <folder>    Optional; limit to one subject under non-languages/ (e.g. accounting)
              --mode direct|enqueue direct: parallel POST /api/ingestion/papers (default). enqueue: POST /api/ingestion/jobs/bulk
              --workers <n>         Parallelism for direct mode (default: 4)
              --max <n>             Process at most N pairs (direct mode)
              --api <base>          API base URL (default MATRICPREP_API or http://localhost:5179)

            run
              Same flags as extract + generate + import; adds --api for import step.
              Default LLM is local Ollama (no API key). Install: https://ollama.com — then: ollama pull llama3.2

            Notes:
              - PDF text uses the embedded text layer only. Image-only PDFs need OCR first.
              - LLM generation converts each extracted question into five persisted MCQ options (A–E).
            """);
    }

    private static Dictionary<string, string?> ParseArgs(string[] args)
    {
        var d = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < args.Length; i++)
        {
            if (!args[i].StartsWith("--", StringComparison.Ordinal)) continue;
            var key = args[i][2..];
            if (i + 1 < args.Length && !args[i + 1].StartsWith("--", StringComparison.Ordinal))
                d[key] = args[++i];
            else
                d[key] = "true";
        }
        return d;
    }

    private static async Task<int> ExtractCommand(Dictionary<string, string?> o)
    {
        var outPath = o.GetValueOrDefault("out") ?? "paper.extract.json";
        ExtractBundle bundle;

        if (o.ContainsKey("paper-pdf") && o.ContainsKey("memo-pdf"))
        {
            var paperPdf = o["paper-pdf"]!;
            var memoPdf = o["memo-pdf"]!;
            var session = o.GetValueOrDefault("session") ?? "2025-may-june";
            var subject = o.GetValueOrDefault("subject") ?? "unknown";
            var paperNum = int.Parse(o.GetValueOrDefault("paper") ?? "1");
            var lang = o.GetValueOrDefault("language") ?? "English";
            var paperRel = o.GetValueOrDefault("paper-rel") ?? Path.GetFileName(paperPdf);
            var memoRel = o.GetValueOrDefault("memo-rel") ?? Path.GetFileName(memoPdf);

            bundle = new ExtractBundle
            {
                Session = session,
                SubjectFolder = subject,
                PaperNumber = paperNum,
                Language = lang,
                PaperRelativePath = paperRel.Replace('\\', '/'),
                MemoRelativePath = memoRel.Replace('\\', '/'),
                PaperText = PdfTextExtractor.Extract(paperPdf),
                MemoText = PdfTextExtractor.Extract(memoPdf)
            };
        }
        else
        {
            var examRoot = o.GetValueOrDefault("exam-root") ?? FindExamRoot() ?? Environment.CurrentDirectory;
            var session = o.GetValueOrDefault("session") ?? throw new InvalidOperationException("--session required.");
            var subject = o.GetValueOrDefault("subject") ?? throw new InvalidOperationException("--subject required (e.g. accounting).");
            var paperNum = int.Parse(o.GetValueOrDefault("paper") ?? throw new InvalidOperationException("--paper required."));
            var lang = o.GetValueOrDefault("language") ?? "English";

            var resolved = ManifestPaperResolver.Resolve(examRoot, session, subject, paperNum, lang);
            var paperAbs = Path.Combine(examRoot, session, resolved.PaperRelativePath.Replace('/', Path.DirectorySeparatorChar));
            var memoAbs = Path.Combine(examRoot, session, resolved.MemoRelativePath.Replace('/', Path.DirectorySeparatorChar));

            bundle = new ExtractBundle
            {
                Session = session,
                SubjectFolder = subject,
                PaperNumber = paperNum,
                Language = lang,
                PaperRelativePath = resolved.PaperRelativePath,
                MemoRelativePath = resolved.MemoRelativePath,
                PaperText = PdfTextExtractor.Extract(paperAbs),
                MemoText = PdfTextExtractor.Extract(memoAbs)
            };
        }

        if (string.IsNullOrWhiteSpace(bundle.PaperText))
            Console.WriteLine("Warning: question paper text is empty (image-only PDF?).");
        if (string.IsNullOrWhiteSpace(bundle.MemoText))
            Console.WriteLine("Warning: memorandum text is empty (image-only PDF?).");

        var json = JsonSerializer.Serialize(bundle, new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });
        await File.WriteAllTextAsync(outPath, json, Encoding.UTF8);
        Console.WriteLine($"Wrote extract bundle: {Path.GetFullPath(outPath)}");
        return 0;
    }

    private static string? FindExamRoot()
    {
        var dir = new DirectoryInfo(Environment.CurrentDirectory);
        while (dir != null)
        {
            var ep = Path.Combine(dir.FullName, "exam-papers");
            if (Directory.Exists(ep)) return ep;
            dir = dir.Parent;
        }
        return null;
    }

    /// <summary>Default LLM is local Ollama (free). Use <c>--provider openai</c> or MATRICPREP_LLM=openai for OpenAI.</summary>
    private static LlmGenerateOptions ResolveLlmOptions(Dictionary<string, string?> o)
    {
        var provider = o.GetValueOrDefault("provider")?.Trim().ToLowerInvariant()
            ?? Environment.GetEnvironmentVariable("MATRICPREP_LLM")?.Trim().ToLowerInvariant()
            ?? LlmImportGenerator.ProviderOllama;

        if (provider != LlmImportGenerator.ProviderOllama && provider != LlmImportGenerator.ProviderOpenAi)
            provider = LlmImportGenerator.ProviderOllama;

        string model;
        if (!string.IsNullOrWhiteSpace(o.GetValueOrDefault("model")))
            model = o.GetValueOrDefault("model")!;
        else if (provider == LlmImportGenerator.ProviderOpenAi)
            model = Environment.GetEnvironmentVariable("OPENAI_MODEL") ?? "gpt-4o-mini";
        else
            model = Environment.GetEnvironmentVariable("OLLAMA_MODEL") ?? "llama3.2";

        return new LlmGenerateOptions
        {
            Provider = provider,
            Model = model,
            OpenAiApiKey = o.GetValueOrDefault("openai-key"),
            OllamaBaseUrl = o.GetValueOrDefault("ollama-url"),
            TimeoutSeconds = int.TryParse(o.GetValueOrDefault("timeout-seconds"), out var t) ? Math.Clamp(t, 30, 3600) : 600
        };
    }

    private static async Task<int> GenerateCommand(Dictionary<string, string?> o)
    {
        var extractPath = o.GetValueOrDefault("extract") ?? throw new InvalidOperationException("--extract required.");
        var outPath = o.GetValueOrDefault("out") ?? "paper.import.json";
        var llmOpts = ResolveLlmOptions(o);

        var json = await File.ReadAllTextAsync(extractPath);
        var bundle = JsonSerializer.Deserialize<ExtractBundle>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        }) ?? throw new InvalidOperationException("Invalid extract bundle JSON.");

        PaperImportDto dto;
        if (o.ContainsKey("deterministic") || o.ContainsKey("no-llm"))
        {
            dto = DeterministicPaperImportBuilder.Build(
                bundle.Session,
                bundle.SubjectFolder,
                bundle.PaperNumber,
                bundle.Language,
                bundle.PaperRelativePath,
                bundle.MemoRelativePath,
                bundle.PaperText,
                bundle.MemoText);
        }
        else
        {
            dto = await LlmImportGenerator.GenerateAsync(
            bundle.PaperText,
            bundle.MemoText,
            bundle.Session,
            bundle.SubjectFolder,
            bundle.PaperRelativePath,
            bundle.MemoRelativePath,
            bundle.PaperNumber,
            bundle.Language,
            llmOpts);
        }

        if (dto.Questions.Count == 0)
            Console.WriteLine("Warning: LLM returned zero questions. Edit paper.import.json or improve prompts.");

        var outJson = JsonSerializer.Serialize(dto, new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });
        await File.WriteAllTextAsync(outPath, outJson, Encoding.UTF8);
        Console.WriteLine($"Wrote {outPath} ({dto.Questions.Count} questions).");
        return 0;
    }

    private static async Task<int> ImportCommand(Dictionary<string, string?> o)
    {
        var file = o.GetValueOrDefault("file") ?? throw new InvalidOperationException("--file required.");
        var api = o.GetValueOrDefault("api") ?? Environment.GetEnvironmentVariable("MATRICPREP_API") ?? "http://localhost:5179";
        api = api.TrimEnd('/');

        var json = await File.ReadAllTextAsync(file);
        using var http = new HttpClient { BaseAddress = new Uri(api + "/") };
        var resp = await http.PostAsync("api/ingestion/papers", new StringContent(json, Encoding.UTF8, "application/json"));
        var body = await resp.Content.ReadAsStringAsync();
        if (!resp.IsSuccessStatusCode)
            throw new InvalidOperationException($"Import failed {(int)resp.StatusCode}: {body}");

        Console.WriteLine(body);
        return 0;
    }

    private static async Task<int> RunCommand(Dictionary<string, string?> o)
    {
        var extractOut = o.GetValueOrDefault("extract-out") ?? Path.Combine(Path.GetTempPath(), $"matricprep-{Guid.NewGuid():N}.json");
        var importJson = o.GetValueOrDefault("out") ?? "paper.import.json";
        var api = o.GetValueOrDefault("api") ?? Environment.GetEnvironmentVariable("MATRICPREP_API") ?? "http://localhost:5179";

        var extractOpts = new Dictionary<string, string?>(o, StringComparer.OrdinalIgnoreCase) { ["out"] = extractOut };
        var e = await ExtractCommand(extractOpts);
        if (e != 0) return e;

        var genOpts = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
        {
            ["extract"] = extractOut,
            ["out"] = importJson,
            ["model"] = o.GetValueOrDefault("model"),
            ["openai-key"] = o.GetValueOrDefault("openai-key"),
            ["provider"] = o.GetValueOrDefault("provider"),
            ["ollama-url"] = o.GetValueOrDefault("ollama-url")
        };
        if (o.ContainsKey("deterministic") || o.ContainsKey("no-llm"))
            genOpts["deterministic"] = "true";
        var g = await GenerateCommand(genOpts);
        if (g != 0) return g;

        var impOpts = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
        {
            ["file"] = importJson,
            ["api"] = api
        };
        return await ImportCommand(impOpts);
    }

    private static async Task<int> BatchCommand(Dictionary<string, string?> o)
    {
        var examRoot = o.GetValueOrDefault("exam-root") ?? FindExamRoot() ?? Environment.CurrentDirectory;
        var session = o.GetValueOrDefault("session") ?? throw new InvalidOperationException("--session required.");
        var subject = o.GetValueOrDefault("subject");
        var mode = o.GetValueOrDefault("mode") ?? "direct";
        var workers = int.TryParse(o.GetValueOrDefault("workers"), out var w) ? Math.Clamp(w, 1, 32) : 4;
        var maxPairs = int.TryParse(o.GetValueOrDefault("max"), out var mx) ? mx : (int?)null;
        var api = o.GetValueOrDefault("api") ?? Environment.GetEnvironmentVariable("MATRICPREP_API") ?? "http://localhost:5179";
        api = api.TrimEnd('/');

        if (string.Equals(mode, "enqueue", StringComparison.OrdinalIgnoreCase))
        {
            using var http = new HttpClient { BaseAddress = new Uri(api + "/") };
            var body = new { session, subjectFolder = subject };
            var resp = await http.PostAsJsonAsync("api/ingestion/jobs/bulk", body);
            var text = await resp.Content.ReadAsStringAsync();
            if (!resp.IsSuccessStatusCode)
                throw new InvalidOperationException($"Bulk enqueue failed {(int)resp.StatusCode}: {text}");

            Console.WriteLine(text);
            return 0;
        }

        var pairs = ManifestPaperResolver.ListNonLanguagePairs(examRoot, session, subject);
        var list = maxPairs is { } m ? pairs.Take(m).ToList() : pairs.ToList();
        Console.WriteLine($"Batch direct: {list.Count} paper+memo pair(s), workers={workers}");

        var ok = 0;
        var fail = 0;
        await Parallel.ForEachAsync(
            list,
            new ParallelOptions { MaxDegreeOfParallelism = workers },
            async (pair, ct) =>
            {
                try
                {
                    var paperAbs = Path.Combine(examRoot, session, pair.PaperRelativePath.Replace('/', Path.DirectorySeparatorChar));
                    var memoAbs = Path.Combine(examRoot, session, pair.MemoRelativePath.Replace('/', Path.DirectorySeparatorChar));
                    var paperText = PdfTextExtractor.Extract(paperAbs);
                    var memoText = PdfTextExtractor.Extract(memoAbs);
                    var dto = DeterministicPaperImportBuilder.Build(
                        session,
                        pair.SubjectFolder,
                        pair.PaperNumber,
                        pair.Language,
                        pair.PaperRelativePath,
                        pair.MemoRelativePath,
                        paperText,
                        memoText);

                    using var http = new HttpClient { BaseAddress = new Uri(api + "/") };
                    var resp = await http.PostAsJsonAsync("api/ingestion/papers", dto, cancellationToken: ct);
                    var body = await resp.Content.ReadAsStringAsync(ct);
                    if (!resp.IsSuccessStatusCode)
                        throw new InvalidOperationException(
                            $"{pair.SubjectFolder} P{pair.PaperNumber} ({pair.Language}) {(int)resp.StatusCode}: {body}");

                    Interlocked.Increment(ref ok);
                    Console.WriteLine($"OK {pair.SubjectFolder} Paper {pair.PaperNumber} ({pair.Language})");
                }
                catch (Exception ex)
                {
                    Interlocked.Increment(ref fail);
                    await Console.Error.WriteLineAsync($"FAIL {pair.SubjectFolder} P{pair.PaperNumber}: {ex.Message}");
                }
            });

        Console.WriteLine($"Done. ok={ok} fail={fail}");
        return fail > 0 ? 1 : 0;
    }
}
