import type { OptionLabel } from "@/types/quiz";

const LABELS: OptionLabel[] = ["A", "B", "C", "D"];

/**
 * Parse a stored answer into sorted option labels.
 * Accepts single answers ("B") and multi answers in any of "A,C", "A, C" or "AC".
 */
export function parseAnswer(raw: string | null | undefined): OptionLabel[] {
  const found = new Set((raw ?? "").toUpperCase().match(/[ABCD]/g) ?? []);
  return LABELS.filter((l) => found.has(l));
}

/** Canonical stored form: sorted labels joined with commas, e.g. "A,C". */
export function formatAnswer(labels: readonly string[]): string {
  return parseAnswer(labels.join("")).join(",");
}

/** Number of options the learner must pick for a question ("Select N"). */
export function requiredPicks(answer: string): number {
  return Math.max(1, parseAnswer(answer).length);
}

/** Multiple-response items are scored all-or-nothing: the picks must equal the key exactly. */
export function isCorrectAnswer(user: readonly string[] | string, correct: string): boolean {
  const u = typeof user === "string" ? parseAnswer(user) : parseAnswer(user.join(""));
  const c = parseAnswer(correct);
  return u.length === c.length && u.every((l, i) => l === c[i]);
}
