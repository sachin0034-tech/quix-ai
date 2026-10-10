"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ResultSummary } from "@/types/quiz";
import { MODES, TRACKS } from "@/lib/blueprint";
import { COURSE_URL, PASS_SCORE, READY_SCORE, SCORE_MAX, SCORE_MIN } from "@/lib/config";
import { READY_PCT, isReady, readinessLabel } from "@/lib/scoring";
import type { StudyPlan } from "@/lib/study-plan";
import {
  addHistory,
  fullMockReadiness,
  getAttempt,
  getEmail,
  getLearner,
  saveAttempt,
  getProfile,
  recordAnswer,
  type StoredAttempt,
} from "@/lib/client/store";
import { startAttempt } from "@/lib/client/start";
import { track as trackEvent } from "@/lib/analytics";
import { useEmailGate } from "@/components/EmailGate";
import BookingCTA from "@/components/BookingCTA";
import Header from "@/components/Header";

const btnOutline: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "14px 18px",
  border: "1px solid #dce3ed",
  borderRadius: "9px",
  background: "white",
  color: "#071b39",
  fontWeight: 700,
  fontSize: "15px",
  cursor: "pointer",
  fontFamily: "inherit",
  textDecoration: "none",
  minHeight: "52px",
  lineHeight: 1.3,
};
const btnDark: React.CSSProperties = { ...btnOutline, width: "100%", border: "none", background: "#071b39", color: "white", marginTop: "12px" };
const h2: React.CSSProperties = {
  fontFamily: "var(--font-manrope), sans-serif",
  fontSize: "20px",
  fontWeight: 800,
  letterSpacing: "-0.025em",
  color: "#071b39",
  margin: "36px 0 10px",
};

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const [attempt, setAttempt] = useState<StoredAttempt | null | undefined>(undefined);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage after mount
    setAttempt(getAttempt(id));
  }, [id]);

  if (attempt === undefined) return <Message>Loading results…</Message>;
  if (attempt === null)
    return (
      <Message>
        We couldn&apos;t find these results on this device.{" "}
        <Link href="/" style={{ color: "var(--navy)" }}>
          Go back
        </Link>
      </Message>
    );
  return <Results attempt={attempt} />;
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ padding: "96px 48px", textAlign: "center" }}>
      <p style={{ color: "var(--muted)" }}>{children}</p>
    </main>
  );
}

function Results({ attempt }: { attempt: StoredAttempt }) {
  const router = useRouter();
  const gate = useEmailGate();
  const [result, setResult] = useState<ResultSummary | null>(null);
  const [error, setError] = useState(false);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const generated = useRef(false);
  const [openedAt] = useState(() => Date.now());

  const request = {
    seed: attempt.seed,
    track: attempt.track,
    mode: attempt.mode,
    domain: attempt.domain,
    questionIds: attempt.questions.map((q) => q.id),
    answers: Object.entries(attempt.answers).map(([qid, a]) => ({ id: Number(qid), picks: a.picks, ms: a.ms })),
    totalSeconds: Math.round(((attempt.finishedAt ?? openedAt) - attempt.startedAt) / 1000),
  };

  const email = gate.email ?? (typeof window !== "undefined" ? getEmail() : null);
  const fail = !!result && result.readiness !== null && result.readiness < PASS_SCORE;

  // 1. Score the attempt on the server (the browser never decides its own score)
  useEffect(() => {
    if (generated.current) return;
    generated.current = true;
    const started = Date.now();
    // Exam-conditions attempts were not checked per question: the server records their misses once
    const record = attempt.examConditions && !attempt.recordedAt;
    fetch("/api/results", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...request, learner: getLearner(), record }) })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(({ result: res }: { result: ResultSummary }) => {
        setResult(res);
        // Exam-conditions attempts were not checked per question, so learn from the result now
        if (attempt.examConditions) {
          const missed = new Set(res.missed.map((m) => m.id));
          attempt.questions.forEach((q) => recordAnswer(q, !missed.has(q.id) && !!attempt.answers[q.id]));
        }
        if (record) saveAttempt({ ...attempt, recordedAt: Date.now() });
        addHistory(attempt.track, { id: attempt.id, mode: attempt.mode, readiness: res.readiness, pct: res.pct, at: Date.now() });
        setReady(isReady(fullMockReadiness(attempt.track)));
        trackEvent("module_completed", { track: res.track, mode: res.mode, score: res.correct, total: res.total, readiness: res.readiness });
        if (res.readiness !== null && res.readiness < PASS_SCORE) {
          trackEvent("fail_report_generated", { track: res.track, readiness: res.readiness, ms: Date.now() - started });
        }
      })
      .catch(() => setError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Study plan + stored report (needed for the advisor link) once we know it's a fail
  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    (async () => {
      let p: StudyPlan | null = null;
      if (fail && email) {
        setPlanLoading(true);
        try {
          const res = await fetch("/api/study-plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ request, examDate: getProfile().examDate ?? null, readyStreak: isReady(fullMockReadiness(attempt.track)) }),
          });
          if (res.ok) p = ((await res.json()) as { plan: StudyPlan }).plan;
        } catch {
          /* the report still works without the AI wording */
        }
        if (!cancelled) {
          setPlan(p);
          setPlanLoading(false);
        }
      }
      try {
        const res = await fetch("/api/attempts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request, email, name: getProfile().name ?? null, examDate: getProfile().examDate ?? null, plan: p }),
        });
        if (res.ok && !cancelled) setReportUrl(((await res.json()) as { reportUrl: string }).reportUrl);
      } catch {
        /* storing the report is best effort */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, email]);

  async function again(mode: typeof attempt.mode, domain?: string) {
    setStarting(mode);
    const r = await startAttempt({ track: attempt.track, mode, domain });
    if ("id" in r) router.push(`/quiz/${r.id}`);
    else {
      setStarting(null);
      window.alert(r.error);
    }
  }

  async function downloadPdf() {
    setPdfBusy(true);
    try {
      const res = await fetch("/api/report-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request, name: getProfile().name ?? null, plan }),
      });
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `claude-${attempt.track}-readiness-report.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      trackEvent("report_pdf_downloaded", { track: attempt.track });
    } catch {
      window.alert("Couldn't build the PDF. Try again shortly.");
    } finally {
      setPdfBusy(false);
    }
  }

  const trackDef = TRACKS[attempt.track];
  const title = `${trackDef.short} · ${MODES[attempt.mode].title}`;

  if (error) return <Message>Couldn&apos;t score this attempt. <Link href={`/${attempt.track}`} style={{ color: "var(--navy)" }}>Back to modules</Link></Message>;
  if (!result) return <><Header moduleTitle={title} /><Message>Scoring your answers…</Message></>;

  const weakest = result.domains.find((d) => d.domain === result.weakestDomain);
  const sortedDomains = [...result.domains].filter((d) => d.pct !== null).sort((a, b) => (a.pct as number) - (b.pct as number));
  const topGaps = result.lifts.filter((l) => l.kind === "domain").slice(0, 3);
  const unweightedWeak = result.subSkills
    .filter((s) => s.weight === null && s.pct !== null && (s.pct as number) < READY_PCT)
    .sort((a, b) => (a.pct as number) - (b.pct as number))
    .slice(0, 8);
  const readinessPos = (n: number) => `${((n - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100}%`;

  return (
    <>
      <Header moduleTitle={title} />
      <main style={{ minHeight: "calc(100vh - 88px)", background: "#ffffff" }}>
        <div style={{ maxWidth: "700px", margin: "0 auto", padding: "28px 28px 80px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "18px" }}>
            <span style={{ fontSize: "13px", fontWeight: 800, letterSpacing: ".8px", color: "#214f91", textTransform: "uppercase", fontFamily: "var(--font-manrope), sans-serif" }}>
              Claude Certification Practice Quiz
            </span>
            <Link href={`/${attempt.track}`} aria-label="Close results" style={{ display: "grid", placeContent: "center", width: "44px", height: "44px", borderRadius: "50%", background: "#f1f5fa", color: "#071b39", fontSize: "22px", textDecoration: "none", flexShrink: 0 }}>
              ×
            </Link>
          </div>

          <div style={{ background: "#fff4db", color: "#65501f", padding: "10px 13px", borderRadius: "6px", fontSize: "14px", lineHeight: 1.6, marginBottom: "22px" }}>
            Estimate, not an official score. Anthropic publishes no conversion from percent correct to the 100–1,000 scale, so this is a practice estimate and not a guarantee of a pass.
          </div>

          <h1 style={{ fontFamily: "var(--font-manrope), sans-serif", fontSize: "25px", fontWeight: 800, letterSpacing: "-0.025em", color: "#071b39", margin: "22px 0 4px", lineHeight: 1.4 }}>
            {result.readiness !== null ? "Your readiness estimate" : "Your practice summary"}
          </h1>

          {result.readiness !== null ? (
            <>
              <div style={{ fontSize: "62px", fontWeight: 800, lineHeight: 1.2, letterSpacing: "-2px", color: "#071b39", fontFamily: "var(--font-manrope), sans-serif" }}>
                {result.readiness}
                <small style={{ fontSize: "20px", letterSpacing: 0, color: "var(--muted)", fontWeight: 500 }}> / 1000</small>
                <span style={{ marginLeft: "14px", verticalAlign: "middle", fontSize: "14px", fontWeight: 700, letterSpacing: 0, padding: "4px 12px", borderRadius: "var(--r-pill)", background: result.readiness >= PASS_SCORE ? "var(--correct-bg)" : "var(--incorrect-bg)", color: result.readiness >= PASS_SCORE ? "var(--correct-text)" : "var(--incorrect-text)" }}>
                  {result.readiness >= PASS_SCORE ? "✓" : "✗"} {readinessLabel(result.readiness)}
                </span>
              </div>

              {/* Scale 100–1000 with the 720 pass line and 800 ready line */}
              <div style={{ position: "relative", height: "10px", borderRadius: "var(--r-pill)", background: "#e2e7f0", margin: "20px 0 34px" }} role="img" aria-label={`Estimate ${result.readiness} on a scale of 100 to 1000; pass line ${PASS_SCORE}`}>
                <div style={{ position: "absolute", inset: 0, width: readinessPos(result.readiness), borderRadius: "var(--r-pill)", background: result.readiness >= PASS_SCORE ? "var(--correct-text)" : "var(--incorrect-text)" }} />
                {[{ v: PASS_SCORE, l: `Pass ${PASS_SCORE}` }, { v: READY_SCORE, l: `Ready ${READY_SCORE}` }].map((m) => (
                  <div key={m.v} style={{ position: "absolute", left: readinessPos(m.v), top: "-4px", bottom: "-4px", width: "2px", background: "#071b39" }}>
                    <span style={{ position: "absolute", top: "18px", left: m.v === PASS_SCORE ? "auto" : "6px", right: m.v === PASS_SCORE ? "6px" : "auto", fontSize: "12px", fontWeight: 700, whiteSpace: "nowrap" }}>{m.l}</span>
                  </div>
                ))}
              </div>

              <p style={{ fontSize: "16px", color: "#071b39", margin: "0 0 8px", lineHeight: 1.6 }}>
                {result.passed
                  ? `You're ${result.readiness - PASS_SCORE} points above the ${PASS_SCORE} pass line.`
                  : `You're ${result.gap} points short of the ${PASS_SCORE} pass line.`}{" "}
                {result.correct} of {result.total} correct.
              </p>
              {result.lowConfidence && (
                <p style={{ fontSize: "14px", color: "var(--muted)", margin: "0 0 8px" }}>
                  Low confidence: this attempt has only {result.total} questions. A full mock gives a steadier estimate.
                </p>
              )}
              {attempt.mode === "full" && (
                <p style={{ fontSize: "14px", color: "var(--muted)", margin: 0 }}>
                  &ldquo;Ready&rdquo; means the estimate stays at {READY_SCORE} or higher across 2 full mocks in a row.{" "}
                  {ready ? "You've done it. Looks ready." : `Full mocks so far: ${fullMockReadiness(attempt.track).slice(-2).join(", ") || "none"}.`}
                </p>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: "62px", fontWeight: 800, lineHeight: 1.3, letterSpacing: "-2px", color: "#071b39", fontFamily: "var(--font-manrope), sans-serif" }}>
                {Math.round(result.pct * 100)}
                <small style={{ fontSize: "20px", letterSpacing: 0, color: "var(--muted)", fontWeight: 500 }}>%</small>
              </div>
              <p style={{ fontSize: "16px", color: "#071b39", margin: "0 0 8px", lineHeight: 1.6 }}>
                {result.correct} of {result.total} correct in this {MODES[attempt.mode].title.toLowerCase()}. Practice accuracy, not an official score.{" "}
                {attempt.mode !== "review" && "Take the diagnostic or a full mock for a readiness estimate."}
              </p>
            </>
          )}

          {/* Domains */}
          <h2 style={h2}>Percent correct by domain</h2>
          <div style={{ display: "grid", gap: "12px" }}>
            {sortedDomains.map((d) => (
              <div key={d.domain}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", fontSize: "14px", marginBottom: "5px" }}>
                  <span>
                    {d.domain} <span style={{ color: "var(--muted)" }}>({d.weight}% of exam)</span>
                  </span>
                  <strong>
                    {Math.round((d.pct as number) * 100)}% · {d.correct}/{d.total}
                  </strong>
                </div>
                <div style={{ height: "8px", borderRadius: "var(--r-pill)", background: "#e2e7f0" }}>
                  <div style={{ height: "100%", width: `${(d.pct as number) * 100}%`, borderRadius: "var(--r-pill)", background: (d.pct as number) >= 0.69 ? "var(--correct-text)" : "var(--incorrect-text)" }} />
                </div>
              </div>
            ))}
          </div>

          {/* Weakest domain + next module + course CTA */}
          {weakest && weakest.pct !== null && (
            <div style={{ marginTop: "28px", background: "#071b39", color: "#fff", borderRadius: "14px", padding: "26px" }}>
              <p style={{ margin: "0 0 6px", fontSize: "13px", fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "#ff9b50" }}>Weakest domain</p>
              <h3 style={{ margin: "0 0 10px", fontSize: "22px", color: "#fff" }}>{weakest.domain}</h3>
              <p style={{ margin: "0 0 16px", color: "#c7d4e7", lineHeight: 1.6 }}>
                You scored {Math.round(weakest.pct * 100)}% on {weakest.domain}. Our course covers it in Module {weakest.courseModule ?? 1}.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                <button onClick={() => again("drill", weakest.domain)} disabled={!!starting} style={{ ...btnOutline, background: "#ff9b50", border: "none" }}>
                  {starting === "drill" ? "Starting…" : "Next: drill this domain →"}
                </button>
                <a
                  href={COURSE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackEvent("course_cta_clicked", { where: "results", domain: weakest.domain })}
                  style={{ ...btnOutline, background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,.4)" }}
                >
                  See the course module
                </a>
              </div>
            </div>
          )}

          {/* Fail report */}
          {fail && (
            <section aria-label="Detailed report">
              <h2 style={h2}>Your detailed report</h2>
              <p style={{ margin: "0 0 14px", lineHeight: 1.6 }}>
                You&apos;re <strong>{result.gap} points</strong> short of the {PASS_SCORE} pass line. Here is where the points are, ranked by how much each area would lift your estimate.
              </p>
              <ol style={{ paddingLeft: "20px", margin: "0 0 14px", display: "grid", gap: "6px" }}>
                {(email ? result.lifts.slice(0, 10) : topGaps).map((l) => (
                  <li key={`${l.kind}-${l.name}`}>
                    <strong>{l.name}</strong>
                    {l.kind === "subSkill" && <span style={{ color: "var(--muted)" }}> · {l.domain}</span>}: {Math.round(l.pct * 100)}% correct, about +{l.lift} points available
                  </li>
                ))}
              </ol>

              {!email ? (
                <div style={{ border: "1px dashed #99abc2", borderRadius: "10px", padding: "20px", background: "#f9fbfe" }}>
                  <strong>Unlock the full report</strong>
                  <p style={{ margin: "6px 0 14px", color: "var(--muted)", lineHeight: 1.6 }}>
                    The full report adds every sub-skill, patterns in your mistakes, time per question, a personal study plan and a PDF. It needs an email address.
                  </p>
                  <button onClick={() => gate.open({ required: true, title: "Unlock your full report", body: "Add your email to see the full report, study plan and PDF." })} style={{ ...btnDark, marginTop: 0, width: "auto", padding: "14px 22px" }}>
                    Add my email to unlock
                  </button>
                </div>
              ) : (
                <>
                  {unweightedWeak.length > 0 && (
                    <>
                      <h3 style={{ ...h2, fontSize: "17px", margin: "22px 0 8px" }}>Sub-skills to review</h3>
                      <p style={{ margin: "0 0 8px", color: "var(--muted)", fontSize: "14px" }}>The exam guide gives these no separate weight, so they are ranked by your accuracy.</p>
                      <ul style={{ margin: 0, paddingLeft: "20px", display: "grid", gap: "4px" }}>
                        {unweightedWeak.map((s) => (
                          <li key={`${s.domain}-${s.subSkill}`}>
                            <strong>{s.subSkill}</strong> <span style={{ color: "var(--muted)" }}>· {s.domain}</span>: {Math.round((s.pct as number) * 100)}% ({s.correct}/{s.total})
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  <h3 style={{ ...h2, fontSize: "17px", margin: "22px 0 8px" }}>Patterns in your mistakes</h3>
                  {result.patterns.length ? (
                    <ul style={{ margin: 0, paddingLeft: "20px", display: "grid", gap: "6px" }}>
                      {result.patterns.map((p) => <li key={p}>{p}</li>)}
                    </ul>
                  ) : (
                    <p style={{ color: "var(--muted)", margin: 0 }}>No single pattern stands out. Your misses are spread across topics.</p>
                  )}

                  <h3 style={{ ...h2, fontSize: "17px", margin: "22px 0 8px" }}>Time per question</h3>
                  <p style={{ margin: 0 }}>
                    {result.avgSecondsPerQuestion} seconds on average, compared with the {result.paceSeconds}-second exam pace.
                  </p>

                  <h3 style={{ ...h2, fontSize: "17px", margin: "22px 0 8px" }}>Your study plan</h3>
                  {planLoading && <p style={{ color: "var(--muted)" }}>Writing your plan…</p>}
                  {plan && <PlanView plan={plan} />}
                  {!planLoading && !plan && <p style={{ color: "var(--muted)" }}>The plan couldn&apos;t be generated right now. Your report and PDF are unaffected.</p>}

                  <button onClick={downloadPdf} disabled={pdfBusy} style={{ ...btnOutline, marginTop: "20px", width: "100%" }}>
                    {pdfBusy ? "Building PDF…" : "Download the full report (PDF)"}
                  </button>
                </>
              )}

              {/* 1:1 review call */}
              <div style={{ marginTop: "24px", border: "1px solid #dce3ed", borderRadius: "12px", padding: "22px", background: "#f1f5fa" }}>
                <strong style={{ fontSize: "17px" }}>Want a person to go through this with you?</strong>
                <p style={{ margin: "6px 0 14px", color: "var(--muted)", lineHeight: 1.6 }}>
                  Book a free 30-minute review call. An advisor sees your report first, so the time goes on your weak areas. One free call per track.
                </p>
                <BookingCTA track={attempt.track} readiness={result.readiness} reportUrl={reportUrl} />
              </div>
            </section>
          )}

          {/* Missed questions */}
          <h2 style={h2}>Question review ({result.missed.length} missed)</h2>
          {result.missed.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No missed questions. Nice work.</p>
          ) : (
            <div style={{ display: "grid", gap: "10px" }}>
              {result.missed.map((m, i) => (
                <details key={m.id} className="faq-details" style={{ border: "1px solid #dce3ed", borderRadius: "10px", padding: "12px 16px" }}>
                  <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                    {i + 1}. {m.question}
                  </summary>
                  <p style={{ margin: "10px 0 4px", fontSize: "13px", color: "var(--muted)" }}>
                    {m.domain} · {m.subSkill}
                  </p>
                  <p style={{ margin: "4px 0", color: "var(--incorrect-text)", fontSize: "14px" }}>
                    ✗ Your answer: {m.userPicks.length ? m.userPicks.map((l) => `${l}) ${m.options.find((o) => o.label === l)?.text}`).join("; ") : "not answered"}
                  </p>
                  <p style={{ margin: "4px 0", color: "var(--correct-text)", fontSize: "14px" }}>
                    ✓ Correct: {m.keys.map((l) => `${l}) ${m.options.find((o) => o.label === l)?.text}`).join("; ")}
                  </p>
                  <p style={{ margin: "8px 0 0", fontSize: "15px", lineHeight: 1.65 }}>{m.explanation}</p>
                </details>
              ))}
            </div>
          )}

          {/* Next actions */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "32px" }}>
            <button onClick={() => again(attempt.mode, attempt.domain)} disabled={!!starting} style={btnOutline}>
              Repeat this module
            </button>
            {result.missed.length > 0 ? (
              <button onClick={() => again("review")} disabled={!!starting} style={btnOutline}>
                Review mistakes
              </button>
            ) : (
              <button disabled style={{ ...btnOutline, opacity: 0.45, cursor: "not-allowed" }}>Review mistakes</button>
            )}
          </div>
          <Link href={`/${attempt.track}`} style={btnDark}>
            Choose any module
          </Link>
        </div>
      </main>
    </>
  );
}

function PlanView({ plan }: { plan: StudyPlan }) {
  return (
    <div>
      <p style={{ lineHeight: 1.6 }}>{plan.summary}</p>
      {plan.domains.map((d) => (
        <div key={d.name} style={{ border: "1px solid #dce3ed", borderRadius: "10px", padding: "14px 16px", margin: "10px 0" }}>
          <strong>{d.name}</strong> <span style={{ color: "var(--muted)" }}>· {Math.round(d.pct * 100)}% · Course Module {d.courseModule}</span>
          <p style={{ margin: "6px 0", fontSize: "14px", lineHeight: 1.6 }}>{d.whatToStudy}</p>
          <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "14px" }}>
            {d.docLinks.map((l) => (
              <li key={l.url}>
                <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ color: "#214f91" }}>{l.title}</a>
              </li>
            ))}
            <li>{d.drill}</li>
          </ul>
        </div>
      ))}
      <ol style={{ paddingLeft: "20px", display: "grid", gap: "8px", margin: "14px 0" }}>
        {plan.days.map((d) => (
          <li key={d.day}>
            <strong>
              Day {d.day}
              {d.date ? ` (${d.date})` : ""}: {d.title}
            </strong>
            {d.focus && <div style={{ color: "var(--muted)", fontSize: "14px" }}>{d.focus}</div>}
            <ul style={{ margin: "2px 0 0", paddingLeft: "18px", fontSize: "14px" }}>
              {d.tasks.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </li>
        ))}
      </ol>
      <p style={{ fontWeight: 600 }}>Retest checkpoint: {plan.retest.text}</p>
      {plan.askForDate && <p style={{ color: "var(--muted)", fontSize: "14px" }}>No exam date given, so this is a 14-day default. Add your exam date next time to sharpen it.</p>}
    </div>
  );
}
