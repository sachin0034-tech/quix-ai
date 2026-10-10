import { beforeEach, describe, expect, it, vi } from "vitest";

// A tiny in-memory stand-in for the Supabase query builder, enough for learner_missed.
type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = { learner_missed: [] };

function builder(table: string) {
  let op: "select" | "update" | "delete" | "upsert" = "select";
  let patch: Row = {};
  let upsertRows: Row[] = [];
  let conflict: string[] = [];
  const filters: ((r: Row) => boolean)[] = [];
  const api = {
    select: () => api,
    update: (p: Row) => ((op = "update"), (patch = p), api),
    delete: () => ((op = "delete"), api),
    upsert: (rows: Row[], o: { onConflict: string }) => ((op = "upsert"), (upsertRows = rows), (conflict = o.onConflict.split(",")), api),
    eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), api),
    in: (c: string, v: unknown[]) => (filters.push((r) => v.includes(r[c])), api),
    is: (c: string, v: unknown) => (filters.push((r) => r[c] === v), api),
    then: (resolve: (v: { data: Row[]; error: null }) => void) => {
      const rows = tables[table];
      const hit = rows.filter((r) => filters.every((f) => f(r)));
      if (op === "update") hit.forEach((r) => Object.assign(r, patch));
      if (op === "delete") tables[table] = rows.filter((r) => !hit.includes(r));
      if (op === "upsert") {
        for (const n of upsertRows) {
          const ex = rows.find((r) => conflict.every((c) => r[c] === n[c]));
          if (ex) Object.assign(ex, n);
          else rows.push({ ...n });
        }
      }
      resolve({ data: op === "select" ? hit : [], error: null });
    },
  };
  return api;
}
vi.mock("@/lib/server/db", () => ({ db: () => ({ from: (t: string) => builder(t) }) }));

import { mergeSessionIntoEmail, parseLearner, readKeys, recordOutcomes, unresolvedIds, writeKey } from "@/lib/server/missed";

beforeEach(() => {
  tables.learner_missed = [];
});

describe("review list in the database", () => {
  const anon = { sessionId: "sess-1" };
  it("keys by email when known, else by session; reads both", () => {
    expect(writeKey({ sessionId: "s", email: "a@b.com" })).toBe("a@b.com");
    expect(writeKey({ sessionId: "s" })).toBe("s");
    expect(readKeys({ sessionId: "s", email: "a@b.com" })).toEqual(["a@b.com", "s"]);
    expect(parseLearner({ sessionId: "s", email: " A@B.com " })).toEqual({ sessionId: "s", email: "a@b.com" });
  });
  it("a wrong answer joins the list and counts repeats", async () => {
    await recordOutcomes(anon, "developer", [{ id: 5, correct: false }]);
    await recordOutcomes(anon, "developer", [{ id: 5, correct: false }]);
    expect(tables.learner_missed).toHaveLength(1);
    expect(tables.learner_missed[0].missed_count).toBe(2);
    expect(await unresolvedIds(anon, "developer")).toEqual({ stored: true, ids: [5] });
  });
  it("a later correct answer takes it off the list", async () => {
    await recordOutcomes(anon, "associate", [{ id: 7, correct: false }, { id: 8, correct: false }]);
    await recordOutcomes(anon, "associate", [{ id: 7, correct: true }]);
    expect((await unresolvedIds(anon, "associate")).ids).toEqual([8]);
  });
  it("misses again after being resolved come back", async () => {
    await recordOutcomes(anon, "associate", [{ id: 7, correct: false }]);
    await recordOutcomes(anon, "associate", [{ id: 7, correct: true }]);
    await recordOutcomes(anon, "associate", [{ id: 7, correct: false }]);
    expect((await unresolvedIds(anon, "associate")).ids).toEqual([7]);
  });
  it("lists are per track", async () => {
    await recordOutcomes(anon, "associate", [{ id: 1, correct: false }]);
    expect((await unresolvedIds(anon, "developer")).ids).toEqual([]);
  });
  it("giving an email moves the anonymous misses over, so review works on another device", async () => {
    await recordOutcomes(anon, "developer", [{ id: 3, correct: false }, { id: 4, correct: false }]);
    await recordOutcomes({ email: "a@b.com" }, "developer", [{ id: 4, correct: false }]);
    await mergeSessionIntoEmail("sess-1", "a@b.com");
    expect(tables.learner_missed.every((r) => r.learner_key === "a@b.com")).toBe(true);
    expect(tables.learner_missed.find((r) => r.question_id === 4)?.missed_count).toBe(2);
    expect((await unresolvedIds({ email: "a@b.com" }, "developer")).ids.sort()).toEqual([3, 4]);
  });
  it("does nothing without an identity", async () => {
    expect(await recordOutcomes({}, "developer", [{ id: 1, correct: false }])).toBe(false);
  });
});
