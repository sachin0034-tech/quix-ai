import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const c = db();
  const res = c ? await c.from("quiz_leads").select("*").order("created_at", { ascending: false }).limit(500) : null;
  const rows = (res?.data ?? []) as Record<string, string | boolean | null>[];
  return (
    <div style={{ padding: "32px 40px" }}>
      <h1 style={{ fontSize: 26, margin: "0 0 16px" }}>Leads</h1>
      {!c && <p>Supabase is not configured.</p>}
      {res?.error && <p style={{ color: "var(--incorrect-text)" }}>{res.error.message}</p>}
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", border: "1px solid var(--border)", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--muted)" }}>
            {["Email", "Name", "Track", "Exam date", "Marketing consent", "Source", "Created"].map((h) => <th key={h} style={{ padding: 10 }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={{ padding: 10 }}>{r.email}</td><td>{r.name ?? ""}</td><td>{r.track ?? ""}</td><td>{r.exam_date ?? ""}</td>
              <td>{r.marketing_consent ? "✓ yes" : "no"}</td><td>{r.source ?? ""}</td><td>{String(r.created_at ?? "").slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
