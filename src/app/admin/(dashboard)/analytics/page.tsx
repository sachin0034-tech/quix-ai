import { db } from "@/lib/server/db";
import { computeMetrics, type EventRow } from "@/lib/admin-metrics";

export const dynamic = "force-dynamic";

function daysAgoIso(d: number): string {
  return new Date(Date.now() - d * 86_400_000).toISOString();
}

export default async function AnalyticsPage() {
  const c = db();
  let events: EventRow[] = [];
  let leads = 0;
  let note = "";
  if (!c) note = "Supabase is not configured.";
  else {
    const since = daysAgoIso(90);
    const ev = await c.from("analytics_events").select("event, props, session_id, email, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(50_000);
    if (ev.error) note = `analytics_events is not available (${ev.error.message}). Apply supabase/migrations/0001_cert_readiness.sql.`;
    else events = ev.data as EventRow[];
    const l = await c.from("quiz_leads").select("id", { count: "exact", head: true });
    leads = l.count ?? 0;
  }
  const metrics = computeMetrics(events, leads);

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1000 }}>
      <h1 style={{ fontSize: 26, margin: "0 0 6px" }}>Analytics</h1>
      <p style={{ color: "var(--muted)", margin: "0 0 20px" }}>Last 90 days. Targets are the PRD starting assumptions; revisit after 30 days of data. {events.length.toLocaleString()} events.</p>
      {note && <p style={{ background: "#fff4db", color: "#65501f", padding: "10px 14px", borderRadius: 6 }}>{note}</p>}
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", border: "1px solid var(--border)" }}>
        <thead>
          <tr style={{ textAlign: "left", fontSize: 13, color: "var(--muted)" }}>
            <th style={{ padding: 12 }}>Metric</th><th>Value</th><th>Target (90 days)</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => (
            <tr key={m.key} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={{ padding: 12, fontWeight: m.primary ? 700 : 400 }}>{m.label}</td>
              <td style={{ fontWeight: 700 }}>{m.value}</td>
              <td style={{ color: "var(--muted)" }}>{m.target}</td>
              <td style={{ color: m.ok === null ? "var(--muted)" : m.ok ? "var(--correct-text)" : "var(--incorrect-text)", fontWeight: 600 }}>
                {m.ok === null ? "–" : m.ok ? "✓ on track" : "✗ below target"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
