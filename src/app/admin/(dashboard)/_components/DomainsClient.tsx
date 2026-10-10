"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveDomainAction } from "@/app/admin/actions";
import type { AdminDomain } from "@/lib/server/admin-data";
import { btn, btnPrimary, card, input, label } from "./ui";

const TRACK_LABEL: Record<string, string> = { associate: "Associate (CCAO-F)", developer: "Developer (CCDV-F)" };

export default function DomainsClient({ domains }: { domains: AdminDomain[] }) {
  const [adding, setAdding] = useState(false);
  const [track, setTrack] = useState("associate");
  const [title, setTitle] = useState("");
  const [weight, setWeight] = useState("");
  const [msg, setMsg] = useState("");
  const router = useRouter();
  const [pending, start] = useTransition();

  const groups = ["associate", "developer", "other"].map((t) => ({
    id: t,
    items: domains.filter((d) => (d.track ?? "other") === t),
  }));

  function add() {
    start(async () => {
      const r = await saveDomainAction({ track, title, weight: Number(weight), courseModule: null, objective: "", docLinks: [], subSkills: [] });
      if (r.error) setMsg(r.error);
      else router.push(`/admin/modules/${r.id}`);
    });
  }

  return (
    <>
      <div style={{ margin: "0 0 16px" }}>
        {!adding ? (
          <button style={btnPrimary} onClick={() => setAdding(true)}>+ Add domain</button>
        ) : (
          <div style={{ ...card, maxWidth: 520 }}>
            <label style={label}>Track</label>
            <select value={track} onChange={(e) => setTrack(e.target.value)} style={input}>
              <option value="associate">Associate (CCAO-F)</option>
              <option value="developer">Developer (CCDV-F)</option>
            </select>
            <label style={label}>Domain name</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={input} />
            <label style={label}>Weight (% of the exam)</label>
            <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" style={input} />
            <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "center" }}>
              <button style={btnPrimary} disabled={pending} onClick={add}>Create and edit</button>
              <button style={btn} onClick={() => setAdding(false)}>Cancel</button>
              {msg && <span style={{ color: "var(--incorrect-text)", fontSize: 13 }}>✗ {msg}</span>}
            </div>
          </div>
        )}
      </div>

      {groups.filter((g) => g.items.length).map((g) => {
        const total = g.items.reduce((n, d) => n + (d.weight ?? 0), 0);
        const off = g.id !== "other" && Math.abs(total - 100) > 0.5;
        return (
          <section key={g.id} style={{ margin: "0 0 28px" }}>
            <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>
              {TRACK_LABEL[g.id] ?? "No track set (these are ignored by the quiz)"}
              {g.id !== "other" && (
                <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 10, color: off ? "var(--incorrect-text)" : "var(--correct-text)" }}>
                  {off ? "✗" : "✓"} weights total {total.toFixed(1)}%
                </span>
              )}
            </h2>
            <div style={{ display: "grid", gap: 8 }}>
              {g.items.map((d) => (
                <Link key={d.id} href={`/admin/modules/${d.id}`} style={{ ...card, textDecoration: "none", color: "inherit", display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}>
                  <div>
                    <strong>{d.title}</strong>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                      {d.subSkills.length} sub-skills · {d.questionCount} questions · course module {d.courseModule ?? "not set"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", fontWeight: 700 }}>{d.weight != null ? `${d.weight}%` : "no weight"}</div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
      {domains.length === 0 && <p>No domains in the database yet. Run <code>supabase/seed/questions.sql</code>, or add one above.</p>}
    </>
  );
}
