"use client";

import type { ModeId, PublicQuestion, TrackId } from "@/types/quiz";
import { MODES } from "@/lib/blueprint";
import { track } from "@/lib/analytics";
import { getLearner, getSeen, getSkillHistory, getWrongIds, saveAttempt, type StoredAttempt } from "./store";

export interface StartOptions {
  track: TrackId;
  mode: ModeId;
  domain?: string;
  examConditions?: boolean;
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
        wrongIds: o.mode === "review" ? getWrongIds(o.track) : undefined, // used only if the database list is unavailable
        learner: getLearner(),
        history: MODES[o.mode].adaptive ? getSkillHistory(o.track) : undefined,
        seen: MODES[o.mode].adaptive ? getSeen() : undefined,
      }),
    });
    const data = (await res.json()) as { seed?: string; questions?: PublicQuestion[]; total?: number; adaptive?: boolean; error?: string };
    if (!res.ok || !data.seed || !data.questions) return { error: data.error ?? "Couldn't start. Try again." };

    const minutes = MODES[o.mode].minutes?.(o.track) ?? null;
    const id = crypto.randomUUID();
    const attempt: StoredAttempt = {
      id,
      seed: data.seed,
      track: o.track,
      mode: o.mode,
      domain: o.domain,
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
