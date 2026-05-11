/** Matches subject card styles in `globals.css` / subject pages. */
export const SUBJECT_ACCENTS: Record<string, string> = {
  maths: "subject-accent-maths",
  "physical-science": "subject-accent-physical",
  "life-sciences": "subject-accent-life",
  accounting: "subject-accent-accounting",
};

export function subjectAccentClass(subjectId: string): string {
  return SUBJECT_ACCENTS[subjectId] ?? "";
}
