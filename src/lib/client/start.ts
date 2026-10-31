"use client";

import type { ModeId, PublicQuestion, TrackId } from "@/types/quiz";
import { MODES } from "@/lib/blueprint";
import { track } from "@/lib/analytics";
import { getLearner, getSeen, getSkillHistory, getWrongIds, saveAttempt, type StoredAttempt } from "./store";

export interface StartOptions {
  track: TrackId;
  mode: ModeId;
  domain?: string;
  /** Practice by module: the module name */
  module?: string;
  examConditions?: boolean;
  /** Developer exams: the level (1, 2 or 3) */
  level?: number;
  /** Developer full mock: chosen question count and total minutes */
  questionCount?: number;
  minutes?: number;
  /** Practice by module: seconds per question, or null for no timer */
  questionSeconds?: number | null;
}

/** Creates a Developer Full Mock attempt from the course-module bank. */
export async function startDevFullMock(o: { questionCount: number; timerMinutes: number; level?: number }): Promise<{ id: string } | { error: string }> {
  try {
    const res = await fetch("/api/dev-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "full", level: o.level ?? 1, questionCount: o.questionCount, timerMinutes: o.timerMinutes }),
    });
    const data = (await res.json()) as { seed?: string; questions?: PublicQuestion[]; total?: number; minutes?: number; error?: string };
    if (!res.ok || !data.seed || !data.questions) return { error: data.error ?? "Couldn't start. Try again." };

    const id = crypto.randomUUID();
    const attempt: StoredAttempt = {
      id,
      seed: data.seed,
      track: "developer",
      mode: "full",
      level: o.level ?? 1,
      questionCount: o.questionCount,
      examConditions: false,
      startedAt: Date.now(),
      limitSeconds: (data.minutes ?? o.timerMinutes) * 60,
      total: data.total ?? data.questions.length,
      adaptive: false,
      questions: data.questions,
      answers: {},
      checks: {},
      idx: 0,
    };
    saveAttempt(attempt);
    track("track_selected", { track: "developer" });
    return { id };
  } catch {
    return { error: "Couldn't reach the server. Check your connection and try again." };
  }
}

/** Creates an attempt on the server (questions without keys) and stores it locally. Returns its id. */
export async function startAttempt(o: StartOptions): Promise<{ id: string } | { error: string }> {
  try {
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        track: o.track,
        mode: o.mode,
        domain: o.domain,
        module: o.module,
        level: o.level,
        questionCount: o.questionCount,
        minutes: o.minutes,
        wrongIds: o.mode === "review" ? getWrongIds(o.track) : undefined, // used only if the database list is unavailable
        learner: getLearner(),
        history: MODES[o.mode].adaptive ? getSkillHistory(o.track) : undefined,
        seen: MODES[o.mode].adaptive || o.mode === "module" ? getSeen() : undefined, // module quizzes prefer questions not seen yet
      }),
    });
    const data = (await res.json()) as { seed?: string; questions?: PublicQuestion[]; total?: number; minutes?: number; adaptive?: boolean; error?: string };
    if (!res.ok || !data.seed || !data.questions) return { error: data.error ?? "Couldn't start. Try again." };

    const minutes = data.minutes ?? MODES[o.mode].minutes?.(o.track) ?? null;
    const id = crypto.randomUUID();
    const attempt: StoredAttempt = {
      id,
      seed: data.seed,
      track: o.track,
      mode: o.mode,
      domain: o.domain,
      module: o.module,
      level: o.level,
      questionCount: o.questionCount,
      questionSeconds: o.mode === "module" ? o.questionSeconds : undefined,
      examConditions: !!o.examConditions && o.mode === "full",
      startedAt: Date.now(),
      limitSeconds: minutes ? minutes * 60 : null,
      total: data.total ?? data.questions.length,
      adaptive: !!data.adaptive,
      questions: data.questions,
      answers: {},
      checks: {},
      idx: 0,
    };
    saveAttempt(attempt);
    track("track_selected", { track: o.track });
    return { id };
  } catch {
    return { error: "Couldn't reach the server. Check your connection and try again." };
  }
}
