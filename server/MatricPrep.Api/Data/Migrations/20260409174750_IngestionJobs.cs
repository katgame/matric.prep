using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MatricPrep.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class IngestionJobs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "IngestionJobs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Session = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SubjectFolder = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    PaperNumber = table.Column<int>(type: "integer", nullable: false),
                    Language = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    PaperRelativePath = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    MemoRelativePath = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    ResultPaperId = table.Column<string>(type: "character varying(96)", maxLength: 96, nullable: true),
                    ErrorMessage = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    StartedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CompletedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IngestionJobs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_IngestionJobs_Status",
                table: "IngestionJobs",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_IngestionJobs_Status_CreatedAtUtc",
                table: "IngestionJobs",
                columns: new[] { "Status", "CreatedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "IngestionJobs");
        }
    }
}
