import { db } from "@/lib/server/db";
import { PageHead } from "../_components/ui";

export const dynamic = "force-dynamic";

interface Attempt {
  id: string; email: string | null; name: string | null; track: string; mode: string;
  correct: number; total: number; readiness: number | null; created_at: string;
}

export default async function ResponsesPage({ searchParams }: { searchParams: Promise<{ track?: string; mode?: string; q?: string }> }) {
  const sp = await searchParams;
  const c = db();
  let rows: Attempt[] = [];
  let error = "";
  if (c) {
    let query = c.from("quiz_attempts").select("id, email, name, track, mode, correct, total, readiness, created_at").order("created_at", { ascending: false }).limit(500);
    if (sp.track) query = query.eq("track", sp.track);
    if (sp.mode) query = query.eq("mode", sp.mode);
    if (sp.q) query = query.ilike("email", `%${sp.q}%`);
    const res = await query;
    if (res.error) error = `${res.error.message}. Run supabase/migrations/0001_cert_readiness.sql.`;
    else rows = res.data as Attempt[];
  }
  const withScore = rows.filter((r) => r.readiness !== null);
  const avg = withScore.length ? Math.round(withScore.reduce((n, r) => n + (r.readiness as number), 0) / withScore.length) : null;

  return (
    <div style={{ padding: "32px 40px" }}>
      <PageHead title="Responses" />
      <form style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "0 0 14px" }}>
        <select name="track" defaultValue={sp.track ?? ""} style={{ padding: 8 }}><option value="">All tracks</option><option value="associate">Associate</option><option value="developer">Developer</option></select>
        <select name="mode" defaultValue={sp.mode ?? ""} style={{ padding: 8 }}>
          <option value="">All modules</option>
          {["diagnostic", "sprint", "drill", "full", "review"].map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Email contains" style={{ padding: 8 }} />
        <button style={{ padding: "8px 14px" }}>Filter</button>
      </form>
      {!c && <p>Supabase is not configured.</p>}
      {error && <p style={{ color: "var(--incorrect-text)" }}>{error}</p>}
      <p style={{ color: "var(--muted)", fontSize: 13 }}>{rows.length} attempts{avg !== null ? ` · average readiness estimate ${avg} / 1000` : ""}</p>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", border: "1px solid var(--border)", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--muted)" }}>
            {["When", "Learner", "Track", "Module", "Score", "Readiness (est.)", "Report"].map((h) => <th key={h} style={{ padding: 10 }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={{ padding: 10 }}>{r.created_at.slice(0, 16).replace("T", " ")}</td>
              <td>{r.name ?? r.email ?? "anonymous"}{r.name && r.email ? ` · ${r.email}` : ""}</td>
              <td>{r.track}</td><td>{r.mode}</td>
              <td>{r.correct}/{r.total} ({r.total ? Math.round((r.correct / r.total) * 100) : 0}%)</td>
              <td>{r.readiness ?? "n/a"}</td>
              <td><a href={`/report/${r.id}`} target="_blank" rel="noopener noreferrer" style={{ color: "#214f91" }}>Open ↗</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
