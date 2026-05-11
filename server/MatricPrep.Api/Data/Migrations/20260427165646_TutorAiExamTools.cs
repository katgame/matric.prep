using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MatricPrep.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class TutorAiExamTools : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LearnerId",
                table: "Attempts",
                type: "character varying(96)",
                maxLength: 96,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AttemptAnswers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AttemptId = table.Column<Guid>(type: "uuid", nullable: false),
                    PaperId = table.Column<string>(type: "character varying(96)", maxLength: 96, nullable: false),
                    QuestionId = table.Column<string>(type: "character varying(96)", maxLength: 96, nullable: false),
                    Topic = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    ChosenOptionId = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    CorrectOptionId = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    IsCorrect = table.Column<bool>(type: "boolean", nullable: false),
                    IsScorable = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AttemptAnswers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FlashcardDecks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LearnerId = table.Column<string>(type: "character varying(96)", maxLength: 96, nullable: false),
                    SubjectId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Topic = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FlashcardDecks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Flashcards",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DeckId = table.Column<Guid>(type: "uuid", nullable: false),
                    Front = table.Column<string>(type: "text", nullable: false),
                    Back = table.Column<string>(type: "text", nullable: false),
                    SourceQuestionId = table.Column<string>(type: "character varying(96)", maxLength: 96, nullable: true),
                    Difficulty = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    DueAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ReviewCount = table.Column<int>(type: "integer", nullable: false),
                    Ease = table.Column<double>(type: "double precision", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Flashcards", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LearnerProfiles",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(96)", maxLength: 96, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastSeenAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    TargetExamDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SubjectIds = table.Column<string[]>(type: "text[]", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LearnerProfiles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "QuizAttemptAnswers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    QuizAttemptId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuizQuestionId = table.Column<Guid>(type: "uuid", nullable: false),
                    OptionId = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    IsCorrect = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuizAttemptAnswers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "QuizAttempts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    QuizId = table.Column<Guid>(type: "uuid", nullable: false),
                    LearnerId = table.Column<string>(type: "character varying(96)", maxLength: 96, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CorrectCount = table.Column<int>(type: "integer", nullable: false),
                    TotalCount = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuizAttempts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "QuizQuestions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    QuizId = table.Column<Guid>(type: "uuid", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    Prompt = table.Column<string>(type: "text", nullable: false),
                    OptionsJson = table.Column<string>(type: "jsonb", nullable: false),
                    CorrectOptionId = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    Explanation = table.Column<string>(type: "text", nullable: true),
                    SourceQuestionId = table.Column<string>(type: "character varying(96)", maxLength: 96, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuizQuestions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Quizzes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LearnerId = table.Column<string>(type: "character varying(96)", maxLength: 96, nullable: false),
                    SubjectId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Topic = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Quizzes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RevisionPacks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LearnerId = table.Column<string>(type: "character varying(96)", maxLength: 96, nullable: false),
                    SubjectId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Topic = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Summary = table.Column<string>(type: "text", nullable: false),
                    ContentJson = table.Column<string>(type: "jsonb", nullable: false),
                    SourcePaperId = table.Column<string>(type: "character varying(96)", maxLength: 96, nullable: true),
                    SourceQuestionId = table.Column<string>(type: "character varying(96)", maxLength: 96, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RevisionPacks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "StudyPlans",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LearnerId = table.Column<string>(type: "character varying(96)", maxLength: 96, nullable: false),
                    SubjectId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    TargetDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudyPlans", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "StudyPlanSteps",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StudyPlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    StepType = table.Column<string>(type: "character varying(48)", maxLength: 48, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    SubjectId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    PaperId = table.Column<string>(type: "character varying(96)", maxLength: 96, nullable: true),
                    Topic = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    ToolRoute = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    IsCompleted = table.Column<bool>(type: "boolean", nullable: false),
                    CompletedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudyPlanSteps", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Attempts_LearnerId",
                table: "Attempts",
                column: "LearnerId");

            migrationBuilder.CreateIndex(
                name: "IX_AttemptAnswers_AttemptId",
                table: "AttemptAnswers",
                column: "AttemptId");

            migrationBuilder.CreateIndex(
                name: "IX_AttemptAnswers_PaperId_QuestionId",
                table: "AttemptAnswers",
                columns: new[] { "PaperId", "QuestionId" });

            migrationBuilder.CreateIndex(
                name: "IX_FlashcardDecks_LearnerId_SubjectId_Topic",
                table: "FlashcardDecks",
                columns: new[] { "LearnerId", "SubjectId", "Topic" });

            migrationBuilder.CreateIndex(
                name: "IX_Flashcards_DeckId_DueAtUtc",
                table: "Flashcards",
                columns: new[] { "DeckId", "DueAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_LearnerProfiles_LastSeenAtUtc",
                table: "LearnerProfiles",
                column: "LastSeenAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_QuizAttemptAnswers_QuizAttemptId",
                table: "QuizAttemptAnswers",
                column: "QuizAttemptId");

            migrationBuilder.CreateIndex(
                name: "IX_QuizAttempts_LearnerId_CreatedAtUtc",
                table: "QuizAttempts",
                columns: new[] { "LearnerId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_QuizAttempts_QuizId",
                table: "QuizAttempts",
                column: "QuizId");

            migrationBuilder.CreateIndex(
                name: "IX_QuizQuestions_QuizId_SortOrder",
                table: "QuizQuestions",
                columns: new[] { "QuizId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_Quizzes_LearnerId_SubjectId_Topic",
                table: "Quizzes",
                columns: new[] { "LearnerId", "SubjectId", "Topic" });

            migrationBuilder.CreateIndex(
                name: "IX_RevisionPacks_LearnerId_SubjectId_Topic",
                table: "RevisionPacks",
                columns: new[] { "LearnerId", "SubjectId", "Topic" });

            migrationBuilder.CreateIndex(
                name: "IX_StudyPlans_LearnerId_SubjectId_Status",
                table: "StudyPlans",
                columns: new[] { "LearnerId", "SubjectId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_StudyPlanSteps_StudyPlanId_SortOrder",
                table: "StudyPlanSteps",
                columns: new[] { "StudyPlanId", "SortOrder" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AttemptAnswers");

            migrationBuilder.DropTable(
                name: "FlashcardDecks");

            migrationBuilder.DropTable(
                name: "Flashcards");

            migrationBuilder.DropTable(
                name: "LearnerProfiles");

            migrationBuilder.DropTable(
                name: "QuizAttemptAnswers");

            migrationBuilder.DropTable(
                name: "QuizAttempts");

            migrationBuilder.DropTable(
                name: "QuizQuestions");

            migrationBuilder.DropTable(
                name: "Quizzes");

            migrationBuilder.DropTable(
                name: "RevisionPacks");

            migrationBuilder.DropTable(
                name: "StudyPlans");

            migrationBuilder.DropTable(
                name: "StudyPlanSteps");

            migrationBuilder.DropIndex(
                name: "IX_Attempts_LearnerId",
                table: "Attempts");

            migrationBuilder.DropColumn(
                name: "LearnerId",
                table: "Attempts");
        }
    }
}
