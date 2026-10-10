import { notFound } from "next/navigation";
import type { ResultSummary } from "@/types/quiz";
import type { StudyPlan } from "@/lib/study-plan";
import { TRACKS } from "@/lib/blueprint";
import { DISCLAIMER } from "@/lib/config";
import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Readiness report | Agentic AI Institute", robots: { index: false, follow: false } };

/** Private report page linked from the booking, so the advisor sees the learner's report before the call. */
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const c = db();
  if (!c) notFound();
  const { data } = await c.from("quiz_attempts").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const r = data.result as ResultSummary;
  const plan = data.plan as StudyPlan | null;
  const track = TRACKS[r.track];

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px 80px", color: "var(--ink)" }}>
      <p style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1, color: "#214f91", textTransform: "uppercase" }}>
        {track.short} ({track.code}) readiness report
      </p>
      <h1 style={{ fontSize: 32, margin: "8px 0" }}>
        {data.name ?? data.email ?? "Learner"}
        {r.readiness !== null ? ` · ${r.readiness} / 1000 (estimate)` : ` · ${r.correct} of ${r.total} correct`}
      </h1>
      <p style={{ color: "var(--muted)" }}>
        {data.exam_date ? `Exam date ${data.exam_date} · ` : ""}
        {data.email ?? "no email"} · {new Date(data.created_at).toISOString().slice(0, 10)}
      </p>

      {r.readiness !== null && (
        <p style={{ fontWeight: 600 }}>
          {r.passed ? `Above the ${r.passLine} pass line.` : `${r.gap} points short of the ${r.passLine} pass line.`} Estimate, not an official score.
        </p>
      )}

      <h2 style={{ fontSize: 22, marginTop: 32 }}>Percent correct by domain</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {r.domains.map((d) => (
            <tr key={d.domain} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "8px 0" }}>{d.domain} ({d.weight}%)</td>
              <td style={{ textAlign: "right", fontWeight: 700 }}>{d.pct === null ? "n/a" : `${Math.round(d.pct * 100)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {r.patterns.length > 0 && (
        <>
          <h2 style={{ fontSize: 22, marginTop: 32 }}>Patterns</h2>
          <ul>{r.patterns.map((p) => <li key={p}>{p}</li>)}</ul>
        </>
      )}

      {plan && (
        <>
          <h2 style={{ fontSize: 22, marginTop: 32 }}>Study plan</h2>
          <p>{plan.summary}</p>
        </>
      )}

      <h2 style={{ fontSize: 22, marginTop: 32 }}>Missed questions ({r.missed.length})</h2>
      {r.missed.map((m, i) => (
        <article key={m.id} style={{ borderTop: "1px solid var(--border)", padding: "14px 0" }}>
          <p style={{ fontWeight: 700, margin: 0 }}>{i + 1}. {m.question}</p>
          <p style={{ margin: "6px 0", fontSize: 14, color: "var(--muted)" }}>{m.domain} · {m.subSkill}</p>
          <p style={{ margin: "6px 0", fontSize: 14 }}>
            <span style={{ color: "var(--incorrect-text)" }}>✗ Their answer: {m.userPicks.length ? m.userPicks.map((l) => m.options.find((o) => o.label === l)?.text).join("; ") : "not answered"}</span>
          </p>
          <p style={{ margin: "6px 0", fontSize: 14, color: "var(--correct-text)" }}>✓ Correct: {m.keys.map((l) => m.options.find((o) => o.label === l)?.text).join("; ")}</p>
          <p style={{ margin: "6px 0", fontSize: 14 }}>{m.explanation}</p>
        </article>
      ))}
      <p style={{ marginTop: 32, fontSize: 13, color: "var(--muted)" }}>{DISCLAIMER}</p>
    </main>
  );
}
