import { NextResponse } from "next/server";
import { isTrack } from "@/lib/blueprint";
import { bad, readJson } from "@/lib/server/http";
import { parseLearner, unresolvedIds } from "@/lib/server/missed";

/** How many questions are on the learner's review list (the Review mistakes card). */
export async function POST(req: Request) {
  const b = await readJson<{ track: string; learner?: unknown }>(req);
  if (!b || !isTrack(b.track)) return bad("Invalid request");
  const { stored, ids } = await unresolvedIds(parseLearner(b.learner), b.track);
  return NextResponse.json({ stored, count: ids.length });
}
