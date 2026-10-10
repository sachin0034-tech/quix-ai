"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ModeId, TrackId } from "@/types/quiz";
import { MODES, MODE_IDS, TRACKS } from "@/lib/blueprint";
import type { TrackMeta } from "@/lib/bank";
import { PASS_SCORE, flags } from "@/lib/config";
import { startAttempt } from "@/lib/client/start";
import { fullMockReadiness, getHistory, getLearner, getWrongIds, type HistoryEntry } from "@/lib/client/store";
import { isReady } from "@/lib/scoring";
import { track as trackEvent } from "@/lib/analytics";
import Header from "@/components/Header";

const BLUE = "#214f91";

export default function TrackClient({ track, meta }: { track: TrackId; meta: TrackMeta }) {
  const router = useRouter();
  const def = TRACKS[track];
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [wrong, setWrong] = useState(0);
  const [domain, setDomain] = useState(meta.domains.find((d) => d.count > 0)?.name ?? meta.domains[0]?.name ?? "");
  const [exam, setExam] = useState(false);
  const [busy, setBusy] = useState<ModeId | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage after mount
    setHistory(getHistory(track));
    setWrong(getWrongIds(track).length); // instant, from this browser
    // The database holds the real review list (works across devices once an email is given)
    fetch("/api/missed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ track, learner: getLearner() }) })
      .then((r) => r.json())
      .then((d: { stored: boolean; count: number }) => d.stored && setWrong(d.count))
      .catch(() => {});
    trackEvent("track_selected", { track, via: "page" });
  }, [track]);

  const latest = [...history].reverse().find((h) => h.readiness !== null);
  const ready = isReady(fullMockReadiness(track));
  const shortBank = meta.total < def.items;

  async function go(mode: ModeId) {
    setBusy(mode);
    setError("");
    const r = await startAttempt({ track, mode, domain: mode === "drill" ? domain : undefined, examConditions: exam });
    if ("id" in r) router.push(`/quiz/${r.id}`);
    else {
      setError(r.error);
      setBusy(null);
    }
  }

  return (
    <>
      <Header />
      <main style={{ background: "#fff" }}>
        <section style={{ background: "#071b39", color: "white" }}>
          <div className="page-wrap" style={{ padding: "56px 0 60px" }}>
            <Link href="/" style={{ color: "#b5c5dc", fontSize: "14px", textDecoration: "none" }}>← All tracks</Link>
            <p style={{ fontSize: "14px", letterSpacing: "1.4px", fontWeight: 800, color: "#ff9b50", textTransform: "uppercase", margin: "22px 0 14px", fontFamily: "var(--font-manrope), sans-serif" }}>
              {def.code}
            </p>
            <h1 style={{ fontFamily: "var(--font-manrope), sans-serif", fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 800, letterSpacing: "-0.035em", margin: 0, color: "#fff", lineHeight: 1.15 }}>
              {def.name}
            </h1>
            <p style={{ fontSize: "17px", lineHeight: 1.65, color: "#c7d4e7", maxWidth: "640px", margin: "18px 0 0" }}>
              {def.audience} The real exam: {def.items} questions, {def.minutes} minutes, pass mark 720 on a scale of 100–1,000. Every module below is open.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", marginTop: "28px" }}>
              <div style={{ background: "#fff", color: "#071b39", borderRadius: "12px", padding: "16px 20px", minWidth: "220px" }}>
                <span style={{ fontSize: "12px", fontWeight: 800, letterSpacing: ".6px", textTransform: "uppercase", color: "#44536a" }}>Your readiness estimate</span>
                <div style={{ fontSize: "36px", fontWeight: 800, fontFamily: "var(--font-manrope), sans-serif", lineHeight: 1.2 }}>
                  {latest ? latest.readiness : "–"}
                  <small style={{ fontSize: "14px", fontWeight: 500, color: "#44536a" }}> / 1000</small>
                </div>
                <span style={{ fontSize: "13px", color: "#44536a" }}>
                  {latest ? (ready ? "Looks ready: 800+ on 2 full mocks" : `Pass line ${PASS_SCORE}. Estimate, not an official score`) : "Take the diagnostic to get one"}
                </span>
              </div>
              <div style={{ background: "rgba(255,255,255,.08)", borderRadius: "12px", padding: "16px 20px", minWidth: "220px", border: "1px solid rgba(255,255,255,.15)" }}>
                <span style={{ fontSize: "12px", fontWeight: 800, letterSpacing: ".6px", textTransform: "uppercase", color: "#b5c5dc" }}>Question bank</span>
                <div style={{ fontSize: "36px", fontWeight: 800, fontFamily: "var(--font-manrope), sans-serif", lineHeight: 1.2 }}>{meta.total}</div>
                <span style={{ fontSize: "13px", color: "#b5c5dc" }}>original practice questions</span>
              </div>
            </div>
          </div>
        </section>

        <section style={{ padding: "64px 0", background: "#ffffff" }}>
          <div className="page-wrap">
            <p style={{ fontSize: "14px", letterSpacing: "1px", fontWeight: 800, color: BLUE, textTransform: "uppercase", margin: "0 0 14px", fontFamily: "var(--font-manrope), sans-serif" }}>
              Practice by module
            </p>
            <h2 style={{ fontFamily: "var(--font-manrope), sans-serif", fontSize: "clamp(28px, 3vw, 38px)", fontWeight: 800, color: "var(--ink)", margin: "0 0 28px", letterSpacing: "-0.035em" }}>
              Pick any module. Nothing is locked.
            </h2>
            {error && <p role="alert" style={{ color: "var(--incorrect-text)" }}>✗ {error}</p>}

            <div className="module-grid">
              {MODE_IDS.map((mode) => {
                const m = MODES[mode];
                const count = m.questions(track);
                const mins = m.minutes?.(track);
                const disabled = mode === "review" && wrong === 0;
                return (
                  <article key={mode} style={{ border: "1px solid #dce3ed", borderRadius: "10px", padding: "23px 19px", background: "white", display: "flex", flexDirection: "column", opacity: disabled ? 0.7 : 1 }}>
                    <span style={{ color: BLUE, fontSize: "14px", fontWeight: 800, letterSpacing: "1px", marginBottom: "22px", fontFamily: "var(--font-manrope), sans-serif" }}>
                      {mode === "diagnostic" ? "Start here" : mode === "full" ? "Exam rehearsal" : "Open access"}
                    </span>
                    <h3 style={{ fontFamily: "var(--font-manrope), sans-serif", fontSize: "19px", lineHeight: 1.35, fontWeight: 800, color: "var(--ink)", margin: "0 0 12px", letterSpacing: "-0.025em" }}>
                      {m.title}
                    </h3>
                    <p style={{ fontSize: "15px", color: "var(--muted)", lineHeight: 1.7, margin: 0, flex: 1 }}>{m.purpose}</p>

                    {mode === "drill" && (
                      <label style={{ display: "block", marginTop: "14px", fontSize: "13px", fontWeight: 600 }}>
                        Domain
                        <select value={domain} onChange={(e) => setDomain(e.target.value)} style={{ display: "block", width: "100%", marginTop: "6px", padding: "10px", borderRadius: "var(--r-input)", border: "1.5px solid var(--border)", fontFamily: "inherit", fontSize: "14px", color: "var(--ink)", background: "#fff" }}>
                          {meta.domains.map((d) => (
                            <option key={d.name} value={d.name} disabled={d.count === 0}>
                              {d.name} ({d.weight}%)
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {mode === "full" && flags.examConditions && (
                      <label style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginTop: "14px", fontSize: "13px", lineHeight: 1.5 }}>
                        <input type="checkbox" checked={exam} onChange={(e) => setExam(e.target.checked)} style={{ width: "18px", height: "18px", marginTop: "1px" }} />
                        Exam conditions: hide feedback until the end
                      </label>
                    )}
                    {mode === "full" && shortBank && (
                      <p style={{ fontSize: "13px", color: "#65501f", background: "#fff4db", padding: "8px 10px", borderRadius: "6px", margin: "14px 0 0", lineHeight: 1.5 }}>
                        Preview: the bank has {meta.total} of the {def.items} items a full mock needs, so this mock is shorter until the bank grows.
                      </p>
                    )}

                    <span style={{ fontSize: "14px", color: "#654a39", borderTop: "1px solid #dce3ed", paddingTop: "14px", marginTop: "20px" }}>
                      {mode === "review" ? `${wrong} missed item${wrong === 1 ? "" : "s"} · untimed` : `${mode === "full" ? Math.min(count ?? 0, meta.total) : count} questions · ${mins} min`}
                    </span>
                    <button
                      onClick={() => go(mode)}
                      disabled={disabled || !!busy}
                      style={{ width: "100%", marginTop: "14px", padding: "12px 18px", borderRadius: "9px", border: "1px solid #dce3ed", background: mode === "diagnostic" ? "#ff9b50" : "white", color: "var(--ink)", fontWeight: 700, fontSize: "14px", cursor: disabled || busy ? "not-allowed" : "pointer", fontFamily: "inherit", minHeight: "44px" }}
                    >
                      {busy === mode ? "Starting…" : mode === "review" && disabled ? "Nothing to review yet" : "Start →"}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section style={{ padding: "64px 0", background: "#F4F6F9" }}>
          <div className="page-wrap">
            <h2 style={{ fontFamily: "var(--font-manrope), sans-serif", fontSize: "clamp(24px, 2.6vw, 32px)", fontWeight: 800, margin: "0 0 8px", letterSpacing: "-0.03em" }}>
              {meta.domains.length} official domains, weighted as the exam guide weights them
            </h2>
            <p style={{ color: "var(--muted)", margin: "0 0 22px", maxWidth: "640px" }}>
              Full mocks and the diagnostic draw questions at these weights. Source: exam guide v1.0 (July 2026).
            </p>
            <div style={{ display: "grid", gap: "10px" }}>
              {meta.domains.map((d) => (
                <div key={d.name} style={{ display: "flex", justifyContent: "space-between", gap: "16px", background: "#fff", border: "1px solid #dce3ed", borderRadius: "10px", padding: "14px 18px", flexWrap: "wrap" }}>
                  <strong style={{ fontWeight: 600 }}>{d.name}</strong>
                  <span style={{ color: "var(--muted)", fontSize: "14px" }}>{d.weight}% of the exam · {d.count} practice questions</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
