import { NextResponse } from "next/server";
import { displayKeys, getQuestion } from "@/lib/bank";
import { isCorrectAnswer } from "@/lib/answers";
import { bad, readJson } from "@/lib/server/http";
import { cleanPicks, explanationFor } from "@/lib/server/attempt";
import { parseLearner, recordOutcomes } from "@/lib/server/missed";
import type { CheckResult } from "@/types/quiz";

/** Instant feedback: the key and explanation only leave the server after the learner has answered. */
export async function POST(req: Request) {
  const b = await readJson<{ seed: string; id: number; picks: unknown; learner?: unknown }>(req);
  if (!b || typeof b.seed !== "string") return bad("Invalid request");
  const q = await getQuestion(Number(b.id));
  if (!q) return bad("Unknown question", 404);
  const picks = cleanPicks(b.picks);
  const keys = displayKeys(q, b.seed);
  if (picks.length !== keys.length) return bad(`Select ${keys.length}`);
  const out: CheckResult = {
    correct: isCorrectAnswer(picks, keys.join(",")),
    keys,
    explanation: explanationFor(q),
  };
  // Wrong answers join the learner's review list; a later correct answer takes the item off it
  await recordOutcomes(parseLearner(b.learner), q.track, [{ id: q.id, correct: out.correct }]);
  return NextResponse.json(out);
}
