import type { SchemaStatus } from "@/lib/server/admin-data";

export const card: React.CSSProperties = { background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: 16 };
export const input: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid var(--border)", fontFamily: "inherit", fontSize: 14, color: "var(--ink)", background: "#fff" };
export const label: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", margin: "12px 0 4px", textTransform: "uppercase", letterSpacing: ".4px" };
export const btn: React.CSSProperties = { padding: "8px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 600, color: "var(--ink)" };
export const btnPrimary: React.CSSProperties = { ...btn, background: "var(--navy)", borderColor: "var(--navy)", color: "#fff" };
export const btnDanger: React.CSSProperties = { ...btn, color: "var(--incorrect-text)", borderColor: "var(--incorrect-text)" };

export function PageHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
      <h1 style={{ fontSize: 26, margin: 0 }}>{title}</h1>
      <div>{children}</div>
    </div>
  );
}

/** Tells the admin what the database still needs, and where the quiz is reading from. */
export function SchemaBanner({ schema }: { schema: SchemaStatus }) {
  if (!schema.configured) return <p style={{ background: "#fff4db", color: "#65501f", padding: "10px 14px", borderRadius: 6 }}>Supabase is not configured, so the quiz is using its built-in questions and nothing here can be saved.</p>;
  return (
    <>
      {schema.missing.length > 0 && (
        <div style={{ background: "#fff4db", color: "#65501f", padding: "10px 14px", borderRadius: 6, marginBottom: 12 }}>
          <strong>The database needs an update.</strong> Run <code>supabase/migrations/0001_cert_readiness.sql</code> in the Supabase SQL editor.
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{schema.missing.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      )}
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 12px" }}>
        The quiz is currently serving questions from the <strong>{schema.source === "database" ? "database" : "built-in fallback set (the database has no recognised domains yet)"}</strong>. Changes here appear within a minute.
      </p>
    </>
  );
}
