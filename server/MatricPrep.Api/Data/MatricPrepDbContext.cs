using Microsoft.EntityFrameworkCore;

namespace MatricPrep.Api.Data;

public class MatricPrepDbContext : DbContext
{
    public MatricPrepDbContext(DbContextOptions<MatricPrepDbContext> options) : base(options) { }

    public DbSet<Subject> Subjects => Set<Subject>();
    public DbSet<Paper> Papers => Set<Paper>();
    public DbSet<Question> Questions => Set<Question>();
    public DbSet<Attempt> Attempts => Set<Attempt>();
    public DbSet<AttemptAnswer> AttemptAnswers => Set<AttemptAnswer>();
    public DbSet<LearnerProfile> LearnerProfiles => Set<LearnerProfile>();
    public DbSet<StudyPlan> StudyPlans => Set<StudyPlan>();
    public DbSet<StudyPlanStep> StudyPlanSteps => Set<StudyPlanStep>();
    public DbSet<RevisionPack> RevisionPacks => Set<RevisionPack>();
    public DbSet<FlashcardDeck> FlashcardDecks => Set<FlashcardDeck>();
    public DbSet<Flashcard> Flashcards => Set<Flashcard>();
    public DbSet<Quiz> Quizzes => Set<Quiz>();
    public DbSet<QuizQuestion> QuizQuestions => Set<QuizQuestion>();
    public DbSet<QuizAttempt> QuizAttempts => Set<QuizAttempt>();
    public DbSet<QuizAttemptAnswer> QuizAttemptAnswers => Set<QuizAttemptAnswer>();
    public DbSet<IngestionJob> IngestionJobs => Set<IngestionJob>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Subject>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Id).HasMaxLength(64);
            b.Property(x => x.Label).HasMaxLength(128);
            b.Property(x => x.Description).HasMaxLength(240);
            b.Property(x => x.SortOrder);
        });

        modelBuilder.Entity<Paper>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Id).HasMaxLength(96);
            b.Property(x => x.SubjectId).HasMaxLength(64);
            b.Property(x => x.SubjectLabel).HasMaxLength(128);
            b.Property(x => x.Title).HasMaxLength(200);
            b.Property(x => x.PaperLabel).HasMaxLength(64);
            b.Property(x => x.Topics).HasColumnType("text[]");
            b.Property(x => x.SourcePaperPdfRelativePath).HasMaxLength(512);
            b.Property(x => x.SourceMemoPdfRelativePath).HasMaxLength(512);
            b.HasIndex(x => new { x.SubjectId, x.Year });
        });

        modelBuilder.Entity<Question>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Id).HasMaxLength(96);
            b.Property(x => x.PaperId).HasMaxLength(96);
            b.Property(x => x.QuestionType).HasMaxLength(32);
            b.Property(x => x.Topic).HasMaxLength(120);
            b.Property(x => x.Difficulty).HasMaxLength(16);
            b.Property(x => x.Prompt).HasColumnType("text");
            b.Property(x => x.CorrectOptionId).HasMaxLength(8);
            b.Property(x => x.OptionsJson).HasColumnType("jsonb");
            b.Property(x => x.MemoAnswer).HasColumnType("text");
            b.Property(x => x.MarkingNotes).HasColumnType("text");
            b.Property(x => x.Explanation).HasColumnType("text");
            b.HasIndex(x => x.PaperId);
        });

        modelBuilder.Entity<Attempt>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.LearnerId).HasMaxLength(96);
            b.Property(x => x.PaperId).HasMaxLength(96);
            b.HasIndex(x => x.LearnerId);
            b.HasIndex(x => x.PaperId);
            b.HasIndex(x => x.CreatedAtUtc);
        });

        modelBuilder.Entity<LearnerProfile>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Id).HasMaxLength(96);
            b.Property(x => x.DisplayName).HasMaxLength(160);
            b.Property(x => x.SubjectIds).HasColumnType("text[]");
            b.HasIndex(x => x.LastSeenAtUtc);
        });

        modelBuilder.Entity<AttemptAnswer>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.PaperId).HasMaxLength(96);
            b.Property(x => x.QuestionId).HasMaxLength(96);
            b.Property(x => x.Topic).HasMaxLength(120);
            b.Property(x => x.ChosenOptionId).HasMaxLength(32);
            b.Property(x => x.CorrectOptionId).HasMaxLength(32);
            b.HasIndex(x => x.AttemptId);
            b.HasIndex(x => new { x.PaperId, x.QuestionId });
        });

        modelBuilder.Entity<StudyPlan>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.LearnerId).HasMaxLength(96);
            b.Property(x => x.SubjectId).HasMaxLength(64);
            b.Property(x => x.Title).HasMaxLength(200);
            b.Property(x => x.Status).HasMaxLength(32);
            b.HasIndex(x => new { x.LearnerId, x.SubjectId, x.Status });
        });

        modelBuilder.Entity<StudyPlanStep>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.StepType).HasMaxLength(48);
            b.Property(x => x.Title).HasMaxLength(200);
            b.Property(x => x.Description).HasColumnType("text");
            b.Property(x => x.SubjectId).HasMaxLength(64);
            b.Property(x => x.PaperId).HasMaxLength(96);
            b.Property(x => x.Topic).HasMaxLength(120);
            b.Property(x => x.ToolRoute).HasMaxLength(320);
            b.HasIndex(x => new { x.StudyPlanId, x.SortOrder });
        });

        modelBuilder.Entity<RevisionPack>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.LearnerId).HasMaxLength(96);
            b.Property(x => x.SubjectId).HasMaxLength(64);
            b.Property(x => x.Topic).HasMaxLength(120);
            b.Property(x => x.Title).HasMaxLength(200);
            b.Property(x => x.Summary).HasColumnType("text");
            b.Property(x => x.ContentJson).HasColumnType("jsonb");
            b.Property(x => x.SourcePaperId).HasMaxLength(96);
            b.Property(x => x.SourceQuestionId).HasMaxLength(96);
            b.HasIndex(x => new { x.LearnerId, x.SubjectId, x.Topic });
        });

        modelBuilder.Entity<FlashcardDeck>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.LearnerId).HasMaxLength(96);
            b.Property(x => x.SubjectId).HasMaxLength(64);
            b.Property(x => x.Topic).HasMaxLength(120);
            b.Property(x => x.Title).HasMaxLength(200);
            b.HasIndex(x => new { x.LearnerId, x.SubjectId, x.Topic });
        });

        modelBuilder.Entity<Flashcard>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Front).HasColumnType("text");
            b.Property(x => x.Back).HasColumnType("text");
            b.Property(x => x.SourceQuestionId).HasMaxLength(96);
            b.Property(x => x.Difficulty).HasMaxLength(32);
            b.HasIndex(x => new { x.DeckId, x.DueAtUtc });
        });

        modelBuilder.Entity<Quiz>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.LearnerId).HasMaxLength(96);
            b.Property(x => x.SubjectId).HasMaxLength(64);
            b.Property(x => x.Topic).HasMaxLength(120);
            b.Property(x => x.Title).HasMaxLength(200);
            b.HasIndex(x => new { x.LearnerId, x.SubjectId, x.Topic });
        });

        modelBuilder.Entity<QuizQuestion>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Prompt).HasColumnType("text");
            b.Property(x => x.OptionsJson).HasColumnType("jsonb");
            b.Property(x => x.CorrectOptionId).HasMaxLength(32);
            b.Property(x => x.Explanation).HasColumnType("text");
            b.Property(x => x.SourceQuestionId).HasMaxLength(96);
            b.HasIndex(x => new { x.QuizId, x.SortOrder });
        });

        modelBuilder.Entity<QuizAttempt>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.LearnerId).HasMaxLength(96);
            b.HasIndex(x => new { x.LearnerId, x.CreatedAtUtc });
            b.HasIndex(x => x.QuizId);
        });

        modelBuilder.Entity<QuizAttemptAnswer>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.OptionId).HasMaxLength(32);
            b.HasIndex(x => x.QuizAttemptId);
        });

        modelBuilder.Entity<IngestionJob>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Status).HasMaxLength(32);
            b.Property(x => x.Session).HasMaxLength(64);
            b.Property(x => x.SubjectFolder).HasMaxLength(128);
            b.Property(x => x.Language).HasMaxLength(32);
            b.Property(x => x.PaperRelativePath).HasMaxLength(512);
            b.Property(x => x.MemoRelativePath).HasMaxLength(512);
            b.Property(x => x.ResultPaperId).HasMaxLength(96);
            b.Property(x => x.ErrorMessage).HasColumnType("text");
            b.HasIndex(x => x.Status);
            b.HasIndex(x => new { x.Status, x.CreatedAtUtc });
        });
    }
}

