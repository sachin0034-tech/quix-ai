import type { AttemptAnswer, BankQuestion, OptionLabel, Resource } from "@/types/quiz";
import { displayKeys, getBank, getBlueprint, getModuleQuizzes, presentOptions } from "@/lib/bank";
import { parseAnswer } from "@/lib/answers";
import { computeResult } from "@/lib/scoring";
import { isTrack } from "@/lib/blueprint";
import type { ModeId, ResultSummary, TrackId } from "@/types/quiz";

export function explanationFor(q: BankQuestion): string {
  if (q.explanation) return q.explanation;
  const keys = parseAnswer(q.answer);
  const texts = keys.map((k) => q.options.find((o) => o.label === k)?.text).filter(Boolean);
  return `The correct ${keys.length > 1 ? "answers are" : "answer is"}: ${texts.join("; ")}.`;
}

const LABELS = new Set(["A", "B", "C", "D", "E"]);

export function cleanPicks(raw: unknown): OptionLabel[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((l): l is OptionLabel => typeof l === "string" && LABELS.has(l)))].sort() as OptionLabel[];
}

export interface ResultRequest {
  seed: string;
  track: string;
  mode: ModeId;
  domain?: string;
  /** Practice by module: the module (course) name, so missed questions link to the lesson of that module */
  module?: string;
  questionIds: number[];
  /** Module quiz questions whose clock the learner paused: a right answer earns half a point */
  pausedIds?: number[];
  /** Module quiz questions answered again after their time ran out: they earn no points */
  reattemptIds?: number[];
  answers: { id: number; picks: unknown; ms: number }[];
  totalSeconds: number;
}

/** Recompute a full result from raw answers. The server never trusts a client-supplied score. */
export async function resultFromRequest(body: ResultRequest): Promise<ResultSummary | null> {
  if (!body || typeof body.seed !== "string" || !isTrack(body.track)) return null;
  const bank = await getBank();
  const byId = new Map(bank.map((q) => [q.id, q]));
  const asked = (body.questionIds ?? []).map((id) => byId.get(Number(id))).filter((q): q is BankQuestion => !!q && q.track === body.track);
  if (!asked.length) return null;
  const paused = new Set(body.mode === "module" ? (body.pausedIds ?? []).map(Number) : []);
  const answers: AttemptAnswer[] = (body.answers ?? [])
    .filter((a) => asked.some((q) => q.id === a.id))
    .map((a) => ({ id: a.id, picks: cleanPicks(a.picks), ms: Math.max(0, Math.min(Number(a.ms) || 0, 3_600_000)) }))
    .filter((a) => a.picks.length > 0);
  // In a module quiz, a missed question links to the lesson of that module it belongs to
  const moduleQuiz = typeof body.module === "string" ? (await getModuleQuizzes())[body.track as TrackId].find((m) => m.name === body.module) : undefined;
  const lessonLink = new Map<number, Resource>();
  for (const l of moduleQuiz?.lessons ?? []) for (const q of l.questions) if (!lessonLink.has(q.id)) lessonLink.set(q.id, l.link);
  return computeResult({
    track: body.track as TrackId,
    domains: (await getBlueprint())[body.track as TrackId],
    mode: body.mode,
    domainFilter: body.domain,
    asked,
    answers,
    keysFor: (q) => displayKeys(q, body.seed),
    optionsFor: (q) => presentOptions(q, body.seed),
    explain: explanationFor,
    resourcesFor: (q) => (lessonLink.has(q.id) ? [lessonLink.get(q.id) as Resource] : (q.resources ?? [])),
    totalSeconds: Math.max(0, Math.round(Number(body.totalSeconds) || 0)),
    pausedIds: paused,
    reattemptIds: new Set(body.mode === "module" ? (body.reattemptIds ?? []).map(Number) : []),
  });
}
