import { db } from "@/lib/server/db";
import { getQuestion } from "@/lib/bank";
import ReportActions from "./ReportActions";

export const dynamic = "force-dynamic";

function nowMs(): number {
  return Date.now();
}

const HOURS_48 = 48 * 3_600_000;

export default async function ReportsPage() {
  const c = db();
  const res = c ? await c.from("reported_questions").select("*").order("created_at", { ascending: false }).limit(300) : null;
  const rows = (res?.data ?? []) as { id: number; question_id: number; track: string; reason: string | null; email: string | null; status: string; created_at: string }[];
  const now = nowMs();
  const questions = await Promise.all(rows.map((r) => getQuestion(r.question_id)));
  return (
    <div style={{ padding: "32px 40px", maxWidth: 1000 }}>
      <h1 style={{ fontSize: 26, margin: "0 0 6px" }}>Reported questions</h1>
      <p style={{ color: "var(--muted)", margin: "0 0 20px" }}>Items reported by learners go to human review; upheld items should be taken down within 48 hours (edit or remove in the bank, then mark as upheld).</p>
      {!c && <p>Supabase is not configured.</p>}
      {res?.error && <p style={{ color: "var(--incorrect-text)" }}>{res.error.message}. Apply supabase/migrations/0001_cert_readiness.sql.</p>}
      {rows.map((r, i) => {
        const q = questions[i];
        const overdue = r.status === "open" && now - Date.parse(r.created_at) > HOURS_48;
        return (
          <article key={r.id} style={{ background: "#fff", border: `1px solid ${overdue ? "var(--incorrect-text)" : "var(--border)"}`, borderRadius: 8, padding: 16, margin: "0 0 12px" }}>
            <strong>#{r.question_id} · {r.track}</strong> · {r.status}{overdue ? " · past 48h" : ""} · {r.created_at.slice(0, 16).replace("T", " ")}
            <p style={{ margin: "8px 0" }}>{q?.question ?? "(question no longer in the bank)"}</p>
            {q && <p style={{ margin: "4px 0", fontSize: 13, color: "var(--muted)" }}>{q.domain} · {q.subSkill}</p>}
            {r.reason && <p style={{ margin: "4px 0" }}>Reason: {r.reason}</p>}
            <ReportActions id={r.id} status={r.status} />
          </article>
        );
      })}
      {rows.length === 0 && c && !res?.error && <p>No reports yet.</p>}
    </div>
  );
}
