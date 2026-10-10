import type { TrackId } from "@/types/quiz";
import { db } from "@/lib/server/db";

/**
 * Review-mistakes storage (table learner_missed). A learner is identified by their email once given,
 * else by the anonymous session id the browser generates. Every write is best effort so a missing
 * table never blocks the quiz; callers fall back to the browser's own copy when `stored` is false.
 */

export interface Learner {
  sessionId?: string | null;
  email?: string | null;
}

const clean = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().toLowerCase().slice(0, max) : null);

/** Parses the learner object from a request body. */
export function parseLearner(raw: unknown): Learner {
  const o = (raw ?? {}) as Record<string, unknown>;
  return { sessionId: typeof o.sessionId === "string" ? o.sessionId.trim().slice(0, 64) || null : null, email: clean(o.email, 254) };
}

/** Where new rows are written: the email when known, else the session id. */
export const writeKey = (l: Learner): string | null => l.email ?? l.sessionId ?? null;

/** Where rows are read from: both, so rows written before the email was given are still found. */
export const readKeys = (l: Learner): string[] => [...new Set([l.email, l.sessionId].filter((k): k is string => !!k))];

export async function recordOutcomes(learner: Learner, track: TrackId, outcomes: { id: number; correct: boolean }[]): Promise<boolean> {
  const c = db();
  const key = writeKey(learner);
  if (!c || !key || !outcomes.length) return false;
  const now = new Date().toISOString();
  try {
    const wrongIds = outcomes.filter((o) => !o.correct).map((o) => o.id);
    const rightIds = outcomes.filter((o) => o.correct).map((o) => o.id);

    if (wrongIds.length) {
      const existing = await c.from("learner_missed").select("question_id, missed_count").eq("learner_key", key).in("question_id", wrongIds);
      if (existing.error) throw new Error(existing.error.message);
      const counts = new Map((existing.data ?? []).map((r) => [r.question_id as number, r.missed_count as number]));
      const { error } = await c.from("learner_missed").upsert(
        wrongIds.map((id) => ({ learner_key: key, question_id: id, track, missed_count: (counts.get(id) ?? 0) + 1, last_missed_at: now, resolved_at: null })),
        { onConflict: "learner_key,question_id" }
      );
      if (error) throw new Error(error.message);
    }
    if (rightIds.length) {
      // Answering a missed question correctly takes it off the review list
      const { error } = await c.from("learner_missed").update({ resolved_at: now }).in("learner_key", readKeys(learner)).in("question_id", rightIds).is("resolved_at", null);
      if (error) throw new Error(error.message);
    }
    return true;
  } catch (err) {
    console.warn("[missed] could not record:", err instanceof Error ? err.message : err);
    return false;
  }
}

/** Unresolved missed question ids for the learner in a track. `stored` is false when the table is unavailable. */
export async function unresolvedIds(learner: Learner, track: TrackId): Promise<{ stored: boolean; ids: number[] }> {
  const c = db();
  const keys = readKeys(learner);
  if (!c || !keys.length) return { stored: false, ids: [] };
  const { data, error } = await c.from("learner_missed").select("question_id").in("learner_key", keys).eq("track", track).is("resolved_at", null);
  if (error) {
    console.warn("[missed] could not read:", error.message);
    return { stored: false, ids: [] };
  }
  return { stored: true, ids: [...new Set((data ?? []).map((r) => r.question_id as number))] };
}

/** When a learner gives their email, rows kept under the anonymous session id move to the email. */
export async function mergeSessionIntoEmail(sessionId: string, email: string): Promise<void> {
  const c = db();
  if (!c || sessionId === email) return;
  try {
    const { data, error } = await c.from("learner_missed").select("*").eq("learner_key", sessionId);
    if (error || !data?.length) return;
    const { data: mine } = await c.from("learner_missed").select("*").eq("learner_key", email).in("question_id", data.map((r) => r.question_id));
    const byId = new Map((mine ?? []).map((r) => [r.question_id as number, r]));
    const merged = data.map((r) => {
      const other = byId.get(r.question_id);
      const newest = !other || Date.parse(r.last_missed_at) >= Date.parse(other.last_missed_at) ? r : other;
      return {
        learner_key: email,
        question_id: r.question_id,
        track: r.track,
        missed_count: r.missed_count + (other?.missed_count ?? 0),
        last_missed_at: newest.last_missed_at,
        resolved_at: newest.resolved_at,
      };
    });
    const up = await c.from("learner_missed").upsert(merged, { onConflict: "learner_key,question_id" });
    if (!up.error) await c.from("learner_missed").delete().eq("learner_key", sessionId);
  } catch (err) {
    console.warn("[missed] merge failed:", err instanceof Error ? err.message : err);
  }
}
