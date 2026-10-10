"use client";

import { useMemo, useState, useTransition } from "react";
import { deleteQuestionAction, saveQuestionAction } from "@/app/admin/actions";
import type { AdminDomain, AdminQuestion } from "@/lib/server/admin-data";
import { btn, btnDanger, btnPrimary, card, input, label } from "../_components/ui";

const PAGE = 25;
const LABELS = ["A", "B", "C", "D"] as const;

interface Draft {
  id?: number;
  moduleId: number;
  section: string;
  difficulty: string;
  question: string;
  options: [string, string, string, string];
  answer: string[];
  explanation: string;
}

const blank = (moduleId: number): Draft => ({ moduleId, section: "", difficulty: "Medium", question: "", options: ["", "", "", ""], answer: [], explanation: "" });

export default function QuestionsClient({ domains, questions, initialDomain }: { domains: AdminDomain[]; questions: AdminQuestion[]; initialDomain: number }) {
  const [track, setTrack] = useState("");
  const [domain, setDomain] = useState(initialDomain);
  const [sub, setSub] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  const domainById = useMemo(() => new Map(domains.map((d) => [d.id, d])), [domains]);
  const visibleDomains = domains.filter((d) => !track || d.track === track);

  const filtered = questions.filter((x) => {
    const d = domainById.get(x.moduleId);
    if (track && d?.track !== track) return false;
    if (domain && x.moduleId !== domain) return false;
    if (sub && x.section !== sub) return false;
    if (q && !`${x.question} ${x.section}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const pageItems = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const subOptions = [...new Set([...(domainById.get(domain)?.subSkills.map((s) => s.name) ?? []), ...questions.filter((x) => !domain || x.moduleId === domain).map((x) => x.section)])].sort();

  function edit(x: AdminQuestion) {
    setDraft({ id: x.id, moduleId: x.moduleId, section: x.section, difficulty: x.difficulty, question: x.question, options: x.options, answer: x.answer.split(",").filter(Boolean), explanation: x.explanation });
    setMsg("");
  }

  function save() {
    if (!draft) return;
    start(async () => {
      const r = await saveQuestionAction({ ...draft, answer: [...draft.answer].sort().join(",") });
      if (r.error) setMsg(`✗ ${r.error}`);
      else window.location.reload();
    });
  }

  function remove(id: number) {
    if (!window.confirm("Delete this question?")) return;
    start(async () => {
      const r = await deleteQuestionAction(id);
      if (r.error) setMsg(`✗ ${r.error}`);
      else window.location.reload();
    });
  }

  const dSubs = draft ? (domainById.get(draft.moduleId)?.subSkills ?? []) : [];

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "0 0 12px" }}>
        <select value={track} onChange={(e) => { setTrack(e.target.value); setDomain(0); setSub(""); setPage(0); }} style={{ ...input, width: 170 }}>
          <option value="">All tracks</option><option value="associate">Associate</option><option value="developer">Developer</option>
        </select>
        <select value={domain} onChange={(e) => { setDomain(Number(e.target.value)); setSub(""); setPage(0); }} style={{ ...input, width: 260 }}>
          <option value={0}>All domains</option>
          {visibleDomains.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
        </select>
        <select value={sub} onChange={(e) => { setSub(e.target.value); setPage(0); }} style={{ ...input, width: 220 }}>
          <option value="">All sub-skills</option>
          {subOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search text" style={{ ...input, width: 200 }} />
        <button style={btnPrimary} onClick={() => { setDraft(blank(domain || visibleDomains[0]?.id || 0)); setMsg(""); }} disabled={!domains.length}>+ New question</button>
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 12px" }}>{filtered.length} of {questions.length} questions</p>

      {draft && (
        <div style={{ ...card, margin: "0 0 16px", borderColor: "var(--navy)" }}>
          <strong>{draft.id ? `Edit question #${draft.id}` : "New question"}</strong>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px", gap: 12 }}>
            <div>
              <label style={label}>Domain</label>
              <select value={draft.moduleId} onChange={(e) => setDraft({ ...draft, moduleId: Number(e.target.value) })} style={input}>
                {domains.map((d) => <option key={d.id} value={d.id}>{d.title} ({d.track ?? "no track"})</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Sub-skill</label>
              <input list="subskills" value={draft.section} onChange={(e) => setDraft({ ...draft, section: e.target.value })} style={input} />
              <datalist id="subskills">{dSubs.map((s) => <option key={s.name} value={s.name} />)}</datalist>
            </div>
            <div>
              <label style={label}>Difficulty</label>
              <select value={draft.difficulty} onChange={(e) => setDraft({ ...draft, difficulty: e.target.value })} style={input}>
                <option>Easy</option><option>Medium</option><option>Hard</option>
              </select>
            </div>
          </div>
          <label style={label}>Question</label>
          <textarea value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} rows={3} style={input} />
          <label style={label}>Options (tick every correct one: more than one makes it a &quot;Select N&quot; item, scored all-or-nothing)</label>
          {LABELS.map((l, i) => (
            <div key={l} style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: 8, margin: "0 0 6px", alignItems: "center" }}>
              <input
                type="checkbox"
                aria-label={`Option ${l} is correct`}
                checked={draft.answer.includes(l)}
                onChange={(e) => setDraft({ ...draft, answer: e.target.checked ? [...draft.answer, l] : draft.answer.filter((x) => x !== l) })}
              />
              <input value={draft.options[i]} onChange={(e) => { const o = [...draft.options] as Draft["options"]; o[i] = e.target.value; setDraft({ ...draft, options: o }); }} style={input} placeholder={`Option ${l}`} />
            </div>
          ))}
          <label style={label}>Explanation (shown after every answer; do not mention option letters, options are shuffled)</label>
          <textarea value={draft.explanation} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} rows={3} style={input} />
          <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
            <button style={btnPrimary} disabled={pending} onClick={save}>Save question</button>
            <button style={btn} onClick={() => setDraft(null)}>Cancel</button>
            {msg && <span style={{ fontSize: 13, color: "var(--incorrect-text)" }}>{msg}</span>}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {pageItems.map((x) => {
          const d = domainById.get(x.moduleId);
          return (
            <article key={x.id} style={card}>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                #{x.id} · {d?.title ?? "unknown domain"} · {x.section} · {x.difficulty} · key {x.answer}{x.explanation ? "" : " · ✗ no explanation"}
              </div>
              <div style={{ fontWeight: 600 }}>{x.question}</div>
              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                <button style={btn} onClick={() => edit(x)}>Edit</button>
                <button style={btnDanger} onClick={() => remove(x.id)} disabled={pending}>Delete</button>
              </div>
            </article>
          );
        })}
      </div>
      {filtered.length > PAGE && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14 }}>
          <button style={btn} disabled={page === 0} onClick={() => setPage(page - 1)}>← Prev</button>
          <span style={{ fontSize: 13 }}>Page {page + 1} of {Math.ceil(filtered.length / PAGE)}</span>
          <button style={btn} disabled={(page + 1) * PAGE >= filtered.length} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      )}
    </>
  );
}
