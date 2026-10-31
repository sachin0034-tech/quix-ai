import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { FULL_MOCK_MAX_MINUTES, FULL_MOCK_MAX_QUESTIONS, FULL_MOCK_MIN_MINUTES, FULL_MOCK_MIN_QUESTIONS, MODES, TRACKS, isLevelOpen, isTrack } from "@/lib/blueprint";
import { allTrackBank, getBlueprint, getLevel, getModuleQuizzes, mulberry32, toPublic, trackBank } from "@/lib/bank";
import { buildDemo, buildDiagnostic, buildFullMock, buildModulePractice, buildReview, chooseNext } from "@/lib/sampling";
import { bad, readJson } from "@/lib/server/http";
import { parseLearner, unresolvedIds } from "@/lib/server/missed";
import type { ModeId, ModuleQuiz } from "@/types/quiz";

interface Body {
  track: string;
  mode: ModeId;
  domain?: string;
  /** Practice by module: the module (Skill Jar course) name */
  module?: string;
  /** Developer exams: the level (see OPEN_LEVELS in blueprint) */
  level?: number;
  /** Full mock: how many questions, and the total time in minutes */
  questionCount?: number;
  minutes?: number;
  wrongIds?: number[];
  learner?: unknown;
  history?: Record<string, { correct: number; total: number }>;
  seen?: Record<number, number>;
}

/** Starts an attempt: returns the question set (no keys) or, for adaptive modes, the first item. */
export async function POST(req: Request) {
  const body = await readJson<Body>(req);
  if (!body || !isTrack(body.track) || !(body.mode in MODES)) return bad("Invalid session request");
  const track = body.track;
  const mode = MODES[body.mode];
  const pool = await trackBank(track);
  const domains = (await getBlueprint())[track];
  const seed = randomUUID();
  const rng = mulberry32(parseInt(seed.slice(0, 8), 16));

  const level = body.level ?? 1;
  if ((body.mode === "full" || body.mode === "module") && track === "developer" && !isLevelOpen(level)) return bad(`Level ${level} is locked`, 403);
  // A full mock the learner configured: whole numbers inside the limits, and never more questions than the bank holds
  const custom = body.mode === "full" && track === "developer" && body.questionCount !== undefined;
  const count = Number(body.questionCount);
  const minutes = Number(body.minutes);
  if (custom) {
    if (!Number.isInteger(count) || count < Math.min(FULL_MOCK_MIN_QUESTIONS, pool.length) || count > Math.min(FULL_MOCK_MAX_QUESTIONS, pool.length)) return bad("Choose a valid number of questions");
    if (!Number.isInteger(minutes) || minutes < FULL_MOCK_MIN_MINUTES || minutes > FULL_MOCK_MAX_MINUTES) return bad("Choose a valid time limit");
  }

  if ((body.mode === "drill" || body.mode === "demo") && !domains.some((d) => d.name === body.domain)) return bad("Choose a domain");
  const moduleQuizzesOfLevel = track === "developer" && level > 1 ? (await getLevel(level)).quizzes : (await getModuleQuizzes())[track];
  const moduleQuiz = body.mode === "module" ? moduleQuizzesOfLevel.find((m) => m.name === body.module) : undefined;
  if (body.mode === "module" && !moduleQuiz) return bad("Choose a module");

  if (mode.adaptive) {
    const total = body.mode === "drill" ? Math.min(20, pool.filter((q) => q.domain === body.domain).length) : Math.min(10, pool.length);
    const first = chooseNext(
      { domains, pool, domain: body.domain, askedIds: [], answered: [], history: body.history ?? {}, seen: body.seen ?? {}, now: Date.now() },
      rng
    );
    if (!first) return bad("No questions available", 404);
    return NextResponse.json({ seed, adaptive: true, total, questions: [toPublic(first, seed)] });
  }

  let items;
  if (body.mode === "module") items = buildModulePractice(moduleQuiz as ModuleQuiz, rng, undefined, body.seen ?? {});
  else if (body.mode === "demo") items = buildDemo(pool, body.domain as string);
  else if (body.mode === "full") items = buildFullMock(track, domains, pool, rng, custom ? count : TRACKS[track].items);
  else if (body.mode === "diagnostic") items = buildDiagnostic(domains, pool, rng);
  else {
    // Review mistakes: the learner's unresolved misses from the database, else the list the browser kept
    const stored = await unresolvedIds(parseLearner(body.learner), track);
    items = buildReview(await allTrackBank(track), stored.stored ? stored.ids : (body.wrongIds ?? []).map(Number), rng);
  }
  if (!items.length) return bad(body.mode === "review" ? "No missed questions to review yet" : body.mode === "demo" ? "No demo is set up for this domain yet" : "No questions available", 404);

  return NextResponse.json({ seed, adaptive: false, total: items.length, minutes: custom ? minutes : undefined, questions: items.map((q) => toPublic(q, seed)) });
}
