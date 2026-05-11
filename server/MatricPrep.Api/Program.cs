using MatricPrep.Api;
using MatricPrep.Api.Data;
using MatricPrep.Api.Dtos;
using MatricPrep.Api.Services;
using MatricPrep.Contracts;
using MatricPrep.Ingestion;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Text.Json;
using static UglyToad.PdfPig.DocumentLayoutAnalysis.TextExtractor.ContentOrderTextExtractor;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddCors();
builder.Services.Configure<MatricPrepOptions>(builder.Configuration.GetSection(MatricPrepOptions.SectionName));
builder.Services.AddSingleton<TutorChatService>();
builder.Services.AddHostedService<IngestionJobWorker>();
builder.Services.AddDbContext<MatricPrepDbContext>(options =>
{
    options.UseNpgsql(builder.Configuration.GetConnectionString("MatricPrep"));
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors(policy =>
    policy
        .AllowAnyHeader()
        .AllowAnyMethod()
        .WithOrigins(
            "http://localhost:3000",
            "http://127.0.0.1:3000"
        ));

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

if (app.Environment.IsDevelopment())
{

    var hasOpenAiKey = !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("OPENAI_API_KEY"));

    Console.WriteLine($"OPENAI_API_KEY: {Environment.GetEnvironmentVariable("OPENAI_API_KEY")}");

    Console.WriteLine($"OPENAI_API_KEY: {Environment.GetEnvironmentVariable("OPENAI_API_KEY")}");
    // Debug-only endpoint: shows effective TutorChat config without leaking secrets.
    app.MapGet("/debug/tutor-chat", (IOptions<MatricPrepOptions> options, TutorChatService tutorChat) =>
    {
        var tc = options.Value.TutorChat;
        var provider = (tc.Provider ?? TutorChatService.ProviderOpenAi).Trim().ToLowerInvariant();
        var hasOpenAiKey = !string.IsNullOrWhiteSpace(tc.OpenAiApiKey?.Trim())
            || !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("OPENAI_API_KEY"));

        Console.WriteLine($"OPENAI_API_KEY: {Environment.GetEnvironmentVariable("OPENAI_API_KEY")}");

        return Results.Ok(new
        {
            tc.Enabled,
            Provider = provider,
            tc.Model,
            tc.RequestTimeoutSeconds,
            HasOpenAiKey = hasOpenAiKey,
            IsConfigured = tutorChat.IsConfigured(),
            Environment = app.Environment.EnvironmentName
        });
    });
}

app.MapGet("/api/subjects", async (MatricPrepDbContext db) =>
{
    var subjects = await db.Subjects
        .OrderBy(s => s.SortOrder)
        .Select(s => new SubjectDto(s.Id, s.Label, s.Description))
        .ToListAsync();
    return Results.Ok(subjects);
});

app.MapGet("/api/papers", async (MatricPrepDbContext db) =>
{
    var papers = await db.Papers
        .OrderByDescending(p => p.Year)
        .Select(p => new PaperListDto(
            p.Id,
            p.SubjectId,
            p.SubjectLabel,
            p.Year,
            p.Title,
            p.PaperLabel,
            p.DurationMinutes,
            p.QuestionCount,
            p.SourcePaperPdfRelativePath,
            p.SourceMemoPdfRelativePath))
        .ToListAsync();
    return Results.Ok(papers);
});

/// <summary>Student-safe: questions do not include correct answers or memorandum text.</summary>
app.MapGet("/api/papers/{paperId}/take", async (string paperId, MatricPrepDbContext db) =>
{
    var paper = await db.Papers.FirstOrDefaultAsync(p => p.Id == paperId);
    if (paper is null) return Results.NotFound();

    var questions = await db.Questions
        .Where(q => q.PaperId == paperId)
        .OrderBy(q => q.SortOrder)
        .ToListAsync();

    return Results.Ok(new PaperTakeDetailDto(
        paper.Id,
        paper.SubjectId,
        paper.SubjectLabel,
        paper.Year,
        paper.Title,
        paper.PaperLabel,
        paper.DurationMinutes,
        paper.QuestionCount,
        paper.Topics,
        paper.SourcePaperPdfRelativePath,
        paper.SourceMemoPdfRelativePath,
        questions.Select(q => new QuestionTakeDto(
            q.Id,
            q.QuestionType,
            q.Topic,
            q.Difficulty,
            q.Prompt,
            JsonSerializer.Deserialize<object>(q.OptionsJson) ?? Array.Empty<object>(),
            q.Marks
        )).ToList()
    ));
});

app.MapGet("/api/papers/{paperId}/tutor", async (
    string paperId,
    MatricPrepDbContext db,
    IOptions<MatricPrepOptions> options,
    TutorChatService tutorChat) =>
{
    var paper = await db.Papers.FirstOrDefaultAsync(p => p.Id == paperId);
    if (paper is null) return Results.NotFound();

    var questions = await db.Questions
        .Where(q => q.PaperId == paperId)
        .OrderBy(q => q.SortOrder)
        .ToListAsync();

    var examRoot = options.Value.ResolvedExamPapersRoot();

    string? sourcePdfUrl = null;
    if (ExamPaperPathResolver.TryResolve(examRoot, paper.SourcePaperPdfRelativePath, out _))
        sourcePdfUrl = $"/api/papers/{Uri.EscapeDataString(paper.Id)}/source-paper";

    string? sourceMemoPdfUrl = null;
    if (ExamPaperPathResolver.TryResolve(examRoot, paper.SourceMemoPdfRelativePath, out _))
        sourceMemoPdfUrl = $"/api/papers/{Uri.EscapeDataString(paper.Id)}/source-memo";

    var tutorChatEnabled = tutorChat.IsConfigured();

    return Results.Ok(new PaperTutorDetailDto(
        paper.Id,
        paper.SubjectId,
        paper.SubjectLabel,
        paper.Year,
        paper.Title,
        paper.PaperLabel,
        paper.DurationMinutes,
        paper.QuestionCount,
        paper.Topics,
        paper.SourcePaperPdfRelativePath,
        paper.SourceMemoPdfRelativePath,
        sourcePdfUrl,
        sourceMemoPdfUrl,
        tutorChatEnabled,
        questions.Select(q => new QuestionTutorDto(
            q.Id,
            q.SortOrder,
            q.QuestionType,
            q.Topic,
            q.Difficulty,
            q.Prompt,
            JsonSerializer.Deserialize<object>(q.OptionsJson) ?? Array.Empty<object>(),
            q.Marks,
            q.MemoAnswer,
            q.MarkingNotes,
            q.Explanation,
            q.CorrectOptionId
        )).ToList()
    ));
});

app.MapGet("/api/papers/{paperId}/source-paper", async (
    string paperId,
    MatricPrepDbContext db,
    IOptions<MatricPrepOptions> options) =>
{
    var paper = await db.Papers.FirstOrDefaultAsync(p => p.Id == paperId);
    if (paper is null || string.IsNullOrWhiteSpace(paper.SourcePaperPdfRelativePath))
        return Results.NotFound();

    var examRoot = options.Value.ResolvedExamPapersRoot();
    if (string.IsNullOrWhiteSpace(examRoot) || !Directory.Exists(examRoot))
    {
        return Results.BadRequest(new
        {
            message = "ExamPapersRoot not set or invalid. Configure MatricPrep:ExamPapersRoot or MATRICPREP_EXAM_PAPERS_ROOT."
        });
    }

    if (!ExamPaperPathResolver.TryResolve(examRoot, paper.SourcePaperPdfRelativePath, out var absolute))
        return Results.NotFound();

    return Results.File(absolute, "application/pdf");
});

app.MapGet("/api/papers/{paperId}/source-memo", async (
    string paperId,
    MatricPrepDbContext db,
    IOptions<MatricPrepOptions> options) =>
{
    var paper = await db.Papers.FirstOrDefaultAsync(p => p.Id == paperId);
    if (paper is null || string.IsNullOrWhiteSpace(paper.SourceMemoPdfRelativePath))
        return Results.NotFound();

    var examRoot = options.Value.ResolvedExamPapersRoot();
    if (string.IsNullOrWhiteSpace(examRoot) || !Directory.Exists(examRoot))
    {
        return Results.BadRequest(new
        {
            message = "ExamPapersRoot not set or invalid. Configure MatricPrep:ExamPapersRoot or MATRICPREP_EXAM_PAPERS_ROOT."
        });
    }

    if (!ExamPaperPathResolver.TryResolve(examRoot, paper.SourceMemoPdfRelativePath, out var absolute))
        return Results.NotFound();

    return Results.File(absolute, "application/pdf");
});

app.MapPost("/api/papers/{paperId}/questions/{questionId}/tutor-chat", async (
    string paperId,
    string questionId,
    TutorChatRequest? req,
    MatricPrepDbContext db,
    TutorChatService tutorChat,
    IOptions<MatricPrepOptions> options,
    CancellationToken ct) =>
{
    if (req?.Messages is null || req.Messages.Count == 0)
        return Results.BadRequest(new { message = "Messages are required." });

    if (!options.Value.TutorChat.Enabled || !tutorChat.IsConfigured())
    {
        return Results.Json(new { message = "Tutor chat is disabled on this server." }, statusCode: 503);
    }

    var hasUser = req.Messages.Any(m =>
        m.Role.Equals("user", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(m.Content));
    if (!hasUser)
        return Results.BadRequest(new { message = "Include at least one user message with content." });

    var paper = await db.Papers.FirstOrDefaultAsync(p => p.Id == paperId, ct);
    if (paper is null) return Results.NotFound();

    var question = await db.Questions.FirstOrDefaultAsync(
        q => q.Id == questionId && q.PaperId == paperId, ct);
    if (question is null) return Results.NotFound();

    var history = req.Messages
        .Where(m => !string.IsNullOrWhiteSpace(m.Role))
        .Select(m => new TutorChatMessage { Role = m.Role.Trim(), Content = m.Content ?? "" })
        .ToList();

    try
    {
        var reply = await tutorChat.CompleteAsync(question, paper, history, ct);
        return Results.Ok(new TutorChatResponse(reply));
    }
    catch (Exception ex)
    {
        return Results.Json(new { message = ex.Message }, statusCode: 502);
    }
});

app.MapPost("/api/papers/{paperId}/questions/{questionId}/breakdown", async (
    string paperId,
    string questionId,
    BreakdownRequest? req,
    MatricPrepDbContext db,
    TutorChatService tutorChat,
    IOptions<MatricPrepOptions> options,
    CancellationToken ct) =>
{
    if (!options.Value.TutorChat.Enabled || !tutorChat.IsConfigured())
    {
        return Results.Json(new { message = "Tutor chat is disabled on this server." }, statusCode: 503);
    }

    var paper = await db.Papers.FirstOrDefaultAsync(p => p.Id == paperId, ct);
    if (paper is null) return Results.NotFound();

    var question = await db.Questions.FirstOrDefaultAsync(
        q => q.Id == questionId && q.PaperId == paperId, ct);
    if (question is null) return Results.NotFound();

    try
    {
        var raw = await tutorChat.BuildBreakdownAsync(question, paper, req?.StudentAnswer, ct);
        var sections = ParseBreakdownSections(raw);
        return Results.Ok(new BreakdownResponse(
            sections.Context,
            sections.Method,
            sections.WorkedSolution,
            sections.FinalAnswer,
            raw));
    }
    catch (Exception ex)
    {
        return Results.Json(new { message = ex.Message }, statusCode: 502);
    }
});

/// <summary>Legacy alias — same as /take (no answers exposed).</summary>
app.MapGet("/api/papers/{paperId}", async (string paperId, MatricPrepDbContext db) =>
{
    var paper = await db.Papers.FirstOrDefaultAsync(p => p.Id == paperId);
    if (paper is null) return Results.NotFound();

    var questions = await db.Questions
        .Where(q => q.PaperId == paperId)
        .OrderBy(q => q.SortOrder)
        .ToListAsync();

    return Results.Ok(new PaperTakeDetailDto(
        paper.Id,
        paper.SubjectId,
        paper.SubjectLabel,
        paper.Year,
        paper.Title,
        paper.PaperLabel,
        paper.DurationMinutes,
        paper.QuestionCount,
        paper.Topics,
        paper.SourcePaperPdfRelativePath,
        paper.SourceMemoPdfRelativePath,
        questions.Select(q => new QuestionTakeDto(
            q.Id,
            q.QuestionType,
            q.Topic,
            q.Difficulty,
            q.Prompt,
            JsonSerializer.Deserialize<object>(q.OptionsJson) ?? Array.Empty<object>(),
            q.Marks
        )).ToList()
    ));
});

app.MapPost("/api/ingestion/papers", async (PaperImportDto dto, MatricPrepDbContext db) =>
{
    try
    {
        await PaperIngestion.UpsertFromImportAsync(db, dto);
        return Results.Ok(new { ok = true, paperId = dto.Id, questionCount = dto.Questions.Count });
    }
    catch (ArgumentException ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
});

app.MapPost("/api/ingestion/jobs", async (EnqueueSingleJobRequest req, MatricPrepDbContext db, IOptions<MatricPrepOptions> options) =>
{
    var root = options.Value.ResolvedExamPapersRoot();
    if (string.IsNullOrWhiteSpace(root) || !Directory.Exists(root))
        return Results.BadRequest(new
        {
            message = "ExamPapersRoot not set or invalid. Configure MatricPrep:ExamPapersRoot or MATRICPREP_EXAM_PAPERS_ROOT."
        });

    try
    {
        var resolved = ManifestPaperResolver.Resolve(root, req.Session, req.SubjectFolder, req.PaperNumber, req.Language);
        var job = new IngestionJob
        {
            Id = Guid.NewGuid(),
            Status = "Pending",
            Session = req.Session,
            SubjectFolder = req.SubjectFolder,
            PaperNumber = req.PaperNumber,
            Language = req.Language,
            PaperRelativePath = resolved.PaperRelativePath,
            MemoRelativePath = resolved.MemoRelativePath,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };
        db.IngestionJobs.Add(job);
        await db.SaveChangesAsync();
        return Results.Ok(new { id = job.Id });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
});

app.MapPost("/api/ingestion/jobs/bulk", async (BulkEnqueueJobsRequest req, MatricPrepDbContext db, IOptions<MatricPrepOptions> options) =>
{
    var root = options.Value.ResolvedExamPapersRoot();
    if (string.IsNullOrWhiteSpace(root) || !Directory.Exists(root))
        return Results.BadRequest(new
        {
            message = "ExamPapersRoot not set or invalid. Configure MatricPrep:ExamPapersRoot or MATRICPREP_EXAM_PAPERS_ROOT."
        });

    try
    {
        var pairs = ManifestPaperResolver.ListNonLanguagePairs(root, req.Session, req.SubjectFolder);
        foreach (var p in pairs)
        {
            db.IngestionJobs.Add(new IngestionJob
            {
                Id = Guid.NewGuid(),
                Status = "Pending",
                Session = req.Session,
                SubjectFolder = p.SubjectFolder,
                PaperNumber = p.PaperNumber,
                Language = p.Language,
                PaperRelativePath = p.PaperRelativePath,
                MemoRelativePath = p.MemoRelativePath,
                CreatedAtUtc = DateTimeOffset.UtcNow
            });
        }

        await db.SaveChangesAsync();
        return Results.Ok(new { enqueued = pairs.Count });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
});

app.MapGet("/api/ingestion/jobs", async (string? status, MatricPrepDbContext db) =>
{
    var q = db.IngestionJobs.AsQueryable();
    if (!string.IsNullOrWhiteSpace(status))
        q = q.Where(j => j.Status == status);

    var list = await q
        .OrderByDescending(j => j.CreatedAtUtc)
        .Take(500)
        .Select(j => new IngestionJobDto(
            j.Id,
            j.Status,
            j.Session,
            j.SubjectFolder,
            j.PaperNumber,
            j.Language,
            j.ResultPaperId,
            j.ErrorMessage,
            j.CreatedAtUtc,
            j.StartedAtUtc,
            j.CompletedAtUtc))
        .ToListAsync();
    return Results.Ok(list);
});

app.MapPost("/api/me", async (UpsertLearnerProfileRequest req, MatricPrepDbContext db) =>
{
    var learner = await EnsureLearnerAsync(db, req.Id, req.DisplayName, req.SubjectIds, req.TargetExamDateUtc);
    return Results.Ok(ToLearnerDto(learner));
});

app.MapGet("/api/me/{learnerId}", async (string learnerId, MatricPrepDbContext db) =>
{
    var learner = await EnsureLearnerAsync(db, learnerId, null, null, null);
    return Results.Ok(ToLearnerDto(learner));
});

app.MapGet("/api/analytics/overview", async (string? learnerId, MatricPrepDbContext db) =>
{
    learnerId = NormalizeLearnerId(learnerId);
    var attempts = await db.Attempts.Where(a => a.LearnerId == learnerId).ToListAsync();
    var answers = await db.AttemptAnswers
        .Where(a => db.Attempts.Where(at => at.LearnerId == learnerId).Select(at => at.Id).Contains(a.AttemptId))
        .ToListAsync();
    var topicRows = answers
        .Where(a => !string.IsNullOrWhiteSpace(a.Topic) && a.IsScorable)
        .GroupBy(a => new { a.PaperId, Topic = a.Topic ?? "General" })
        .Select(g => new TopicMasteryDto(
            "",
            g.Key.Topic,
            g.Count(),
            g.Count(x => x.IsCorrect),
            g.Count() == 0 ? 0 : (int)Math.Round((double)g.Count(x => x.IsCorrect) / g.Count() * 100)))
        .OrderBy(x => x.Percent)
        .ToList();

    var answered = answers.Count(a => a.IsScorable);
    var correct = answers.Count(a => a.IsScorable && a.IsCorrect);
    var readiness = answered == 0 ? 0 : (int)Math.Round((double)correct / answered * 100);
    var nextActions = new List<NextActionDto>
    {
        new("Generate study path", "Build a weekly plan from weak topics and available papers.", "/study-path", "plan"),
        new("Review weak topics", "Open revision packs for topics below 70%.", "/revision", "revision"),
        new("Practice flashcards", "Drill due cards before attempting another paper.", "/flashcards", "flashcards")
    };

    return Results.Ok(new AnalyticsOverviewDto(
        readiness,
        attempts.Count,
        answered,
        correct,
        topicRows.Take(5).ToList(),
        topicRows.OrderByDescending(x => x.Percent).Take(5).ToList(),
        nextActions));
});

app.MapGet("/api/readiness", async (string? learnerId, MatricPrepDbContext db) =>
{
    learnerId = NormalizeLearnerId(learnerId);
    var answers = await db.AttemptAnswers
        .Where(a => db.Attempts.Where(at => at.LearnerId == learnerId).Select(at => at.Id).Contains(a.AttemptId) && a.IsScorable)
        .ToListAsync();
    var readiness = answers.Count == 0 ? 0 : (int)Math.Round((double)answers.Count(a => a.IsCorrect) / answers.Count * 100);
    return Results.Ok(new { learnerId, readinessPercent = readiness, questionsAnswered = answers.Count });
});

app.MapPost("/api/study-plans/generate", async (
    GenerateStudyPlanRequest req,
    MatricPrepDbContext db,
    TutorChatService ai,
    IOptions<MatricPrepOptions> options,
    CancellationToken ct) =>
{
    await EnsureLearnerAsync(db, req.LearnerId, null, null, null);
    var subject = await db.Subjects.FirstOrDefaultAsync(s => s.Id == req.SubjectId, ct);
    if (subject is null) return Results.NotFound(new { message = "Subject not found" });
    var papers = await db.Papers.Where(p => p.SubjectId == req.SubjectId).OrderByDescending(p => p.Year).Take(6).ToListAsync(ct);
    var focus = req.FocusTopics?.Where(t => !string.IsNullOrWhiteSpace(t)).ToArray() ?? [];
    if (focus.Length == 0) focus = papers.SelectMany(p => p.Topics).Distinct().Take(4).ToArray();

    if (options.Value.TutorChat.Enabled && ai.IsConfigured())
    {
        try
        {
            _ = await ai.GenerateStructuredAsync(
                "a study path",
                $"Subject: {subject.Label}\nFocus topics: {string.Join(", ", focus)}\nPapers: {string.Join("; ", papers.Select(p => $"{p.Id} {p.Title} {p.Year}"))}",
                "{ \"steps\": [{ \"type\": \"revision|flashcards|quiz|paper\", \"title\": \"...\", \"description\": \"...\", \"topic\": \"...\", \"paperId\": \"optional\" }] }",
                ct);
        }
        catch { /* deterministic plan below keeps the endpoint useful offline */ }
    }

    var plan = new StudyPlan
    {
        Id = Guid.NewGuid(),
        LearnerId = NormalizeLearnerId(req.LearnerId),
        SubjectId = req.SubjectId,
        Title = $"{subject.Label} exam path",
        CreatedAtUtc = DateTime.UtcNow,
        TargetDateUtc = req.TargetDateUtc
    };
    db.StudyPlans.Add(plan);
    var steps = BuildStudyPlanSteps(plan.Id, req.SubjectId, focus, papers).ToList();
    db.StudyPlanSteps.AddRange(steps);
    await db.SaveChangesAsync(ct);
    return Results.Ok(ToStudyPlanDto(plan, steps));
});

app.MapGet("/api/study-plans/current", async (string? learnerId, MatricPrepDbContext db) =>
{
    learnerId = NormalizeLearnerId(learnerId);
    var plan = await db.StudyPlans
        .Where(p => p.LearnerId == learnerId && p.Status == "Active")
        .OrderByDescending(p => p.CreatedAtUtc)
        .FirstOrDefaultAsync();
    if (plan is null) return Results.NotFound();
    var steps = await db.StudyPlanSteps.Where(s => s.StudyPlanId == plan.Id).OrderBy(s => s.SortOrder).ToListAsync();
    return Results.Ok(ToStudyPlanDto(plan, steps));
});

app.MapPost("/api/study-plans/{planId:guid}/steps/{stepId:guid}/complete", async (
    Guid planId,
    Guid stepId,
    MatricPrepDbContext db) =>
{
    var step = await db.StudyPlanSteps.FirstOrDefaultAsync(s => s.Id == stepId && s.StudyPlanId == planId);
    if (step is null) return Results.NotFound();
    step.IsCompleted = true;
    step.CompletedAtUtc = DateTime.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok(new { ok = true });
});

app.MapGet("/api/revision-packs", async (string? learnerId, MatricPrepDbContext db) =>
{
    learnerId = NormalizeLearnerId(learnerId);
    var packs = await db.RevisionPacks
        .Where(p => p.LearnerId == learnerId)
        .OrderByDescending(p => p.CreatedAtUtc)
        .Take(50)
        .ToListAsync();
    return Results.Ok(packs.Select(ToRevisionPackDto));
});

app.MapGet("/api/revision-packs/{packId:guid}", async (Guid packId, MatricPrepDbContext db) =>
{
    var pack = await db.RevisionPacks.FirstOrDefaultAsync(p => p.Id == packId);
    return pack is null ? Results.NotFound() : Results.Ok(ToRevisionPackDto(pack));
});

app.MapPost("/api/revision-packs/generate", async (
    GenerateRevisionPackRequest req,
    MatricPrepDbContext db,
    TutorChatService ai,
    IOptions<MatricPrepOptions> options,
    CancellationToken ct) =>
{
    await EnsureLearnerAsync(db, req.LearnerId, null, null, null);
    var seed = await ResolveSeedQuestions(db, req.SubjectId, req.Topic, req.PaperId, req.QuestionId, 5, ct);
    var topic = req.Topic ?? seed.FirstOrDefault()?.Topic ?? "Exam skills";
    var content = BuildRevisionPackContent(topic, seed);
    if (options.Value.TutorChat.Enabled && ai.IsConfigured())
    {
        try
        {
            var json = await ai.GenerateStructuredAsync(
                "a revision pack",
                string.Join("\n\n", seed.Select(q => $"Topic: {q.Topic}\nQuestion: {q.Prompt}\nMemo: {q.MemoAnswer}\nNotes: {q.MarkingNotes}")),
                "{ \"sections\": [{ \"title\": \"...\", \"body\": \"...\" }], \"commonMistakes\": [\"...\"], \"drills\": [\"...\"] }",
                ct);
            if (LooksLikeJson(json)) content = json;
        }
        catch { }
    }
    var pack = new RevisionPack
    {
        Id = Guid.NewGuid(),
        LearnerId = NormalizeLearnerId(req.LearnerId),
        SubjectId = req.SubjectId,
        Topic = topic,
        Title = $"{topic} revision pack",
        Summary = $"A grounded exam-prep pack for {topic}.",
        ContentJson = content,
        SourcePaperId = req.PaperId,
        SourceQuestionId = req.QuestionId,
        CreatedAtUtc = DateTime.UtcNow
    };
    db.RevisionPacks.Add(pack);
    await db.SaveChangesAsync(ct);
    return Results.Ok(ToRevisionPackDto(pack));
});

app.MapGet("/api/flashcard-decks", async (string? learnerId, MatricPrepDbContext db) =>
{
    learnerId = NormalizeLearnerId(learnerId);
    var decks = await db.FlashcardDecks
        .Where(d => d.LearnerId == learnerId)
        .OrderByDescending(d => d.CreatedAtUtc)
        .Take(50)
        .ToListAsync();
    return Results.Ok(decks.Select(d => new FlashcardDeckDto(d.Id, d.LearnerId, d.SubjectId, d.Topic, d.Title, d.CreatedAtUtc, [])));
});

app.MapGet("/api/flashcard-decks/{deckId:guid}", async (Guid deckId, MatricPrepDbContext db) =>
{
    var deck = await db.FlashcardDecks.FirstOrDefaultAsync(d => d.Id == deckId);
    if (deck is null) return Results.NotFound();
    var cards = await db.Flashcards.Where(c => c.DeckId == deckId).OrderBy(c => c.DueAtUtc).ToListAsync();
    return Results.Ok(ToFlashcardDeckDto(deck, cards));
});

app.MapPost("/api/flashcard-decks/generate", async (
    GenerateFlashcardDeckRequest req,
    MatricPrepDbContext db,
    CancellationToken ct) =>
{
    await EnsureLearnerAsync(db, req.LearnerId, null, null, null);
    var seed = await ResolveSeedQuestions(db, req.SubjectId, req.Topic, req.PaperId, req.QuestionId, 8, ct);
    var topic = req.Topic ?? seed.FirstOrDefault()?.Topic ?? "Exam skills";
    var deck = new FlashcardDeck
    {
        Id = Guid.NewGuid(),
        LearnerId = NormalizeLearnerId(req.LearnerId),
        SubjectId = req.SubjectId,
        Topic = topic,
        Title = $"{topic} flashcards",
        CreatedAtUtc = DateTime.UtcNow
    };
    var cards = BuildFlashcards(deck.Id, seed, topic).ToList();
    db.FlashcardDecks.Add(deck);
    db.Flashcards.AddRange(cards);
    await db.SaveChangesAsync(ct);
    return Results.Ok(ToFlashcardDeckDto(deck, cards));
});

app.MapPost("/api/flashcards/{cardId:guid}/review", async (Guid cardId, ReviewFlashcardRequest req, MatricPrepDbContext db) =>
{
    var card = await db.Flashcards.FirstOrDefaultAsync(c => c.Id == cardId);
    if (card is null) return Results.NotFound();
    card.ReviewCount++;
    card.Difficulty = req.Rating;
    card.Ease = req.Rating.Equals("again", StringComparison.OrdinalIgnoreCase) ? Math.Max(1.3, card.Ease - 0.2) : card.Ease + 0.1;
    card.DueAtUtc = DateTime.UtcNow.AddDays(req.Rating.Equals("again", StringComparison.OrdinalIgnoreCase) ? 1 : Math.Max(2, card.ReviewCount * card.Ease));
    await db.SaveChangesAsync();
    return Results.Ok(ToFlashcardDto(card));
});

app.MapPost("/api/quizzes/generate", async (
    GenerateQuizRequest req,
    MatricPrepDbContext db,
    CancellationToken ct) =>
{
    await EnsureLearnerAsync(db, req.LearnerId, null, null, null);
    var count = Math.Clamp(req.QuestionCount ?? 5, 3, 12);
    var seed = await ResolveSeedQuestions(db, req.SubjectId, req.Topic, req.PaperId, null, count, ct);
    var topic = req.Topic ?? seed.FirstOrDefault()?.Topic ?? "Mixed practice";
    var quiz = new Quiz
    {
        Id = Guid.NewGuid(),
        LearnerId = NormalizeLearnerId(req.LearnerId),
        SubjectId = req.SubjectId,
        Topic = topic,
        Title = $"{topic} quick quiz",
        CreatedAtUtc = DateTime.UtcNow
    };
    var items = BuildQuizQuestions(quiz.Id, seed).ToList();
    db.Quizzes.Add(quiz);
    db.QuizQuestions.AddRange(items);
    await db.SaveChangesAsync(ct);
    return Results.Ok(ToQuizDto(quiz, items));
});

app.MapGet("/api/quizzes/{quizId:guid}", async (Guid quizId, MatricPrepDbContext db) =>
{
    var quiz = await db.Quizzes.FirstOrDefaultAsync(q => q.Id == quizId);
    if (quiz is null) return Results.NotFound();
    var questions = await db.QuizQuestions.Where(q => q.QuizId == quizId).OrderBy(q => q.SortOrder).ToListAsync();
    return Results.Ok(ToQuizDto(quiz, questions));
});

app.MapPost("/api/quizzes/{quizId:guid}/attempts", async (
    Guid quizId,
    SubmitQuizAttemptRequest req,
    MatricPrepDbContext db) =>
{
    var quiz = await db.Quizzes.FirstOrDefaultAsync(q => q.Id == quizId);
    if (quiz is null) return Results.NotFound();
    var questions = await db.QuizQuestions.Where(q => q.QuizId == quizId).OrderBy(q => q.SortOrder).ToListAsync();
    var answers = req.Answers.ToDictionary(a => a.QuizQuestionId, a => a.OptionId);
    var correct = 0;
    var reviews = new List<QuizQuestionReviewDto>();
    var attempt = new QuizAttempt
    {
        Id = Guid.NewGuid(),
        QuizId = quizId,
        LearnerId = NormalizeLearnerId(req.LearnerId),
        CreatedAtUtc = DateTime.UtcNow,
        TotalCount = questions.Count
    };
    foreach (var q in questions)
    {
        answers.TryGetValue(q.Id, out var chosen);
        var isCorrect = !string.IsNullOrWhiteSpace(q.CorrectOptionId)
            && string.Equals(chosen?.Trim(), q.CorrectOptionId.Trim(), StringComparison.OrdinalIgnoreCase);
        if (isCorrect) correct++;
        db.QuizAttemptAnswers.Add(new QuizAttemptAnswer
        {
            Id = Guid.NewGuid(),
            QuizAttemptId = attempt.Id,
            QuizQuestionId = q.Id,
            OptionId = chosen,
            IsCorrect = isCorrect
        });
        reviews.Add(new QuizQuestionReviewDto(q.Id, isCorrect, chosen, q.CorrectOptionId, q.Explanation));
    }
    attempt.CorrectCount = correct;
    db.QuizAttempts.Add(attempt);
    await db.SaveChangesAsync();
    var percent = attempt.TotalCount == 0 ? 0 : (int)Math.Round((double)correct / attempt.TotalCount * 100);
    return Results.Ok(new QuizAttemptResultDto(attempt.Id, correct, attempt.TotalCount, percent, reviews));
});

app.MapPost("/api/attempts", async (CreateAttemptRequest req, MatricPrepDbContext db) =>
{
    var learnerId = NormalizeLearnerId(req.LearnerId);
    await EnsureLearnerAsync(db, learnerId, null, null, null);

    var paper = await db.Papers.FirstOrDefaultAsync(p => p.Id == req.PaperId);
    if (paper is null) return Results.NotFound(new { message = "Paper not found" });

    var questions = await db.Questions.Where(q => q.PaperId == req.PaperId).OrderBy(q => q.SortOrder).ToListAsync();
    var byId = questions.ToDictionary(q => q.Id, q => q);
    var answersByQ = req.Answers.ToDictionary(a => a.QuestionId, a => a.OptionId);

    var correct = 0;
    var reviews = new List<QuestionReviewDto>();

    foreach (var q in questions)
    {
        answersByQ.TryGetValue(q.Id, out var chosen);
        var chosenNorm = chosen?.Trim().ToLowerInvariant();
        var correctId = q.CorrectOptionId?.Trim().ToLowerInvariant();
        var isMcq = q.QuestionType.Equals("mcq", StringComparison.OrdinalIgnoreCase);
        var scorable = isMcq && correctId is not null;
        var isCorrect = scorable && chosenNorm == correctId;
        if (isCorrect) correct++;

        reviews.Add(new QuestionReviewDto(
            q.Id,
            q.QuestionType,
            isCorrect,
            chosen,
            q.CorrectOptionId,
            q.MemoAnswer,
            q.MarkingNotes,
            q.Explanation
        ));
    }

    var scorableCount = questions.Count(q =>
        q.QuestionType.Equals("mcq", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(q.CorrectOptionId));
    if (scorableCount == 0) scorableCount = questions.Count;

    var attempt = new Attempt
    {
        Id = Guid.NewGuid(),
        LearnerId = learnerId,
        PaperId = req.PaperId,
        CreatedAtUtc = DateTime.UtcNow,
        DurationSeconds = req.DurationSeconds,
        CorrectCount = correct,
        TotalCount = scorableCount
    };

    db.Attempts.Add(attempt);
    foreach (var q in questions)
    {
        answersByQ.TryGetValue(q.Id, out var chosen);
        var chosenNorm = chosen?.Trim().ToLowerInvariant();
        var correctId = q.CorrectOptionId?.Trim().ToLowerInvariant();
        var isMcq = q.QuestionType.Equals("mcq", StringComparison.OrdinalIgnoreCase);
        var scorable = isMcq && correctId is not null;
        db.AttemptAnswers.Add(new AttemptAnswer
        {
            Id = Guid.NewGuid(),
            AttemptId = attempt.Id,
            PaperId = req.PaperId,
            QuestionId = q.Id,
            Topic = q.Topic,
            ChosenOptionId = chosen,
            CorrectOptionId = q.CorrectOptionId,
            IsCorrect = scorable && chosenNorm == correctId,
            IsScorable = scorable,
            CreatedAtUtc = DateTime.UtcNow
        });
    }
    await db.SaveChangesAsync();

    var percent = attempt.TotalCount == 0
        ? 0
        : (int)Math.Round((double)correct / attempt.TotalCount * 100);

    return Results.Ok(new AttemptResultDto(
        attempt.Id,
        correct,
        attempt.TotalCount,
        percent,
        reviews
    ));
});

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<MatricPrepDbContext>();
    var maxAttempts = 15;
    var delayMs = 1000;
    for (var attempt = 1; attempt <= maxAttempts; attempt++)
    {
        try
        {
            await db.Database.MigrateAsync();
            await MatricPrepSeeder.SeedIfEmptyAsync(db);
            break;
        }
        catch (Exception ex) when (attempt < maxAttempts)
        {
            db.ChangeTracker.Clear();
            app.Logger.LogWarning(ex, "Database not ready (attempt {Attempt}/{Max}). Retrying in {Delay}ms...", attempt, maxAttempts, delayMs);
            await Task.Delay(delayMs);
            delayMs = Math.Min(delayMs * 2, 8000);
        }
    }
}

app.Run();

static (string Context, string Method, string WorkedSolution, string FinalAnswer) ParseBreakdownSections(string raw)
{
    if (string.IsNullOrWhiteSpace(raw))
        return ("", "", "", "");

    static string Extract(string text, string heading, params string[] stopHeadings)
    {
        var marker = $"{heading}:";
        var start = text.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (start < 0) return "";
        start += marker.Length;
        var end = text.Length;
        foreach (var stop in stopHeadings)
        {
            var stopAt = text.IndexOf($"{stop}:", start, StringComparison.OrdinalIgnoreCase);
            if (stopAt >= 0 && stopAt < end) end = stopAt;
        }
        return text[start..end].Trim();
    }

    var context = Extract(raw, "Context", "Method", "Worked Solution", "Final Answer");
    var method = Extract(raw, "Method", "Worked Solution", "Final Answer");
    var worked = Extract(raw, "Worked Solution", "Final Answer");
    var finalAnswer = Extract(raw, "Final Answer");
    return (context, method, worked, finalAnswer);
}

static string NormalizeLearnerId(string? raw)
{
    var trimmed = raw?.Trim();
    return string.IsNullOrWhiteSpace(trimmed) ? "demo-learner" : trimmed;
}

static async Task<LearnerProfile> EnsureLearnerAsync(
    MatricPrepDbContext db,
    string? learnerId,
    string? displayName,
    string[]? subjectIds,
    DateTime? targetExamDateUtc)
{
    var id = NormalizeLearnerId(learnerId);
    var learner = await db.LearnerProfiles.FirstOrDefaultAsync(l => l.Id == id);
    if (learner is null)
    {
        learner = new LearnerProfile
        {
            Id = id,
            DisplayName = string.IsNullOrWhiteSpace(displayName) ? "Matric learner" : displayName.Trim(),
            CreatedAtUtc = DateTime.UtcNow,
            LastSeenAtUtc = DateTime.UtcNow,
            TargetExamDateUtc = targetExamDateUtc,
            SubjectIds = subjectIds?.Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s.Trim()).Distinct().ToArray() ?? []
        };
        db.LearnerProfiles.Add(learner);
        await db.SaveChangesAsync();
        return learner;
    }

    learner.LastSeenAtUtc = DateTime.UtcNow;
    if (!string.IsNullOrWhiteSpace(displayName)) learner.DisplayName = displayName.Trim();
    if (targetExamDateUtc is not null) learner.TargetExamDateUtc = targetExamDateUtc;
    if (subjectIds is not null) learner.SubjectIds = subjectIds.Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s.Trim()).Distinct().ToArray();
    await db.SaveChangesAsync();
    return learner;
}

static LearnerProfileDto ToLearnerDto(LearnerProfile learner) =>
    new(learner.Id, learner.DisplayName, learner.CreatedAtUtc, learner.LastSeenAtUtc, learner.TargetExamDateUtc, learner.SubjectIds);

static IEnumerable<StudyPlanStep> BuildStudyPlanSteps(Guid planId, string subjectId, string[] topics, List<Paper> papers)
{
    var order = 1;
    foreach (var topic in topics.DefaultIfEmpty("Core exam skills").Take(4))
    {
        yield return new StudyPlanStep
        {
            Id = Guid.NewGuid(),
            StudyPlanId = planId,
            SortOrder = order++,
            StepType = "revision",
            Title = $"Revise {topic}",
            Description = "Read a generated pack with formulae, common mistakes, and memo-grounded examples.",
            SubjectId = subjectId,
            Topic = topic,
            ToolRoute = "/revision"
        };
        yield return new StudyPlanStep
        {
            Id = Guid.NewGuid(),
            StudyPlanId = planId,
            SortOrder = order++,
            StepType = "flashcards",
            Title = $"Drill {topic} flashcards",
            Description = "Use short recall cards before attempting exam questions.",
            SubjectId = subjectId,
            Topic = topic,
            ToolRoute = "/flashcards"
        };
    }

    foreach (var paper in papers.Take(2))
    {
        yield return new StudyPlanStep
        {
            Id = Guid.NewGuid(),
            StudyPlanId = planId,
            SortOrder = order++,
            StepType = "paper",
            Title = $"Work through {paper.Title}",
            Description = "Open the AI workspace, attempt questions, then compare with explanations.",
            SubjectId = subjectId,
            PaperId = paper.Id,
            ToolRoute = $"/tutor/{Uri.EscapeDataString(paper.Id)}"
        };
    }
}

static StudyPlanDto ToStudyPlanDto(StudyPlan plan, List<StudyPlanStep> steps) =>
    new(
        plan.Id,
        plan.LearnerId,
        plan.SubjectId,
        plan.Title,
        plan.Status,
        plan.CreatedAtUtc,
        plan.TargetDateUtc,
        steps.OrderBy(s => s.SortOrder).Select(s => new StudyPlanStepDto(
            s.Id,
            s.SortOrder,
            s.StepType,
            s.Title,
            s.Description,
            s.SubjectId,
            s.PaperId,
            s.Topic,
            s.ToolRoute,
            s.IsCompleted,
            s.CompletedAtUtc)).ToList());

static async Task<List<Question>> ResolveSeedQuestions(
    MatricPrepDbContext db,
    string subjectId,
    string? topic,
    string? paperId,
    string? questionId,
    int take,
    CancellationToken ct)
{
    var query = db.Questions.AsQueryable();
    if (!string.IsNullOrWhiteSpace(questionId))
        query = query.Where(q => q.Id == questionId);
    if (!string.IsNullOrWhiteSpace(paperId))
        query = query.Where(q => q.PaperId == paperId);
    if (!string.IsNullOrWhiteSpace(topic))
        query = query.Where(q => q.Topic == topic);
    if (!string.IsNullOrWhiteSpace(subjectId))
    {
        var paperIds = db.Papers.Where(p => p.SubjectId == subjectId).Select(p => p.Id);
        query = query.Where(q => paperIds.Contains(q.PaperId));
    }

    var rows = await query.OrderBy(q => q.SortOrder).Take(take).ToListAsync(ct);
    if (rows.Count > 0) return rows;

    var fallbackPaperIds = db.Papers.Where(p => p.SubjectId == subjectId).Select(p => p.Id);
    return await db.Questions.Where(q => fallbackPaperIds.Contains(q.PaperId)).OrderBy(q => q.SortOrder).Take(take).ToListAsync(ct);
}

static string BuildRevisionPackContent(string topic, List<Question> questions) =>
    JsonSerializer.Serialize(new
    {
        sections = new[]
        {
            new { title = "Core idea", body = $"Focus on the command words, required format, and mark allocation for {topic}." },
            new { title = "Memo-grounded examples", body = string.Join("\n\n", questions.Take(3).Select(q => $"{q.Topic}: {Clip(q.MemoAnswer ?? q.Explanation ?? q.MarkingNotes, 500)}")) },
            new { title = "Exam drill", body = "Attempt the linked questions first, then compare your method to the memo guidance." }
        },
        commonMistakes = questions.Select(q => q.MarkingNotes).Where(x => !string.IsNullOrWhiteSpace(x)).Take(4).ToArray(),
        drills = questions.Select(q => q.Id).Take(6).ToArray()
    });

static RevisionPackDto ToRevisionPackDto(RevisionPack pack) =>
    new(
        pack.Id,
        pack.LearnerId,
        pack.SubjectId,
        pack.Topic,
        pack.Title,
        pack.Summary,
        JsonSerializer.Deserialize<object>(pack.ContentJson) ?? new { },
        pack.SourcePaperId,
        pack.SourceQuestionId,
        pack.CreatedAtUtc);

static IEnumerable<Flashcard> BuildFlashcards(Guid deckId, List<Question> questions, string topic)
{
    if (questions.Count == 0)
    {
        yield return new Flashcard
        {
            Id = Guid.NewGuid(),
            DeckId = deckId,
            Front = $"What should you check first in a {topic} question?",
            Back = "Read the REQUIRED section, identify the command verb, then plan the marks before calculating.",
            DueAtUtc = DateTime.UtcNow
        };
        yield break;
    }

    foreach (var q in questions)
    {
        yield return new Flashcard
        {
            Id = Guid.NewGuid(),
            DeckId = deckId,
            Front = $"{q.Topic}: what is the key method for this question?",
            Back = Clip(q.Explanation ?? q.MarkingNotes ?? q.MemoAnswer ?? "Use the official memo to identify the mark-bearing steps.", 900),
            SourceQuestionId = q.Id,
            DueAtUtc = DateTime.UtcNow
        };
    }
}

static FlashcardDeckDto ToFlashcardDeckDto(FlashcardDeck deck, List<Flashcard> cards) =>
    new(deck.Id, deck.LearnerId, deck.SubjectId, deck.Topic, deck.Title, deck.CreatedAtUtc, cards.Select(ToFlashcardDto).ToList());

static FlashcardDto ToFlashcardDto(Flashcard card) =>
    new(card.Id, card.Front, card.Back, card.SourceQuestionId, card.Difficulty, card.DueAtUtc, card.ReviewCount);

static IEnumerable<QuizQuestion> BuildQuizQuestions(Guid quizId, List<Question> questions)
{
    var order = 1;
    foreach (var q in questions)
    {
        var hasOptions = q.OptionsJson.Trim().StartsWith("[") && q.OptionsJson.Contains("\"id\"");
        yield return new QuizQuestion
        {
            Id = Guid.NewGuid(),
            QuizId = quizId,
            SortOrder = order++,
            Prompt = q.Prompt,
            OptionsJson = hasOptions ? q.OptionsJson : JsonSerializer.Serialize(new[] { new { id = "A", text = "I understand the command verb and method." }, new { id = "B", text = "I need to revise this topic again." } }),
            CorrectOptionId = string.IsNullOrWhiteSpace(q.CorrectOptionId) ? "A" : q.CorrectOptionId,
            Explanation = q.Explanation ?? q.MemoAnswer ?? q.MarkingNotes,
            SourceQuestionId = q.Id
        };
    }
}

static QuizDto ToQuizDto(Quiz quiz, List<QuizQuestion> questions) =>
    new(
        quiz.Id,
        quiz.LearnerId,
        quiz.SubjectId,
        quiz.Topic,
        quiz.Title,
        quiz.CreatedAtUtc,
        questions.Select(q => new QuizQuestionDto(
            q.Id,
            q.SortOrder,
            q.Prompt,
            JsonSerializer.Deserialize<object>(q.OptionsJson) ?? Array.Empty<object>(),
            q.Explanation,
            q.SourceQuestionId)).ToList());

static bool LooksLikeJson(string value)
{
    var trimmed = value.Trim();
    if (!trimmed.StartsWith('{') && !trimmed.StartsWith('[')) return false;
    try
    {
        JsonDocument.Parse(trimmed);
        return true;
    }
    catch
    {
        return false;
    }
}

static string Clip(string? value, int max)
{
    if (string.IsNullOrWhiteSpace(value)) return "";
    value = value.Trim();
    return value.Length <= max ? value : value[..max] + "...";
}
