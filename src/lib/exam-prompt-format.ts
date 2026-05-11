/**
 * The ingestion fallback packs exam text into one string:
 * "Topic: …. Sub-questions: …. Paper section excerpt: …"
 * This parser splits it for learner-friendly UI.
 */

import { stripMemoFooter } from "@/lib/memo-format";

/**
 * Insert blank lines before NSC-style sub-questions (2.1, 2.2, …) when they are
 * packed on one line after mark allocations (12) or between sentences.
 */
export function insertSubQuestionSpacing(text: string): string {
  const t = text.trim();
  if (!t) return text;

  // (12) 2.2 Calculate … — DBE layout often omits a line break here
  let out = t.replace(/\(\d+\)\s+(?=([1-9]\d?\.\d{1,2})(?:\s|[•]|$))/g, (full) => {
    const marks = full.match(/^\(\d+\)/)?.[0] ?? "";
    const after = full.slice(marks.length).trimStart();
    return `${marks}\n\n${after}`;
  });

  // …year. 2.5 According … — sentence end then next sub-question (not after ")"; those use rule above)
  out = out.replace(/([^)\s\n])\s+([1-9]\d?\.\d{1,2})\s+(?=[A-Z(•])/g, "$1\n\n$2 ");

  return out;
}
export type ParsedDeterministicPrompt = {
  kind: "structured";
  topic?: string;
  subQuestionRefs: string[];
  excerpt: string;
  hadTruncationMarker: boolean;
};

export type ParsedPrompt = ParsedDeterministicPrompt | { kind: "plain"; text: string };

export function parseExamPrompt(prompt: string): ParsedPrompt {
  const hadTruncationMarker = /\[[^\]]*truncated[^\]]*\]/i.test(prompt);
  const withoutTruncMarker = prompt.replace(/\[[^\]]*truncated[^\]]*\]/gi, "").trim();

  const withSub = /^Topic:\s*(.+?)\.\s+Sub-questions:\s*(.+?)\.\s+Paper section excerpt:\s*([\s\S]+)$/im.exec(
    withoutTruncMarker,
  );
  if (withSub) {
    const topic = withSub[1]?.trim();
    const subQuestionRefs = (withSub[2] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const excerpt = (withSub[3] ?? "").trim();
    return { kind: "structured", topic, subQuestionRefs, excerpt, hadTruncationMarker };
  }

  const noSub = /^Topic:\s*(.+?)\.\s+Paper section excerpt:\s*([\s\S]+)$/im.exec(withoutTruncMarker);
  if (noSub) {
    const topic = noSub[1]?.trim();
    const excerpt = (noSub[2] ?? "").trim();
    return {
      kind: "structured",
      topic,
      subQuestionRefs: [],
      excerpt,
      hadTruncationMarker,
    };
  }

  return { kind: "plain", text: prompt.trim() };
}

export type ExcerptSection = {
  key: "scenario" | "required" | "information" | "note" | "questionHeading" | "other";
  title: string;
  body: string;
};

/**
 * Splits the raw excerpt into labelled blocks when standard NSC markers exist.
 */
export function splitExcerptIntoSections(excerpt: string): ExcerptSection[] {
  const footer = stripMemoFooter(excerpt.trim());
  const text = insertSubQuestionSpacing(footer.text);
  if (!text) return [];

  const markerRe = /\b(QUESTION\s+\d+\s*:|REQUIRED\s*:|INFORMATION\s*:|NOTE\s*:)/gi;
  const matches = [...text.matchAll(markerRe)];

  if (matches.length === 0) {
    return [{ key: "other", title: "From the question paper", body: text }];
  }

  const sections: ExcerptSection[] = [];

  const firstIdx = matches[0].index ?? 0;
  const intro = text.slice(0, firstIdx).trim();
  if (intro) {
    sections.push({ key: "scenario", title: "Scenario", body: intro });
  }

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const labelFull = m[0];
    const startContent = (m.index ?? 0) + labelFull.length;
    const endContent = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    const body = text.slice(startContent, endContent).trim();

    const upper = labelFull.toUpperCase();
    let key: ExcerptSection["key"] = "other";
    let title = labelFull.replace(/\s*:\s*$/, "").trim();

    if (upper.includes("QUESTION")) {
      key = "questionHeading";
    } else if (upper.includes("REQUIRED")) {
      key = "required";
      title = "Required";
    } else if (upper.includes("INFORMATION")) {
      key = "information";
      title = "Information";
    } else if (upper.includes("NOTE")) {
      key = "note";
      title = "Note";
    }

    if (body) {
      sections.push({ key, title, body });
    }
  }

  return sections;
}
