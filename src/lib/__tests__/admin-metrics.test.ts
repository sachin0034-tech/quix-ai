import { describe, expect, it } from "vitest";
import { computeMetrics, type EventRow } from "@/lib/admin-metrics";

const ev = (event: string, session: string, extra: Partial<EventRow> = {}): EventRow => ({
  event, props: {}, session_id: session, email: null, created_at: "2026-10-10T00:00:00Z", ...extra,
});

describe("admin metrics", () => {
  it("email capture = submitted sessions / sessions that answered Q1", () => {
    const rows = [
      ...["a", "b", "c", "d"].map((s) => ev("question_answered", s)),
      ev("email_modal_shown", "a"), ev("email_modal_shown", "b"),
      ev("email_submitted", "a"),
    ];
    const m = computeMetrics(rows, 1);
    expect(m.find((x) => x.key === "capture")?.value).toBe("25.0%");
    expect(m.find((x) => x.key === "dropoff")?.value).toBe("50.0%");
    expect(m.find((x) => x.key === "dropoff")?.ok).toBe(false);
  });
  it("qualified lead needs an email and 10 answers", () => {
    const rows = Array.from({ length: 10 }, () => ev("question_answered", "a", { email: "x@y.com" }));
    rows.push(ev("question_answered", "b", { email: "z@y.com" }));
    expect(computeMetrics(rows, 2).find((x) => x.key === "qualified")?.value).toBe("1");
  });
  it("returns n/a rather than NaN with no data", () => {
    expect(computeMetrics([], 0).every((x) => !x.value.includes("NaN"))).toBe(true);
  });
});
