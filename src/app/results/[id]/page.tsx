"use client";

import "@/app/design/results.css";

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
import RichText from "@/components/RichText";
import SkillJarLinks from "@/components/SkillJarLinks";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import Icon from "@/components/Icon";

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
        We couldn&apos;t find these results on this device. <Link href="/">Go back</Link>
      </Message>
    );
  return <Results attempt={attempt} />;
}

/** Milliseconds as m:ss */
function fmtTime(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="container results-message">
      <p>{children}</p>
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
  const [openReview, setOpenReview] = useState<Set<number>>(new Set());
  const toggleReview = (qid: number) =>
    setOpenReview((prev) => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid);
      else next.add(qid);
      return next;
    });

  const request = {
    seed: attempt.seed,
    track: attempt.track,
    mode: attempt.mode,
    domain: attempt.domain,
    module: attempt.module,
    questionIds: attempt.questions.map((q) => q.id),
    pausedIds: Object.entries(attempt.qTiming ?? {}).filter(([, t]) => t.paused).map(([id]) => Number(id)),
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
        // The demo is not part of the learner's history or readiness
        if (attempt.mode !== "demo") addHistory(attempt.track, { id: attempt.id, mode: attempt.mode, readiness: res.readiness, pct: res.pct, at: Date.now() });
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

  async function again(mode: typeof attempt.mode, domain?: string, module?: string) {
    setStarting(mode);
    // Repeating keeps the chosen level and, for a configured full mock, its question count and time
    const same = mode === attempt.mode;
    const r = await startAttempt({
      track: attempt.track,
      mode,
      domain,
      module,
      level: same ? attempt.level : undefined,
      questionCount: same ? attempt.questionCount : undefined,
      minutes: same && attempt.questionCount && attempt.limitSeconds ? Math.round(attempt.limitSeconds / 60) : undefined,
    });
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

  if (error) return <Message>Couldn&apos;t score this attempt. <Link href={`/${attempt.track}`}>Back to modules</Link></Message>;
  if (!result) return <><Header moduleTitle={title} /><Message>Scoring your answers…</Message></>;

  const weakest = result.domains.find((d) => d.domain === result.weakestDomain);
  const sortedDomains = [...result.domains].filter((d) => d.pct !== null).sort((a, b) => (a.pct as number) - (b.pct as number));
  const topGaps = result.lifts.filter((l) => l.kind === "domain").slice(0, 3);
  const unweightedWeak = result.subSkills
    .filter((s) => s.weight === null && s.pct !== null && (s.pct as number) < READY_PCT)
    .sort((a, b) => (a.pct as number) - (b.pct as number))
    .slice(0, 8);
  const readinessPos = (n: number) => `${((n - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100}%`;
  const scaled = result.readiness !== null;
  const pctRounded = Math.round(result.pct * 100);
  const cssVar = (name: string, value: string) => ({ [name]: value }) as React.CSSProperties;

  return (
    <>
      <Header moduleTitle={title} />
      <main id="main">
        {/* ResultsHead */}
        <section className="results-head" aria-labelledby="res-title">
          <div className="container">
            <Link className="page-head__crumb" href={`/${attempt.track}`}>
              <Icon name="arrow-left" size="sm" />
              All Modules
            </Link>
            <div className="results-head__grid">
              <div className="score on-navy">
                <span className="eyebrow">{MODES[attempt.mode].title} · {trackDef.short}</span>
                <h1 className="t-h2" id="res-title">{scaled ? "Your Readiness Estimate" : "Your Practice Summary"}</h1>
                {result.readiness !== null ? (
                  <>
                    <p className="score__value">
                      <strong>{result.readiness}</strong>
                      <span>/ 1000</span>
                    </p>
                    <div>
                      <div className="scale" role="img" aria-label={`Readiness estimate ${result.readiness} out of 1000. Pass line ${PASS_SCORE}.`}>
                        <div className="scale__track">
                          <div className="scale__fill" style={cssVar("--value", readinessPos(result.readiness))} />
                          <div className="scale__pass" style={cssVar("--pass", readinessPos(PASS_SCORE))} />
                        </div>
                        <span className="scale__pass-label" style={cssVar("--pass", readinessPos(PASS_SCORE))}>Pass Line {PASS_SCORE}</span>
                        <div className="scale__ends"><span>{SCORE_MIN}</span><span>1,000</span></div>
                      </div>
                      <span className={`tag ${result.readiness >= PASS_SCORE ? "tag--success" : "tag--on-navy"}`} style={{ marginTop: "var(--s-4)" }}>
                        {readinessLabel(result.readiness)}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="score__value">
                      <strong>{pctRounded}</strong>
                      <span>%</span>
                    </p>
                    <div className="progress progress--on-navy" style={{ height: 8 }} role="img" aria-label={`${result.correct} of ${result.total} correct`}>
                      <div className="progress__fill" style={{ ...cssVar("--value", `${pctRounded}%`), background: "var(--orange-logo)" }} />
                    </div>
                  </>
                )}
              </div>

              <div className="results-head__aside">
                <div className="card card--glass">
                  <p className="t-sm" style={{ color: "var(--on-navy-muted)" }}>
                    {result.readiness !== null ? (
                      <>
                        {result.passed
                          ? `You're ${result.readiness - PASS_SCORE} points above the ${PASS_SCORE} pass line.`
                          : `You're ${result.gap} points short of the ${PASS_SCORE} pass line.`}{" "}
                        {result.correct} of {result.total} correct.
                        {fail && " Your full report includes a study plan and a free 30-minute review call."}
                        {result.lowConfidence && ` Low confidence: this attempt has only ${result.total} questions. A full mock gives a steadier estimate.`}
                        {attempt.mode === "full" && (
                          <>
                            {" "}“Ready” means the estimate stays at {READY_SCORE} or higher across 2 full mocks in a row.{" "}
                            {ready ? "You've done it. Looks ready." : `Full mocks so far: ${fullMockReadiness(attempt.track).slice(-2).join(", ") || "none"}.`}
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        {result.correct} of {result.total} correct in this {MODES[attempt.mode].title.toLowerCase()}. Practice accuracy, not an official score.{" "}
                        {attempt.mode !== "review" && "Take the diagnostic or a full mock for a readiness estimate."}
                      </>
                    )}
                  </p>
                  <p className="t-xs results-note">
                    <Icon name="info" size="sm" />
                    <span>Estimate, not an official score. Anthropic publishes no conversion from percent correct to the 100–1,000 scale, so this is a practice estimate and not a guarantee of a pass.</span>
                  </p>
                  <div className="cluster results-actions-row">
                    {fail ? (
                      <>
                        <a className="btn btn--accent" href="#detailed-report">Get My Study Plan</a>
                        <BookingCTA track={attempt.track} readiness={result.readiness} reportUrl={reportUrl} variant="navy" label="Book a Free Review Call" />
                      </>
                    ) : result.readiness !== null ? (
                      <button type="button" className="btn btn--accent" onClick={() => again("full")} disabled={!!starting}>
                        {starting === "full" ? "Starting…" : "Take Another Full Mock"}
                      </button>
                    ) : attempt.mode !== "review" ? (
                      <button type="button" className="btn btn--accent" onClick={() => again("diagnostic")} disabled={!!starting}>
                        {starting === "diagnostic" ? "Starting…" : "Take the Diagnostic"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ResultsBody */}
        <section className="section" style={{ paddingTop: "var(--s-12)" }}>
          <div className="container results-body">
            <div className="stack" style={{ "--stack": "48px" } as React.CSSProperties}>
              <div>
                <h2 className="t-h3" style={{ marginBottom: "var(--s-5)" }}>Percent Correct by Domain</h2>
                <div className="domains">
                  {sortedDomains.map((d) => {
                    const pct = Math.round((d.pct as number) * 100);
                    const isWeakest = d.domain === result.weakestDomain;
                    const flagWeak = isWeakest && pct < 80;
                    return (
                      <div key={d.domain} className={`domain${flagWeak ? " is-weakest" : pct >= 80 ? " is-strong" : ""}`}>
                        <div>
                          <span className="domain__name">{d.domain}</span>
                          <span className="domain__weight">{d.weight}% of exam · {d.correct}/{d.total}{isWeakest ? " · Weakest" : ""}</span>
                        </div>
                        <div className="progress" role="img" aria-label={`${pct}% correct`}>
                          <div className="progress__fill" style={cssVar("--value", `${pct}%`)} />
                        </div>
                        <span className="domain__score">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Fail report */}
              {fail && (
                <section id="detailed-report" aria-labelledby="detailed-report-title">
                  <h2 className="t-h3" id="detailed-report-title" style={{ marginBottom: "var(--s-3)" }}>Your Detailed Report</h2>
                  <p className="t-sm" style={{ color: "var(--ink-2)", marginBottom: "var(--s-4)" }}>
                    You&apos;re <strong>{result.gap} points</strong> short of the {PASS_SCORE} pass line. Here is where the points are, ranked by how much each area would lift your estimate.
                  </p>
                  <ol className="results-list" style={{ marginBottom: "var(--s-5)" }}>
                    {(email ? result.lifts.slice(0, 10) : topGaps).map((l) => (
                      <li key={`${l.kind}-${l.name}`}>
                        <strong>{l.name}</strong>
                        {l.kind === "subSkill" && <span className="results-sub"> · {l.domain}</span>}: {Math.round(l.pct * 100)}% correct, about +{l.lift} points available
                      </li>
                    ))}
                  </ol>

                  {!email ? (
                    <div className="card card--soft">
                      <h3 className="t-h4">Unlock the Full Report</h3>
                      <p className="t-sm t-muted">
                        The full report adds every sub-skill, patterns in your mistakes, time per question, a personal study plan and a PDF. It needs an email address.
                      </p>
                      <div>
                        <button type="button" className="btn btn--accent" onClick={() => gate.open({ required: true, title: "Unlock your full report", body: "Add your email to see the full report, study plan and PDF." })}>
                          Add My Email to Unlock
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="stack" style={{ "--stack": "32px" } as React.CSSProperties}>
                      {unweightedWeak.length > 0 && (
                        <div>
                          <h3 className="t-h4" style={{ marginBottom: "var(--s-2)" }}>Sub-Skills to Review</h3>
                          <p className="t-sm t-muted" style={{ marginBottom: "var(--s-3)" }}>The exam guide gives these no separate weight, so they are ranked by your accuracy.</p>
                          <ul className="results-list results-list--bullets">
                            {unweightedWeak.map((s) => (
                              <li key={`${s.domain}-${s.subSkill}`}>
                                <strong>{s.subSkill}</strong> <span className="results-sub">· {s.domain}</span>: {Math.round((s.pct as number) * 100)}% ({s.correct}/{s.total})
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div>
                        <h3 className="t-h4" style={{ marginBottom: "var(--s-3)" }}>Patterns in Your Mistakes</h3>
                        {result.patterns.length ? (
                          <ul className="results-list results-list--bullets">
                            {result.patterns.map((p) => <li key={p}>{p}</li>)}
                          </ul>
                        ) : (
                          <p className="t-sm t-muted">No single pattern stands out. Your misses are spread across topics.</p>
                        )}
                      </div>

                      <div>
                        <h3 className="t-h4" style={{ marginBottom: "var(--s-3)" }}>Time per Question</h3>
                        <p className="t-sm" style={{ color: "var(--ink-2)" }}>
                          {result.avgSecondsPerQuestion} seconds on average, compared with the {result.paceSeconds}-second exam pace.
                        </p>
                      </div>

                      <div>
                        <h3 className="t-h4" style={{ marginBottom: "var(--s-3)" }}>Your Study Plan</h3>
                        {planLoading && <p className="t-sm t-muted" role="status">Writing your plan…</p>}
                        {plan && <PlanView plan={plan} />}
                        {!planLoading && !plan && <p className="t-sm t-muted">The plan couldn&apos;t be generated right now. Your report and PDF are unaffected.</p>}
                      </div>

                      <button type="button" className="btn btn--secondary btn--block" onClick={downloadPdf} disabled={pdfBusy}>
                        {pdfBusy ? "Building PDF…" : "Download the Full Report (PDF)"}
                        <Icon name="arrow-down" />
                      </button>
                    </div>
                  )}
                </section>
              )}

              {/* Questions answered with the timer paused */}
              {result.pausedItems.length > 0 && (
                <section aria-labelledby="paused-title">
                  <div className="cluster" style={{ justifyContent: "space-between", marginBottom: "var(--s-3)" }}>
                    <h2 className="t-h3" id="paused-title">Paused Timer</h2>
                    <span className="tag tag--neutral">
                      {result.pausedItems.reduce((n, p) => n + p.credit, 0)} of {result.pausedItems.length} points
                    </span>
                  </div>
                  <p className="t-sm t-muted measure">A right answer with the timer paused earns half a point.</p>
                  <ul className="stack" style={{ marginTop: "var(--s-3)" }}>
                    {result.pausedItems.map((p) => (
                      <li key={p.id} className="t-sm">
                        <strong>{p.credit === 0.5 ? "0.5 point" : "0 points"}</strong> · {fmtTime(p.ms)} on the question · {p.question.length > 90 ? `${p.question.slice(0, 90)}…` : p.question}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Missed questions */}
              <div>
                <div className="cluster" style={{ justifyContent: "space-between", marginBottom: "var(--s-3)" }}>
                  <h2 className="t-h3">Question Review</h2>
                  <span className={`tag ${result.missed.length === 0 ? "tag--success" : "tag--error"}`}>{result.missed.length} Missed</span>
                </div>
                {result.missed.length === 0 ? (
                  <p className="t-sm t-muted">No missed questions. Nice work.</p>
                ) : (
                  <div className="accordion">
                    {result.missed.map((m, i) => {
                      const open = openReview.has(m.id);
                      const answer = (labels: string[]) => labels.map((l) => `${l}. ${m.options.find((o) => o.label === l)?.text}`).join("; ");
                      return (
                        <div key={m.id} className="accordion__item">
                          <button
                            type="button"
                            className="accordion__trigger"
                            aria-expanded={open}
                            aria-controls={`rv-${i}`}
                            id={`rv-trigger-${i}`}
                            onClick={() => toggleReview(m.id)}
                          >
                            <span className="review__q">
                              <span className="review__mark review__mark--no"><Icon name="x" size="sm" /></span>
                              <span><RichText text={m.question} /></span>
                            </span>
                            <span className="accordion__icon"><Icon name="plus" size="sm" /></span>
                          </button>
                          <div className="accordion__panel" id={`rv-${i}`} role="region" aria-labelledby={`rv-trigger-${i}`} inert={!open}>
                            <div>
                              <div className="accordion__body results-review__body">
                                <p className="results-review__meta">{m.domain} · {m.subSkill}</p>
                                <dl className="review__answers">
                                  <div className="review__answer review__answer--no">
                                    <dt>Your Answer</dt>
                                    <dd>{m.userPicks.length ? answer(m.userPicks) : "Not answered"}</dd>
                                  </div>
                                  <div className="review__answer review__answer--ok">
                                    <dt>Correct Answer</dt>
                                    <dd>{answer(m.keys)}</dd>
                                  </div>
                                </dl>
                                <p className="results-review__explain">{m.explanation}</p>
                                <SkillJarLinks resources={m.resources} />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <aside className="results-body__side" aria-label="What to Do Next">
              {weakest && weakest.pct !== null && (
                <div className="card card--navy card--lg">
                  <span className="eyebrow">Weakest Domain</span>
                  <h2 className="t-h3">{weakest.domain}</h2>
                  <p className="t-sm" style={{ color: "var(--on-navy-muted)" }}>
                    You scored {Math.round(weakest.pct * 100)}% on {weakest.domain}. Our course covers it in Module {weakest.courseModule ?? 1}.
                  </p>
                  <div className="stack" style={{ "--stack": "12px" } as React.CSSProperties}>
                    <button type="button" className="btn btn--accent btn--block" onClick={() => again("drill", weakest.domain)} disabled={!!starting}>
                      {starting === "drill" ? "Starting…" : "Drill This Domain"}
                    </button>
                    <a
                      className="btn btn--link-light"
                      href={COURSE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackEvent("course_cta_clicked", { where: "results", domain: weakest.domain })}
                    >
                      See the Course Module <Icon name="external" size="sm" />
                    </a>
                  </div>
                </div>
              )}
              <div className="card">
                <h2 className="t-h4">Keep Practising</h2>
                <div className="next-actions">
                  <button type="button" className="btn btn--secondary btn--block" onClick={() => again(attempt.mode, attempt.domain, attempt.module)} disabled={!!starting}>
                    Repeat This Module <Icon name="refresh" />
                  </button>
                  <Link className="btn btn--secondary btn--block" href={`/${attempt.track}`}>
                    Choose Any Module <Icon name="layers" />
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </section>

        {/* 1:1 review call */}
        {fail && (
          <section className="section" style={{ paddingTop: 0 }} aria-label="Book a review call">
            <div className="container">
              <div className="cta-band">
                <div className="stack" style={{ "--stack": "12px" } as React.CSSProperties}>
                  <span className="eyebrow">Free 1-on-1 Review</span>
                  <h2 className="t-h3">Want a Person to Go Through This With You?</h2>
                </div>
                <div className="cta-band__aside">
                  <p className="t-sm" style={{ color: "var(--on-navy-muted)" }}>
                    Book a free 30-minute review call. An advisor sees your report first, so the time goes on your weak areas. One free call per track.
                  </p>
                  <div>
                    <BookingCTA track={attempt.track} readiness={result.readiness} reportUrl={reportUrl} />
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

function PlanView({ plan }: { plan: StudyPlan }) {
  return (
    <div className="stack" style={{ "--stack": "16px" } as React.CSSProperties}>
      <p className="t-sm" style={{ color: "var(--ink-2)" }}>{plan.summary}</p>
      {plan.domains.map((d) => (
        <div key={d.name} className="card results-plan-card">
          <h4 className="t-h4">{d.name}</h4>
          <span className="t-xs t-muted">{Math.round(d.pct * 100)}% · Course Module {d.courseModule}</span>
          <p>{d.whatToStudy}</p>
          <ul>
            {d.docLinks.map((l) => (
              <li key={l.url}>
                <a href={l.url} target="_blank" rel="noopener noreferrer">{l.title}</a>
              </li>
            ))}
            <li>{d.drill}</li>
          </ul>
        </div>
      ))}
      <ol className="results-days t-sm">
        {plan.days.map((d) => (
          <li key={d.day}>
            <strong>
              Day {d.day}
              {d.date ? ` (${d.date})` : ""}: {d.title}
            </strong>
            {d.focus && <div className="t-muted">{d.focus}</div>}
            <ul>
              {d.tasks.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </li>
        ))}
      </ol>
      <p className="t-sm" style={{ fontWeight: "var(--fw-medium)" }}>Retest checkpoint: {plan.retest.text}</p>
      {plan.askForDate && <p className="t-xs t-muted">No exam date given, so this is a 14-day default. Add your exam date next time to sharpen it.</p>}
    </div>
  );
}
