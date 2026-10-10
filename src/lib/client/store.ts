"use client";

import type { CheckResult, ModeId, OptionLabel, PublicQuestion, TrackId } from "@/types/quiz";
import type { SkillHistory } from "@/lib/sampling";

/** Everything the browser remembers. Each read is guarded: storage can be blocked or empty. */

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the attempt still works in memory */
  }
}

// ── Attempts (resume on refresh) ─────────────────────────────────────────

export interface StoredAnswer {
  picks: OptionLabel[];
  ms: number;
}

export interface StoredAttempt {
  id: string;
  seed: string;
  track: TrackId;
  mode: ModeId;
  domain?: string;
  examConditions: boolean;
  startedAt: number;
  /** null = untimed */
  limitSeconds: number | null;
  total: number;
  adaptive: boolean;
  questions: PublicQuestion[];
  answers: Record<number, StoredAnswer>;
  checks: Record<number, CheckResult>;
  idx: number;
  finishedAt?: number;
  /** Set once an exam-conditions attempt's outcomes have been saved to the review list */
  recordedAt?: number;
}

const attemptKey = (id: string) => `quix_attempt_${id}`;
export const getAttempt = (id: string) => read<StoredAttempt | null>(attemptKey(id), null);
export const saveAttempt = (a: StoredAttempt) => write(attemptKey(a.id), a);

// ── Learning history ─────────────────────────────────────────────────────

export interface HistoryEntry {
  id: string;
  mode: ModeId;
  readiness: number | null;
  pct: number;
  at: number;
}
type HistoryMap = Partial<Record<TrackId, HistoryEntry[]>>;

export const getHistory = (track: TrackId): HistoryEntry[] => read<HistoryMap>("quix_history", {})[track] ?? [];

export function addHistory(track: TrackId, entry: HistoryEntry): void {
  const all = read<HistoryMap>("quix_history", {});
  const list = all[track] ?? [];
  if (list.some((e) => e.id === entry.id)) return; // idempotent per attempt
  all[track] = [...list, entry].slice(-50);
  write("quix_history", all);
}

/** Readiness of each full mock, oldest to newest (for the "ready" rule). */
export const fullMockReadiness = (track: TrackId): number[] =>
  getHistory(track).filter((h) => h.mode === "full" && h.readiness !== null).map((h) => h.readiness as number);

// ── Per-question memory: seen (7-day rule), wrong (review mode), skill accuracy ──

export const getSeen = () => read<Record<number, number>>("quix_seen", {});
const getWrong = () => read<Partial<Record<TrackId, number[]>>>("quix_wrong", {});
export const getWrongIds = (track: TrackId): number[] => getWrong()[track] ?? [];
const getSkills = () => read<Partial<Record<TrackId, SkillHistory>>>("quix_skills", {});
export const getSkillHistory = (track: TrackId): SkillHistory => getSkills()[track] ?? {};

export function recordAnswer(q: PublicQuestion, correct: boolean): void {
  const seen = getSeen();
  seen[q.id] = Date.now();
  write("quix_seen", seen);

  const skills = getSkills();
  const mine = skills[q.track] ?? {};
  const key = `${q.domain}|${q.subSkill}`;
  const s = mine[key] ?? { correct: 0, total: 0 };
  s.total++;
  if (correct) s.correct++;
  mine[key] = s;
  skills[q.track] = mine;
  write("quix_skills", skills);

  const wrong = getWrong();
  const ids = new Set(wrong[q.track] ?? []);
  if (correct) ids.delete(q.id);
  else ids.add(q.id);
  wrong[q.track] = [...ids];
  write("quix_wrong", wrong);
}

/** Total questions answered across every attempt (qualified lead = email + 10 answers). */
export function answeredTotal(): number {
  return Object.values(getSkills()).reduce((n, h) => n + Object.values(h ?? {}).reduce((m, s) => m + s.total, 0), 0);
}

// ── Email identity (once per person) ─────────────────────────────────────

export const EMAIL_KEY = "quix_user_email";
export const getEmail = (): string | null => {
  try {
    return localStorage.getItem(EMAIL_KEY);
  } catch {
    return null;
  }
};
export const getProfile = () => read<{ name?: string; examDate?: string }>("quix_profile", {});
export const saveProfile = (p: { name?: string; examDate?: string }) => write("quix_profile", p);

// ── Who is learning: email once given, else an anonymous session id (also used by analytics) ──
export function getLearner(): { sessionId: string; email: string | null } {
  let sessionId = "anon";
  try {
    sessionId = localStorage.getItem("quix_session_id") ?? "";
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem("quix_session_id", sessionId);
    }
  } catch {}
  return { sessionId, email: getEmail() };
}

// ── One free call per user per track ─────────────────────────────────────
export const callRequested = (track: TrackId): boolean => read<Record<string, boolean>>("quix_calls", {})[track] === true;
export function markCallRequested(track: TrackId): void {
  const c = read<Record<string, boolean>>("quix_calls", {});
  c[track] = true;
  write("quix_calls", c);
}
