using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MatricPrep.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class PaperMemoAndQuestionFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Prompt",
                table: "Questions",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(800)",
                oldMaxLength: 800);

            migrationBuilder.AlterColumn<string>(
                name: "Explanation",
                table: "Questions",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(900)",
                oldMaxLength: 900);

            migrationBuilder.AlterColumn<string>(
                name: "CorrectOptionId",
                table: "Questions",
                type: "character varying(8)",
                maxLength: 8,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(8)",
                oldMaxLength: 8);

            migrationBuilder.AddColumn<string>(
                name: "MarkingNotes",
                table: "Questions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Marks",
                table: "Questions",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MemoAnswer",
                table: "Questions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "QuestionType",
                table: "Questions",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "mcq");

            migrationBuilder.AddColumn<string>(
                name: "SourceMemoPdfRelativePath",
                table: "Papers",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SourcePaperPdfRelativePath",
                table: "Papers",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MarkingNotes",
                table: "Questions");

            migrationBuilder.DropColumn(
                name: "Marks",
                table: "Questions");

            migrationBuilder.DropColumn(
                name: "MemoAnswer",
                table: "Questions");

            migrationBuilder.DropColumn(
                name: "QuestionType",
                table: "Questions");

            migrationBuilder.DropColumn(
                name: "SourceMemoPdfRelativePath",
                table: "Papers");

            migrationBuilder.DropColumn(
                name: "SourcePaperPdfRelativePath",
                table: "Papers");

            migrationBuilder.AlterColumn<string>(
                name: "Prompt",
                table: "Questions",
                type: "character varying(800)",
                maxLength: 800,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Explanation",
                table: "Questions",
                type: "character varying(900)",
                maxLength: 900,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "CorrectOptionId",
                table: "Questions",
                type: "character varying(8)",
                maxLength: 8,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(8)",
                oldMaxLength: 8,
                oldNullable: true);
        }
    }
}
