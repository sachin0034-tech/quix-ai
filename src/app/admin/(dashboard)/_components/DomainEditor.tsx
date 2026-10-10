"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteDomainAction, saveDomainAction } from "@/app/admin/actions";
import type { AdminDomain } from "@/lib/server/admin-data";
import { btn, btnDanger, btnPrimary, card, input, label } from "./ui";

export default function DomainEditor({ domain }: { domain: AdminDomain }) {
  const [track, setTrack] = useState(domain.track ?? "associate");
  const [title, setTitle] = useState(domain.title);
  const [weight, setWeight] = useState(domain.weight != null ? String(domain.weight) : "");
  const [courseModule, setCourseModule] = useState(domain.courseModule != null ? String(domain.courseModule) : "");
  const [objective, setObjective] = useState(domain.objective);
  const [links, setLinks] = useState(domain.docLinks.map((l) => `${l.title} | ${l.url}`).join("\n"));
  const [subs, setSubs] = useState(domain.subSkills.map((s) => ({ name: s.name, weight: s.weight == null ? "" : String(s.weight) })));
  const [msg, setMsg] = useState("");
  const router = useRouter();
  const [pending, start] = useTransition();

  const weightedSubs = subs.filter((s) => s.weight.trim() !== "");
  const allWeighted = subs.length > 0 && weightedSubs.length === subs.length;
  const subTotal = weightedSubs.reduce((n, s) => n + (Number(s.weight) || 0), 0);
  const w = Number(weight);

  function save() {
    const docLinks = links.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const [t, ...u] = l.split("|");
      return { title: t.trim(), url: u.join("|").trim() };
    });
    start(async () => {
      const r = await saveDomainAction({
        id: domain.id,
        track,
        title,
        weight: w,
        courseModule: courseModule ? Number(courseModule) : null,
        objective,
        docLinks,
        subSkills: subs.map((s) => ({ name: s.name, weight: s.weight.trim() === "" ? null : Number(s.weight) })),
      });
      setMsg(r.error ? `✗ ${r.error}` : "✓ Saved");
    });
  }

  function remove() {
    if (!window.confirm(`Delete "${domain.title}" and its ${domain.questionCount} questions? This cannot be undone.`)) return;
    start(async () => {
      const r = await deleteDomainAction(domain.id);
      if (r.error) setMsg(`✗ ${r.error}`);
      else router.push("/admin");
    });
  }

  return (
    <div style={card}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={label}>Track</label>
          <select value={track} onChange={(e) => setTrack(e.target.value as "associate" | "developer")} style={input}>
            <option value="associate">Associate (CCAO-F)</option>
            <option value="developer">Developer (CCDV-F)</option>
          </select>
        </div>
        <div>
          <label style={label}>Weight (% of the exam)</label>
          <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" style={input} />
        </div>
      </div>
      <label style={label}>Domain name (shown to learners; must be unique)</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} style={input} />
      <label style={label}>Course module that covers it</label>
      <input value={courseModule} onChange={(e) => setCourseModule(e.target.value)} inputMode="numeric" style={{ ...input, maxWidth: 140 }} />
      <label style={label}>Objective (used by the tutor and the study plan)</label>
      <textarea value={objective} onChange={(e) => setObjective(e.target.value)} rows={3} style={input} />
      <label style={label}>Official doc links (one per line: Title | URL)</label>
      <textarea value={links} onChange={(e) => setLinks(e.target.value)} rows={4} style={{ ...input, fontFamily: "monospace" }} />

      <label style={label}>Sub-skills and weights (leave the weight blank when the exam guide gives none, as for Associate)</label>
      <div style={{ display: "grid", gap: 6 }}>
        {subs.map((s, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 90px auto", gap: 8 }}>
            <input value={s.name} onChange={(e) => setSubs(subs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} style={input} placeholder="Sub-skill name" />
            <input value={s.weight} onChange={(e) => setSubs(subs.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)))} inputMode="decimal" style={input} placeholder="%" />
            <button style={btn} onClick={() => setSubs(subs.filter((_, j) => j !== i))} aria-label="Remove sub-skill">×</button>
          </div>
        ))}
      </div>
      <div style={{ margin: "8px 0", display: "flex", gap: 12, alignItems: "center" }}>
        <button style={btn} onClick={() => setSubs([...subs, { name: "", weight: "" }])}>+ Add sub-skill</button>
        {allWeighted ? (
          <span style={{ fontSize: 13, color: Math.abs(subTotal - w) > 0.5 ? "var(--incorrect-text)" : "var(--correct-text)" }}>
            {Math.abs(subTotal - w) > 0.5 ? "✗" : "✓"} sub-skills total {subTotal.toFixed(1)}% (domain weight {Number.isNaN(w) ? "?" : w}%)
          </span>
        ) : (
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            {weightedSubs.length ? "✗ Weight every sub-skill or none: a mix is drawn at the domain weight only." : "Unweighted: questions are drawn at the domain weight only."}
          </span>
        )}
      </div>
      <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px" }}>
        Questions are tagged with a sub-skill through their section. Renaming a sub-skill here does not rename it on existing questions.
      </p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button style={btnPrimary} disabled={pending} onClick={save}>Save domain</button>
        <button style={btnDanger} disabled={pending} onClick={remove}>Delete domain</button>
        {msg && <span style={{ fontSize: 13, color: msg.startsWith("✓") ? "var(--correct-text)" : "var(--incorrect-text)" }}>{msg}</span>}
      </div>
    </div>
  );
}
