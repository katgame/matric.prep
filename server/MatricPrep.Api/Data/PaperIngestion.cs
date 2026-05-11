using MatricPrep.Contracts;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace MatricPrep.Api.Data;

public static class PaperIngestion
{
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public static async Task UpsertFromImportAsync(MatricPrepDbContext db, PaperImportDto dto, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.Id)) throw new ArgumentException("Paper Id is required.");
        if (dto.Questions is null || dto.Questions.Count == 0) throw new ArgumentException("At least one question is required.");

        var subject = await db.Subjects.FirstOrDefaultAsync(s => s.Id == dto.SubjectId, ct);
        if (subject is null)
        {
            db.Subjects.Add(new Subject
            {
                Id = dto.SubjectId,
                Label = dto.SubjectLabel,
                Description = $"Imported subject: {dto.SubjectLabel}",
                SortOrder = 99
            });
        }

        var existing = await db.Papers.FirstOrDefaultAsync(p => p.Id == dto.Id, ct);
        if (existing is not null)
        {
            existing.SubjectId = dto.SubjectId;
            existing.SubjectLabel = dto.SubjectLabel;
            existing.Year = dto.Year;
            existing.Title = dto.Title;
            existing.PaperLabel = dto.PaperLabel;
            existing.DurationMinutes = dto.DurationMinutes;
            existing.QuestionCount = dto.Questions.Count;
            existing.Topics = dto.Topics;
            existing.SourcePaperPdfRelativePath = dto.SourcePaperPdfRelativePath;
            existing.SourceMemoPdfRelativePath = dto.SourceMemoPdfRelativePath;
        }
        else
        {
            db.Papers.Add(new Paper
            {
                Id = dto.Id,
                SubjectId = dto.SubjectId,
                SubjectLabel = dto.SubjectLabel,
                Year = dto.Year,
                Title = dto.Title,
                PaperLabel = dto.PaperLabel,
                DurationMinutes = dto.DurationMinutes,
                QuestionCount = dto.Questions.Count,
                Topics = dto.Topics,
                SourcePaperPdfRelativePath = dto.SourcePaperPdfRelativePath,
                SourceMemoPdfRelativePath = dto.SourceMemoPdfRelativePath
            });
        }

        var oldQs = await db.Questions.Where(q => q.PaperId == dto.Id).ToListAsync(ct);
        db.Questions.RemoveRange(oldQs);

        foreach (var q in dto.Questions.OrderBy(x => x.SortOrder))
        {
            var qType = string.IsNullOrWhiteSpace(q.QuestionType) ? "mcq" : q.QuestionType.Trim();
            var correctOptionId = q.CorrectOptionId;
            var optionsJson = OptionsToJsonString(q.Options);
            if (qType.Equals("mcq", StringComparison.OrdinalIgnoreCase))
            {
                var normalized = NormalizeFiveOptionMcq(q.Id, q.Options, q.CorrectOptionId);
                optionsJson = normalized.OptionsJson;
                correctOptionId = normalized.CorrectOptionId;
            }

            db.Questions.Add(new Question
            {
                Id = q.Id,
                PaperId = dto.Id,
                SortOrder = q.SortOrder,
                QuestionType = qType,
                Topic = q.Topic,
                Difficulty = q.Difficulty,
                Prompt = q.Prompt,
                OptionsJson = optionsJson,
                CorrectOptionId = correctOptionId,
                MemoAnswer = q.MemoAnswer,
                MarkingNotes = q.MarkingNotes,
                Marks = q.Marks,
                Explanation = q.Explanation
            });
        }

        await db.SaveChangesAsync(ct);
    }

    private static string OptionsToJsonString(object? options)
    {
        if (options is JsonElement je) return je.GetRawText();
        return JsonSerializer.Serialize(options ?? Array.Empty<object>(), JsonOpts);
    }

    private static (string OptionsJson, string CorrectOptionId) NormalizeFiveOptionMcq(
        string questionId,
        object? options,
        string? correctOptionId)
    {
        if (string.IsNullOrWhiteSpace(correctOptionId))
            throw new ArgumentException($"Question {questionId}: MCQ requires correctOptionId.");

        var parsed = JsonSerializer.Deserialize<List<ImportOption>>(
            OptionsToJsonString(options),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? [];

        if (parsed.Count != 5)
            throw new ArgumentException($"Question {questionId}: MCQ requires exactly five options.");

        var normalized = parsed.Select(o => new ImportOption(
            NormalizeOptionId(o.Id),
            o.Text?.Trim() ?? "")).ToList();

        if (normalized.Any(o => string.IsNullOrWhiteSpace(o.Id) || string.IsNullOrWhiteSpace(o.Text)))
            throw new ArgumentException($"Question {questionId}: MCQ options require non-empty id and text.");

        var ids = normalized.Select(o => o.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (ids.Count != 5)
            throw new ArgumentException($"Question {questionId}: MCQ option ids must be unique.");

        var correct = NormalizeOptionId(correctOptionId);
        if (!ids.Contains(correct))
            throw new ArgumentException($"Question {questionId}: correctOptionId must match one of the five option ids.");

        return (JsonSerializer.Serialize(normalized, JsonOpts), correct);
    }

    private static string NormalizeOptionId(string? value) => (value ?? "").Trim().ToUpperInvariant();

    private sealed record ImportOption(string Id, string Text);
}
