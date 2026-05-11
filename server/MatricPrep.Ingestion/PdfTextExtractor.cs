using System.Text;
using UglyToad.PdfPig;

namespace MatricPrep.Ingestion;

/// <summary>Extracts text from a PDF (text layer only — scanned papers need external OCR).</summary>
public static class PdfTextExtractor
{
    public static string Extract(string pdfPath)
    {
        if (!File.Exists(pdfPath))
            throw new FileNotFoundException("PDF not found.", pdfPath);

        using var document = PdfDocument.Open(pdfPath);
        var sb = new StringBuilder();
        foreach (var page in document.GetPages())
        {
            foreach (var word in page.GetWords())
            {
                sb.Append(word.Text);
                sb.Append(' ');
            }

            sb.AppendLine();
        }

        return CleanExtractedText(sb.ToString());
    }

    /// <summary>
    /// Replaces Private Use Area characters from Symbol/Wingdings fonts in PDF text layers.
    /// PdfPig preserves them verbatim; most are decorative and render as garbage in plain text.
    /// </summary>
    private static string CleanExtractedText(string text)
    {
        if (string.IsNullOrEmpty(text)) return text;
        var sb = new StringBuilder(text.Length);
        foreach (var ch in text)
        {
            var cp = (int)ch;
            // Wingdings/Symbol checkmarks commonly used in NSC memo PDFs
            if (cp is 0xF0FB or 0xF0FC) { sb.Append('✓'); continue; } // ✓
            // Wingdings crosses
            if (cp is 0xF078 or 0xF07B) { sb.Append('✗'); continue; } // ✗
            // Symbol bullet (Wingdings U+F0B7 → •)
            if (cp is 0xF0B7) { sb.Append('•'); continue; } // •
            // Strip remaining Private Use Area chars (U+E000–U+F8FF) - Symbol/Wingdings artifacts
            if (cp is >= 0xE000 and <= 0xF8FF) continue;
            sb.Append(ch);
        }
        return sb.ToString();
    }
}
