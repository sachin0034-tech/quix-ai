import { db } from "@/lib/server/db";
import CallForm from "./CallForm";

export const dynamic = "force-dynamic";

export default async function CallsPage() {
  const c = db();
  const res = c ? await c.from("call_bookings").select("*").order("start_time", { ascending: false, nullsFirst: false }).limit(300) : null;
  const rows = (res?.data ?? []) as { id: number; email: string; name: string | null; start_time: string | null; track: string | null; readiness: number | null; report_url: string | null; status: string; outcome: string | null; offer_made: boolean | null }[];
  return (
    <div style={{ padding: "32px 40px", maxWidth: 1000 }}>
      <h1 style={{ fontSize: 26, margin: "0 0 6px" }}>1:1 review calls</h1>
      <p style={{ color: "var(--muted)", margin: "0 0 20px" }}>Bookings arrive from the scheduling tool&apos;s webhook. Open the report before the call, then log the outcome and whether a course offer was made.</p>
      {!c && <p>Supabase is not configured.</p>}
      {res?.error && <p style={{ color: "var(--incorrect-text)" }}>{res.error.message}. Apply supabase/migrations/0001_cert_readiness.sql.</p>}
      {rows.map((r) => (
        <article key={r.id} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: 16, margin: "0 0 12px" }}>
          <strong>{r.name ?? r.email}</strong> · {r.email} · {r.track ?? "?"} · readiness {r.readiness ?? "n/a"} · {r.start_time ? r.start_time.slice(0, 16).replace("T", " ") : "no time"}
          <div style={{ margin: "6px 0" }}>
            {r.report_url ? <a href={r.report_url} target="_blank" rel="noopener noreferrer" style={{ color: "#214f91" }}>Open report ↗</a> : <span style={{ color: "var(--muted)" }}>No report link</span>}
          </div>
          <CallForm id={r.id} status={r.status} outcome={r.outcome ?? ""} offerMade={!!r.offer_made} />
        </article>
      ))}
      {rows.length === 0 && c && !res?.error && <p>No bookings yet.</p>}
    </div>
  );
}
