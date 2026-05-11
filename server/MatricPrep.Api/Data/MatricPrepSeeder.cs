using Microsoft.EntityFrameworkCore;

namespace MatricPrep.Api.Data;

/// <summary>
/// Seeds subject catalogue only. Papers and questions come from the import pipeline
/// (PDF extract → LLM → POST /api/ingestion/papers), not from mock data.
/// </summary>
public static class MatricPrepSeeder
{
    public static async Task SeedIfEmptyAsync(MatricPrepDbContext db)
    {
        if (await db.Subjects.AnyAsync()) return;

        db.Subjects.AddRange(
            new Subject
            {
                Id = "maths",
                Label = "Mathematics",
                Description = "Past papers and practice for Mathematics.",
                SortOrder = 1
            },
            new Subject
            {
                Id = "physical-science",
                Label = "Physical Sciences",
                Description = "Past papers and practice for Physical Sciences.",
                SortOrder = 2
            },
            new Subject
            {
                Id = "life-sciences",
                Label = "Life Sciences",
                Description = "Past papers and practice for Life Sciences.",
                SortOrder = 3
            },
            new Subject
            {
                Id = "accounting",
                Label = "Accounting",
                Description = "Past papers and practice for Accounting.",
                SortOrder = 4
            }
        );

        await db.SaveChangesAsync();
    }
}
