using MatricPrep.Api.Data;
using MatricPrep.Ingestion;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace MatricPrep.Api.Services;

/// <summary>Claims pending jobs and ingests PDFs using the deterministic (no-LLM) path.</summary>
public sealed class IngestionJobWorker : BackgroundService
{
    private static readonly object ClaimLock = new();

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<IngestionJobWorker> _logger;
    private readonly MatricPrepOptions _options;

    public IngestionJobWorker(
        IServiceScopeFactory scopeFactory,
        ILogger<IngestionJobWorker> logger,
        IOptions<MatricPrepOptions> options)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _options = options.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var max = Math.Clamp(_options.MaxConcurrentIngestionJobs, 1, 32);
        var semaphore = new SemaphoreSlim(max);

        while (!stoppingToken.IsCancellationRequested)
        {
            await semaphore.WaitAsync(stoppingToken).ConfigureAwait(false);

            IngestionJob? job;
            await using (var scope = _scopeFactory.CreateAsyncScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<MatricPrepDbContext>();
                lock (ClaimLock)
                {
                    job = db.IngestionJobs
                        .Where(j => j.Status == "Pending")
                        .OrderBy(j => j.CreatedAtUtc)
                        .FirstOrDefault();
                    if (job is not null)
                    {
                        job.Status = "Running";
                        job.StartedAtUtc = DateTimeOffset.UtcNow;
                        db.SaveChanges();
                    }
                }
            }

            if (job is null)
            {
                semaphore.Release();
                try
                {
                    await Task.Delay(400, stoppingToken).ConfigureAwait(false);
                }
                catch (OperationCanceledException)
                {
                    break;
                }

                continue;
            }

            var jobId = job.Id;
            _ = Task.Run(() => RunJobAsync(jobId, semaphore, stoppingToken), stoppingToken);
        }
    }

    private async Task RunJobAsync(Guid jobId, SemaphoreSlim semaphore, CancellationToken stoppingToken)
    {
        try
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<MatricPrepDbContext>();
            var job = await db.IngestionJobs.FirstOrDefaultAsync(j => j.Id == jobId, stoppingToken);
            if (job is null) return;

            var examRoot = ResolveExamPapersRoot();
            if (string.IsNullOrWhiteSpace(examRoot) || !Directory.Exists(examRoot))
            {
                await FailJobAsync(job, "ExamPapersRoot is not configured or does not exist.", db, stoppingToken);
                return;
            }

            var paperAbs = Path.Combine(examRoot, job.Session, job.PaperRelativePath.Replace('/', Path.DirectorySeparatorChar));
            var memoAbs = Path.Combine(examRoot, job.Session, job.MemoRelativePath.Replace('/', Path.DirectorySeparatorChar));

            if (!File.Exists(paperAbs) || !File.Exists(memoAbs))
            {
                await FailJobAsync(
                    job,
                    $"PDF not found. paper={paperAbs} memo={memoAbs}",
                    db,
                    stoppingToken);
                return;
            }

            string paperText;
            string memoText;
            try
            {
                paperText = PdfTextExtractor.Extract(paperAbs);
                memoText = PdfTextExtractor.Extract(memoAbs);
            }
            catch (Exception ex)
            {
                await FailJobAsync(job, $"PDF text extract failed: {ex.Message}", db, stoppingToken);
                return;
            }

            var dto = DeterministicPaperImportBuilder.Build(
                job.Session,
                job.SubjectFolder,
                job.PaperNumber,
                job.Language,
                job.PaperRelativePath,
                job.MemoRelativePath,
                paperText,
                memoText);

            try
            {
                await PaperIngestion.UpsertFromImportAsync(db, dto, stoppingToken);
            }
            catch (Exception ex)
            {
                await FailJobAsync(job, $"Import failed: {ex.Message}", db, stoppingToken);
                return;
            }

            job.Status = "Completed";
            job.ResultPaperId = dto.Id;
            job.CompletedAtUtc = DateTimeOffset.UtcNow;
            job.ErrorMessage = null;
            await db.SaveChangesAsync(stoppingToken);

            _logger.LogInformation("Ingestion job {JobId} completed: {PaperId}", jobId, dto.Id);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // ignore
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ingestion job {JobId} failed unexpectedly", jobId);
            try
            {
                await using var scope = _scopeFactory.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<MatricPrepDbContext>();
                var job = await db.IngestionJobs.FirstOrDefaultAsync(j => j.Id == jobId, stoppingToken);
                if (job is not null)
                    await FailJobAsync(job, ex.Message, db, stoppingToken);
            }
            catch
            {
                // ignored
            }
        }
        finally
        {
            semaphore.Release();
        }
    }

    private string? ResolveExamPapersRoot() => _options.ResolvedExamPapersRoot();

    private async Task FailJobAsync(IngestionJob job, string message, MatricPrepDbContext db, CancellationToken ct)
    {
        job.Status = "Failed";
        job.ErrorMessage = message;
        job.CompletedAtUtc = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        _logger.LogWarning("Ingestion job {JobId} failed: {Message}", job.Id, message);
    }
}
