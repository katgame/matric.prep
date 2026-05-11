using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MatricPrep.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Attempts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PaperId = table.Column<string>(type: "character varying(96)", maxLength: 96, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DurationSeconds = table.Column<int>(type: "integer", nullable: false),
                    CorrectCount = table.Column<int>(type: "integer", nullable: false),
                    TotalCount = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Attempts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Papers",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(96)", maxLength: 96, nullable: false),
                    SubjectId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SubjectLabel = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    PaperLabel = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    DurationMinutes = table.Column<int>(type: "integer", nullable: false),
                    QuestionCount = table.Column<int>(type: "integer", nullable: false),
                    Topics = table.Column<string[]>(type: "text[]", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Papers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Questions",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(96)", maxLength: 96, nullable: false),
                    PaperId = table.Column<string>(type: "character varying(96)", maxLength: 96, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    Topic = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Difficulty = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Prompt = table.Column<string>(type: "character varying(800)", maxLength: 800, nullable: false),
                    OptionsJson = table.Column<string>(type: "jsonb", nullable: false),
                    CorrectOptionId = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Explanation = table.Column<string>(type: "character varying(900)", maxLength: 900, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Questions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Subjects",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Label = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Description = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Subjects", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Attempts_CreatedAtUtc",
                table: "Attempts",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_Attempts_PaperId",
                table: "Attempts",
                column: "PaperId");

            migrationBuilder.CreateIndex(
                name: "IX_Papers_SubjectId_Year",
                table: "Papers",
                columns: new[] { "SubjectId", "Year" });

            migrationBuilder.CreateIndex(
                name: "IX_Questions_PaperId",
                table: "Questions",
                column: "PaperId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Attempts");

            migrationBuilder.DropTable(
                name: "Papers");

            migrationBuilder.DropTable(
                name: "Questions");

            migrationBuilder.DropTable(
                name: "Subjects");
        }
    }
}
