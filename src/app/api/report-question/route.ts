import { NextResponse } from "next/server";
import { getQuestion } from "@/lib/bank";
import { safeInsert } from "@/lib/server/db";
import { bad, readJson } from "@/lib/server/http";

/** "Report this question": sends the item to human review (take-down within 48h per the PRD). */
export async function POST(req: Request) {
  const b = await readJson<{ questionId: number; reason?: string; email?: string }>(req);
  const q = b && (await getQuestion(Number(b.questionId)));
  if (!b || !q) return bad("Unknown question");
  await safeInsert("reported_questions", {
    question_id: q.id,
    track: q.track,
    reason: (b.reason ?? "").slice(0, 1000),
    email: b.email?.slice(0, 254) ?? null,
    status: "open",
  });
  console.info(`[report] question ${q.id} reported`);
  return NextResponse.json({ ok: true });
}
