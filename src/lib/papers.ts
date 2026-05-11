import type { PastPaper, SubjectId, SubjectSummary } from "./types";
import { subjectAccentClass } from "./subject-accents";

/** Offline snapshot when the API is unavailable — no embedded mock papers. */
const papers: PastPaper[] = [];

const subjectStubs: { id: SubjectId; label: string; description: string }[] = [
  {
    id: "maths",
    label: "Mathematics",
    description: "Past papers and practice for Mathematics.",
  },
  {
    id: "physical-science",
    label: "Physical Sciences",
    description: "Past papers and practice for Physical Sciences.",
  },
  {
    id: "life-sciences",
    label: "Life Sciences",
    description: "Past papers and practice for Life Sciences.",
  },
  {
    id: "accounting",
    label: "Accounting",
    description: "Past papers and practice for Accounting.",
  },
];

export function listPapers(): PastPaper[] {
  return papers;
}

export function getPaper(id: string): PastPaper | undefined {
  return papers.find((p) => p.id === id);
}

export function listSubjects(): SubjectSummary[] {
  return subjectStubs.map((s) => ({
    ...s,
    paperCount: papers.filter((p) => p.subjectId === s.id).length,
    accentClass: subjectAccentClass(s.id),
  }));
}
