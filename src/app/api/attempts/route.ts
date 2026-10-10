import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/server/db";
import { bad, readJson } from "@/lib/server/http";
import { resultFromRequest, type ResultRequest } from "@/lib/server/attempt";
import type { StudyPlan } from "@/lib/study-plan";

/**
 * Persists a finished attempt and returns a private report URL. The unguessable id is the access
 * control, and it is what the advisor sees in the booking.
 */
export async function POST(req: Request) {
  const body = await readJson<{ request: ResultRequest; email?: string | null; name?: string | null; examDate?: string | null; plan?: StudyPlan | null }>(req);
  const result = body && (await resultFromRequest(body.request));
  if (!body || !result) return bad("Invalid attempt");

  const id = randomUUID();
  const origin = new URL(req.url).origin;
  const reportUrl = `${origin}/report/${id}`;
  const c = db();
  let stored = false;
  if (c) {
    const { error } = await c.from("quiz_attempts").insert({
      id,
      email: body.email?.trim().toLowerCase() || null,
      name: body.name?.slice(0, 120) || null,
      exam_date: body.examDate || null,
      track: result.track,
      mode: result.mode,
      correct: result.correct,
      total: result.total,
      readiness: result.readiness,
      result,
      plan: body.plan ?? null,
    });
    if (error) console.warn(`[attempts] insert failed: ${error.message}`);
    else stored = true;
  }
  return NextResponse.json({ id, reportUrl, stored });
}
