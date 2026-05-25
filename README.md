# MatricPrep

An AI-powered exam-practice platform for South African matric learners. Students work through official NSC past papers, get instant feedback on their answers, and receive personalised step-by-step walkthroughs from **Kago** — an AI tutor built on top of OpenAI / Claude.

---

## What the app does

### Subjects and papers
The platform organises content around **subjects** (Mathematics, Physical Sciences, Life Sciences, Accounting, …) and **exam papers** (e.g. Mathematics Paper 1 — May/June 2025). Papers are imported from the official DBE PDF files and stored in a Postgres database.

### Quiz mode (MCQ)
Each paper is broken into individual multiple-choice sub-questions (A–E options). The quiz runs in a **two-pane layout**:

- **Left pane** — the full exam question exactly as it appeared in the paper, with LaTeX maths rendered via KaTeX. Diagrams and tables that can't be extracted from the PDF are linked to the official PDF.
- **Right pane** — one sub-question at a time. The student picks an option and navigates through the question.

Between question groups the student sees a **group summary screen** — a score for that group, their chosen answer vs. the correct answer for every sub-question, and a Kago walkthrough pane on the right that they can open for any incorrect answer.

### Kago AI tutor
Kago provides two kinds of AI assistance:

1. **Walkthrough** (on wrong answers) — a five-stage guided breakdown: *What is this asking → What you need to know → The approach → Step-by-step solution → Final answer & exam tips*. Each stage is revealed one at a time so the student has to think before seeing the next step. TTS (text-to-speech) is available on every stage.
2. **Hint chat** (during the quiz) — a conversational hint panel inside the right pane. Kago gives hints without revealing the answer.

### Results and review
After submitting the quiz the student sees a full results screen with their score and a per-question breakdown. They can jump into a **review mode** that walks through every incorrect question with a full Kago walkthrough and a follow-up chat.

### LaTeX / maths rendering
All maths content is rendered with KaTeX via `remark-math` + `rehype-katex`. The `MathContent` component handles both inline (`$…$`) and display (`$$…$$`) expressions throughout the quiz, options, walkthroughs, and chat replies.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4 |
| Maths rendering | KaTeX, remark-math, rehype-katex |
| Backend API | ASP.NET Core 9, Entity Framework Core |
| Database | PostgreSQL (Docker) |
| AI tutor chat | OpenAI GPT-4o |
| MCQ generation | Claude Haiku / GPT-4o-mini |
| Vision extraction | Claude Opus (PDF → LaTeX) |
| Content pipeline | .NET CLI tool + Node.js scripts |

---

## Getting started

### 1. Frontend (Next.js)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 2. Backend (ASP.NET Core + Postgres)

#### Environment variables

```bash
# Required for tutor chat
setx OPENAI_API_KEY "sk-..."

# Optional — needed only for vision/MCQ pipeline commands
setx ANTHROPIC_API_KEY "sk-ant-..."
```

Restart your terminal after `setx`.

#### Start the API and database

```bash
docker compose up -d --build
```

- API: `http://localhost:8080`
- Postgres: port `5432`

#### Stop

```bash
docker compose down
```

#### API endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/subjects` | List all subjects |
| GET | `/api/papers` | List all papers |
| GET | `/api/papers/{id}` | Single paper with questions |
| POST | `/api/attempts` | Submit quiz answers |
| POST | `/api/papers/{id}/questions/{qId}/tutor-chat` | Kago chat message |
| POST | `/api/papers/{id}/questions/{qId}/breakdown` | Kago full walkthrough |
| POST | `/api/ingestion/papers` | Import a paper from JSON |

---

## Content pipeline

Getting PDF exam papers into the database is a multi-step process:

```
DBE website → download PDFs → extract text → LLM generates questions → import to DB
```

### Step 0 — Scaffold the folder structure

Creates the `exam-papers/<session>/languages/` and `non-languages/` directories:

```bash
node scripts/scaffold-exam-papers.mjs
node scripts/scaffold-exam-papers.mjs --session 2024-november --root ./exam-papers
```

### Step 1 — Download NSC exam papers

Downloads every paper and memorandum from the official DBE listing page and saves them under `exam-papers/<session>/<languages|non-languages>/<subject>/`.

```bash
# Download 2025 May/June papers (default)
node scripts/download-nsc-papers.mjs

# Different session
node scripts/download-nsc-papers.mjs --session 2024-may-june \
  --url "https://www.education.gov.za/.../2024MayJuneExamPapers.aspx"

# Dry run (list files without downloading)
node scripts/download-nsc-papers.mjs --dry-run --limit 10

# Save to a custom folder
node scripts/download-nsc-papers.mjs --out ./my-papers

# All files flat in one folder (no session/subject tree)
node scripts/download-nsc-papers.mjs --flat

# Slow down requests to be polite to the server
node scripts/download-nsc-papers.mjs --delay-ms 1000
```

PDFs are gitignored — only the folder skeleton and `manifest.json` are committed.

### Step 2 — (Optional) Inspect PDF text

Useful for checking whether a PDF has a proper text layer before running the pipeline. Image-only (scanned) PDFs will return empty or garbled text and need the `vision` command instead.

```bash
# Print text to stdout
node scripts/extract-pdf-text.mjs "exam-papers/2025-may-june/non-languages/mathematics/Mathematics P1.pdf"

# Specific pages only
node scripts/extract-pdf-text.mjs ./paper.pdf --pages 1-5

# Write to a file
node scripts/extract-pdf-text.mjs ./paper.pdf --out paper.txt
```

### Step 3 — Run the .NET pipeline

The pipeline CLI lives in `server/MatricPrep.Pipeline`. Run it from the repo root:

```bash
dotnet run --project server/MatricPrep.Pipeline -- <command> [flags]
```

---

#### `extract` — Pull text out of a PDF pair

Reads the paper PDF and its memorandum, extracts the text layer, and writes an **extract bundle** (JSON) used by the next step.

```bash
# By session/subject (auto-resolves paths from exam-papers/)
dotnet run --project server/MatricPrep.Pipeline -- extract \
  --session 2025-may-june \
  --subject mathematics \
  --paper 1 \
  --out paper.extract.json

# Explicit PDF paths
dotnet run --project server/MatricPrep.Pipeline -- extract \
  --paper-pdf "exam-papers/2025-may-june/non-languages/mathematics/Mathematics P1.pdf" \
  --memo-pdf  "exam-papers/2025-may-june/non-languages/mathematics/Mathematics P1 Memo.pdf" \
  --session 2025-may-june --subject mathematics --paper 1 \
  --out paper.extract.json
```

---

#### `generate` — Convert extract bundle to importable JSON (text-layer PDFs)

Uses an LLM to parse the extracted text into structured questions with memo answers. The default LLM is a **local Ollama** instance (free, no API key). Switch to OpenAI if you don't have Ollama.

```bash
# Local Ollama (default — install from https://ollama.com, then: ollama pull llama3.2)
dotnet run --project server/MatricPrep.Pipeline -- generate \
  --extract paper.extract.json \
  --out paper.import.json

# OpenAI
dotnet run --project server/MatricPrep.Pipeline -- generate \
  --extract paper.extract.json \
  --provider openai \
  --out paper.import.json

# Skip the LLM entirely — deterministic parser only (fast, no API key needed)
dotnet run --project server/MatricPrep.Pipeline -- generate \
  --extract paper.extract.json \
  --deterministic \
  --out paper.import.json
```

---

#### `vision` — Extract questions from image/scanned PDFs using Claude

For PDFs where the text layer is missing or broken (common with NSC maths papers), this command sends each page to Claude's vision API and gets back LaTeX-formatted questions.

```bash
dotnet run --project server/MatricPrep.Pipeline -- vision \
  --extract paper.extract.json \
  --api-key "$env:ANTHROPIC_API_KEY" \
  --out paper.import.json

# Override the PDF path if the bundle path doesn't match your local layout
dotnet run --project server/MatricPrep.Pipeline -- vision \
  --extract paper.extract.json \
  --paper-pdf "C:\Downloads\Maths P1.pdf" \
  --out paper.import.json
```

The output `paper.import.json` will have prompts prefixed with `[latex]\n` — the frontend renders these with KaTeX.

---

#### `mcq` — Generate multiple-choice options from LaTeX questions

Takes a `paper.import.json` produced by the `vision` command and calls an LLM to split each question into per-sub-question MCQs (A–E), with one correct answer and four plausible distractors.

```bash
# Using Claude (Anthropic)
dotnet run --project server/MatricPrep.Pipeline -- mcq \
  --import paper.import.json \
  --provider anthropic \
  --api-key "$env:ANTHROPIC_API_KEY" \
  --out paper.import.mcq.json

# Using OpenAI
dotnet run --project server/MatricPrep.Pipeline -- mcq \
  --import paper.import.json \
  --provider openai \
  --out paper.import.mcq.json
```

The output adds a `"group"` parent question for each original question (the full question text shown in the left pane) and individual `"mcq"` child questions (shown one at a time in the right pane).

---

#### `import` — POST the JSON to the running API

```bash
dotnet run --project server/MatricPrep.Pipeline -- import \
  --file paper.import.mcq.json \
  --api http://localhost:8080
```

---

#### `run` — Extract + generate + import in one command

Convenience wrapper that runs `extract → generate → import` in sequence.

```bash
dotnet run --project server/MatricPrep.Pipeline -- run \
  --session 2025-may-june \
  --subject accounting \
  --paper 1 \
  --provider openai \
  --api http://localhost:8080
```

---

#### `batch` — Import all non-language papers at once

Processes every paper+memo pair found under `exam-papers/<session>/non-languages/` in parallel using the deterministic parser (no LLM). Good for bulk-loading all subjects quickly.

```bash
dotnet run --project server/MatricPrep.Pipeline -- batch \
  --session 2025-may-june \
  --api http://localhost:8080

# Limit to one subject
dotnet run --project server/MatricPrep.Pipeline -- batch \
  --session 2025-may-june \
  --subject accounting \
  --workers 8

# Enqueue server-side jobs instead of posting directly
dotnet run --project server/MatricPrep.Pipeline -- batch \
  --session 2025-may-june \
  --mode enqueue
```

---

### Full maths pipeline example (text-layer PDF)

```bash
# 1. Download papers
node scripts/download-nsc-papers.mjs --session 2025-may-june

# 2. Extract text from the PDF
dotnet run --project server/MatricPrep.Pipeline -- extract \
  --session 2025-may-june --subject mathematics --paper 1 \
  --out maths-p1.extract.json

# 3. Vision extraction (LaTeX) — needed for maths PDFs
dotnet run --project server/MatricPrep.Pipeline -- vision \
  --extract maths-p1.extract.json \
  --out maths-p1.import.json

# 4. Generate MCQ options
dotnet run --project server/MatricPrep.Pipeline -- mcq \
  --import maths-p1.import.json \
  --provider openai \
  --out maths-p1.mcq.json

# 5. Import into the running API
dotnet run --project server/MatricPrep.Pipeline -- import \
  --file maths-p1.mcq.json \
  --api http://localhost:8080
```

### Full text-based subjects pipeline example (Accounting, Life Sciences, …)

```bash
# One command — extract + deterministic parse + import
dotnet run --project server/MatricPrep.Pipeline -- run \
  --session 2025-may-june \
  --subject accounting \
  --paper 1 \
  --deterministic \
  --api http://localhost:8080
```

---

## Project structure

```
matricApp/
├── src/                        # Next.js frontend
│   ├── app/                    # App Router pages
│   │   ├── subjects/           # Subject listing
│   │   ├── papers/[paperId]/   # Paper detail / PDF viewer
│   │   ├── tutor/[paperId]/    # MCQ quiz + Kago tutor
│   │   └── test/[paperId]/     # Timed exam mode
│   ├── components/
│   │   ├── tutor-runner.tsx    # Quiz, group summary, review phases
│   │   ├── exam-question-prompt.tsx  # Question display with LaTeX
│   │   ├── math-content.tsx    # KaTeX renderer
│   │   └── ...
│   └── lib/
│       ├── api.ts              # API client
│       ├── types.ts            # Shared types
│       └── tts.ts              # Web Speech API hook
├── server/
│   ├── MatricPrep.Api/         # ASP.NET Core REST API
│   └── MatricPrep.Pipeline/    # CLI import pipeline
│       ├── Program.cs          # Commands: extract, generate, vision, mcq, import, run, batch
│       ├── McqGenerator.cs     # MCQ generation (Claude / OpenAI)
│       └── VisionQuestionExtractor.cs  # PDF → LaTeX via Claude vision
├── scripts/
│   ├── download-nsc-papers.mjs   # Download PDFs from DBE website
│   ├── extract-pdf-text.mjs      # Inspect PDF text layer
│   └── scaffold-exam-papers.mjs  # Create folder structure
├── exam-papers/                # Downloaded PDFs (gitignored) + manifest.json
├── paper.import.*.json         # Imported paper data (source of truth for questions)
└── docker-compose.yml          # Postgres + API
```

---

## Notes

- **Image-only PDFs** (scanned pages with no text layer) must go through the `vision` command — the `extract` and `generate` commands work on the embedded text layer only.
- **DBE copyright** — exam papers are published for educational use. Use downloaded files for personal or licensed project use only.
- The `exam-papers/` PDF files are gitignored. Only the `paper.import.*.json` files (structured question data) are committed.
