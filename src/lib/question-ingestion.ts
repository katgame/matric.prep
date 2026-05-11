/**
 * Question ingestion model — how PDFs relate to online tests (generic across subjects).
 *
 * ## Why not “just read the PDF”?
 * - Many NSC papers mix text, diagrams, tables, and math fonts; layout is not semantic HTML.
 * - Scanned PDFs have no text until OCR (extra errors).
 * - Automatic “split into questions” from raw text is unreliable without human or AI review.
 *
 * ## Recommended pipeline (production)
 * 1. **Source of truth**: structured questions in your DB (`Paper`, `Question`, types below).
 * 2. **PDF**: stored as the legal reference + optional viewer (“View original question in context”).
 * 3. **Ingestion**:
 *    - **Manual / admin**: paste or import JSON/CSV; attach `sourcePdf` + page/section for traceability.
 *    - **Semi-auto**: `scripts/extract-pdf-text.mjs` → review `.txt`, split by question numbers, map to DB.
 *    - **AI-assist** (optional): send extracted text chunks to an LLM → **draft** questions → **human approves**
 *      before publish (never auto-publish unchecked AI for high-stakes exams).
 *
 * ## Generic for all papers
 * Same shapes: every paper has `QuestionType`, marks, topic tags, and optional media references
 * (cropped diagram image, LaTeX, etc.), independent of subject.
 */

/** How the student answers in the app */
export type QuestionType =
  | "mcq"
  | "numeric"
  | "short_text"
  | "essay"
  | "matching"
  | "multi_select";

/** Traceability back to the official PDF */
export type PdfSourceRef = {
  /** Relative path under repo or object-store key */
  storagePath: string;
  /** 1-based page in the PDF */
  page?: number;
  /** e.g. "SECTION A", "QUESTION 3" */
  sectionLabel?: string;
};

/** Canonical question for APIs and DB (aligns with future EF / JSON columns) */
export type CanonicalQuestion = {
  id: string;
  paperId: string;
  sortOrder: number;
  topic?: string;
  difficulty?: "easy" | "moderate" | "hard";
  type: QuestionType;
  /** Marks as per exam (optional until you import memos) */
  marks?: number;
  /** Stem / prompt; may include LaTeX delimiters for math */
  prompt: string;
  /** MCQ options, pairs for matching, etc. — shape depends on `type` */
  content: unknown;
  /** From memo / marking guideline — may be empty until imported */
  correctAnswer?: unknown;
  explanation?: string;
  /** Link to original PDF context */
  source?: PdfSourceRef;
  /** Diagrams not representable as text */
  attachments?: { url: string; alt: string }[];
};

export type PaperIngestionMeta = {
  subjectId: string;
  sessionLabel: string;
  year: number;
  paperLabel: string;
  /** Original PDF path(s) for this paper */
  pdfFiles?: PdfSourceRef[];
};
