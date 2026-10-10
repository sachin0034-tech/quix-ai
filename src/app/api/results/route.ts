import { NextResponse } from "next/server";
import { bad, readJson } from "@/lib/server/http";
import { resultFromRequest, type ResultRequest } from "@/lib/server/attempt";
import { parseLearner, recordOutcomes } from "@/lib/server/missed";

export async function POST(req: Request) {
  const body = await readJson<ResultRequest & { learner?: unknown; record?: boolean }>(req);
  const result = body && (await resultFromRequest(body));
  if (!result || !body) return bad("Invalid attempt");

  // Exam-conditions attempts are not checked question by question, so their outcomes are recorded here, once
  if (body.record) {
    const missed = new Set(result.missed.map((m) => m.id));
    await recordOutcomes(
      parseLearner(body.learner),
      result.track,
      (body.questionIds ?? []).map((id) => ({ id: Number(id), correct: !missed.has(Number(id)) }))
    );
  }
  return NextResponse.json({ result });
}
