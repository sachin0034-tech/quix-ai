import { NextResponse } from "next/server";
import { isTrack } from "@/lib/blueprint";
import { getBlueprint, mulberry32, toPublic, trackBank } from "@/lib/bank";
import { chooseNext } from "@/lib/sampling";
import { bad, readJson } from "@/lib/server/http";

interface Body {
  seed: string;
  track: string;
  domain?: string;
  askedIds: number[];
  answered: { id: number; correct: boolean }[];
  history?: Record<string, { correct: number; total: number }>;
  seen?: Record<number, number>;
}

/** Adaptive next item for sprints and drills. Full mocks and diagnostics never call this. */
export async function POST(req: Request) {
  const b = await readJson<Body>(req);
  if (!b || typeof b.seed !== "string" || !isTrack(b.track)) return bad("Invalid request");
  const next = chooseNext(
    {
      domains: (await getBlueprint())[b.track],
      pool: await trackBank(b.track),
      domain: b.domain,
      askedIds: (b.askedIds ?? []).map(Number),
      answered: b.answered ?? [],
      history: b.history ?? {},
      seen: b.seen ?? {},
      now: Date.now(),
    },
    mulberry32(Date.now() & 0xffffffff)
  );
  return NextResponse.json({ question: next ? toPublic(next, b.seed) : null });
}
