"use client";

import "../design/track.css";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ModeId, TrackId } from "@/types/quiz";
import { MODES, MODE_IDS, MODULE_QUESTION_SECONDS, MODULE_SIZE, TRACKS } from "@/lib/blueprint";
import type { TrackMeta } from "@/lib/bank";
import { PASS_SCORE, flags } from "@/lib/config";
import { startAttempt } from "@/lib/client/start";
import { fullMockReadiness, getHistory, getLearner, getWrongIds, type HistoryEntry } from "@/lib/client/store";
import { isReady } from "@/lib/scoring";
import { track as trackEvent } from "@/lib/analytics";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import Icon, { type IconName } from "@/components/Icon";
import Listbox from "@/components/ui/Listbox";
import Tabs from "@/components/ui/Tabs";
import Tooltip from "@/components/ui/Tooltip";
import ModuleStartDialog from "@/components/ModuleStartDialog";

const SMALL_WORDS = new Set(["a", "an", "and", "of", "to", "the", "or", "in", "on", "for"]);
/** Interface labels are Title Case in the redesign; question content is never passed through this. */
const titleCase = (s: string) => s.split(" ").map((w, i) => (i > 0 && SMALL_WORDS.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");

const MODE_UI: Record<string, { tag: string; icon: IconName; cta: string }> = {
  diagnostic: { tag: "Start Here", icon: "target", cta: "Start Diagnostic" },
  sprint: { tag: "Daily Habit", icon: "zap", cta: "Start Sprint" },
  drill: { tag: "Fix a Weak Area", icon: "layers", cta: "Start Drill" },
  full: { tag: "Exam Rehearsal", icon: "calendar", cta: "Start Mock Exam" },
  review: { tag: "Untimed", icon: "refresh", cta: "Start Review" },
};

export default function TrackClient({ track, meta }: { track: TrackId; meta: TrackMeta }) {
  const router = useRouter();
  const def = TRACKS[track];
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [wrong, setWrong] = useState(0);
  /** Last timer choice for a module quiz: seconds per question, or null for no timer */
  const [questionSeconds, setQuestionSeconds] = useState<number | null>(MODULE_QUESTION_SECONDS);
  /** The module whose setup dialog is open */
  const [picking, setPicking] = useState<{ name: string; description: string; count: number } | null>(null);
  const [domain, setDomain] = useState(meta.domains.find((d) => d.count > 0)?.name ?? meta.domains[0]?.name ?? "");
  const [exam, setExam] = useState(false);
  const [busy, setBusy] = useState<ModeId | null>(null);
  const [view, setView] = useState<"overall" | "module">("overall");
  const [moduleBusy, setModuleBusy] = useState<string | null>(null);
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
  const maxWeight = Math.max(1, ...meta.domains.map((d) => d.weight));
  const hasModules = meta.modules.length > 0;

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

  async function goModule(name: string, secs: number | null) {
    setQuestionSeconds(secs);
    setModuleBusy(name);
    setError("");
    const r = await startAttempt({ track, mode: "module", module: name, questionSeconds: secs });
    if ("id" in r) router.push(`/quiz/${r.id}`);
    else {
      setError(r.error);
      setModuleBusy(null);
    }
  }

  return (
    <>
      <Header />
      <main id="main">
        <section className="page-head" aria-labelledby="track-title">
          <div className="container">
            <Link className="page-head__crumb" href="/#tracks"><Icon name="arrow-left" size="sm" />All Tracks</Link>
            <div className="page-head__grid">
              <div className="stack stack--16">
                <span className="tag tag--on-navy">{def.code}</span>
                <h1 className="t-h1" id="track-title">{def.name}</h1>
                <p className="t-body measure t-on-navy-muted">
                  {def.audience} The real exam: {def.items} questions, {def.minutes} minutes, pass mark 720 on a scale of 100–1,000.
                </p>
              </div>
              <div className="page-head__stats">
                <div className="stat stat--glass">
                  <span className="stat__label track-glass-label">Your Readiness Estimate
                    <Tooltip end label="About the readiness estimate">Domain-weighted percent correct mapped onto the 100–1,000 scale. An estimate, not an official score.</Tooltip>
                  </span>
                  <span className="stat__value">{latest ? latest.readiness : "–"}<small>/ 1000</small></span>
                  <span className="t-xs track-glass-note">
                    {latest ? (ready ? "Looks ready: 800+ on 2 full mocks" : `Pass line ${PASS_SCORE}. Estimate, not an official score`) : "Take the diagnostic to get one"}
                  </span>
                </div>
                <div className="stat stat--glass">
                  <span className="stat__label">Question Bank</span>
                  <span className="stat__value">{meta.total}</span>
                  <span className="t-xs track-glass-note">Original practice questions</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section section--soft-top" aria-labelledby="practice-title">
          <div className="container">
            <div className="section-head section-head--tight">
              <span className="eyebrow">Practice</span>
              <h2 className="t-h2" id="practice-title">Pick Any Module. Nothing Is Locked.</h2>
              {hasModules && (
                <div className="tabs--end">
                  <Tabs
                    idBase="practice"
                    ariaLabel="Practice View"
                    value={view}
                    onChange={setView}
                    tabs={[{ id: "overall", label: "Practice Modes" }, { id: "module", label: "By Module" }]}
                  />
                </div>
              )}
            </div>
            {error && <p role="alert" className="track-error">{error}</p>}

            <div id="practice-panel-overall" role="tabpanel" aria-labelledby="practice-tab-overall" hidden={view !== "overall"}>
              <div className="modes">
                {MODE_IDS.map((mode) => {
                  const m = MODES[mode];
                  const ui = MODE_UI[mode];
                  const count = m.questions(track);
                  const mins = m.minutes?.(track);
                  const empty = mode === "review" && wrong === 0;
                  const featured = mode === "diagnostic";
                  const qn = mode === "full" ? Math.min(count ?? 0, meta.total) : count;
                  return (
                    <article key={mode} className={`card${featured ? " card--featured" : ""}`}>
                      <div className="card__head">
                        <span className={`tag${featured ? "" : " tag--neutral"}`}>{ui.tag}</span>
                        <Icon name={ui.icon} size="lg" className={featured ? "track-ico--blue" : "track-ico--muted"} />
                      </div>
                      <h3 className="t-h3">{titleCase(m.title)}</h3>
                      {empty ? (
                        <div className="empty">
                          <span className="empty__icon"><Icon name="inbox" /></span>
                          <p className="empty__title">Nothing to Review Yet</p>
                          <p className="empty__text">Questions you miss land here for spaced repetition.</p>
                        </div>
                      ) : (
                        <p className="mode-card__desc">{m.purpose}</p>
                      )}
                      <div className="card__foot">
                        {mode === "drill" && (
                          <Listbox
                            up
                            label="Domain"
                            value={domain}
                            onChange={setDomain}
                            options={meta.domains.map((d) => ({ value: d.name, label: d.name, hint: `${d.weight}%`, disabled: d.count === 0 }))}
                          />
                        )}
                        {mode === "full" && flags.examConditions && (
                          <label className="checkbox">
                            <input type="checkbox" checked={exam} onChange={(e) => setExam(e.target.checked)} />
                            <span>Exam conditions: hide feedback until the end</span>
                          </label>
                        )}
                        {mode === "full" && shortBank && (
                          <p className="track-note">
                            Preview: the bank has {meta.total} of the {def.items} items a full mock needs, so this mock is shorter until the bank grows.
                          </p>
                        )}
                        {!empty && (
                          <p className="mode-card__facts">
                            {mode === "review" ? (
                              <span><Icon name="list" size="sm" />{wrong} Missed Item{wrong === 1 ? "" : "s"}</span>
                            ) : (
                              <>
                                <span><Icon name="list" size="sm" />{qn} Questions</span>
                                <span><Icon name="clock" size="sm" />{mins} Min</span>
                              </>
                            )}
                            {mode === "review" && <span><Icon name="clock" size="sm" />Untimed</span>}
                          </p>
                        )}
                        <button
                          type="button"
                          className={`btn btn--block ${featured ? "btn--accent" : "btn--secondary"}`}
                          onClick={() => go(mode)}
                          disabled={empty || !!busy}
                        >
                          {busy === mode ? "Starting…" : empty ? "0 Missed Items" : ui.cta}
                        </button>
                      </div>
                    </article>
                  );
                })}
                {hasModules && (
                  <article className="card">
                    <div className="card__head">
                      <span className="tag tag--neutral">Skill Jar Courses</span>
                      <Icon name="file" size="lg" className="track-ico--muted" />
                    </div>
                    <h3 className="t-h3">By Module</h3>
                    <p className="mode-card__desc">Practice one Skill Jar course at a time. Pick a module and work through its questions.</p>
                    <div className="card__foot">
                      <p className="mode-card__facts">
                        <span><Icon name="layers" size="sm" />{meta.modules.length} Module{meta.modules.length === 1 ? "" : "s"}</span>
                        <span><Icon name="list" size="sm" />{MODULE_SIZE} Questions Each</span>
                      </p>
                      <button type="button" className="btn btn--secondary btn--block" onClick={() => setView("module")}>Browse Modules</button>
                    </div>
                  </article>
                )}
              </div>
            </div>

            {hasModules && (
              <div id="practice-panel-module" role="tabpanel" aria-labelledby="practice-tab-module" hidden={view !== "module"}>
                <ol className="module-list">
                  {meta.modules.map((m, i) => {
                    const n = Math.min(m.count, MODULE_SIZE);
                    return (
                      <li className="module-row" key={m.name}>
                        <span className="module-row__num">{String(i + 1).padStart(2, "0")}</span>
                        <div>
                          <p className="module-row__title">{m.name}</p>
                          <p className="module-row__desc">{m.description}</p>
                        </div>
                        <span className="module-row__meta">{n} Q · Timed or No Timer</span>
                        <button type="button" className="btn btn--secondary btn--sm" onClick={() => setPicking({ name: m.name, description: m.description, count: n })} disabled={!!moduleBusy}>
                          {moduleBusy === m.name ? "Starting…" : "Start"}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </div>
        </section>

        <section className="section section--muted" aria-labelledby="weights-title">
          <div className="container weights">
            <div className="stack stack--16">
              <span className="eyebrow">Exam Blueprint</span>
              <h2 className="t-h2" id="weights-title">{meta.domains.length} Official Domains, Weighted as the Exam Guide Weights Them</h2>
              <p className="t-sm t-muted measure">Full mocks and the diagnostic draw questions at these weights. Source: exam guide v1.0 (July 2026).</p>
            </div>
            <div className="domains">
              {meta.domains.map((d) => (
                <div className="domain" key={d.name}>
                  <div>
                    <span className="domain__name">{d.name}</span>
                    <span className="domain__weight">{d.count} practice questions</span>
                  </div>
                  <div className="progress progress--blue" role="img" aria-label={`${d.weight}% of the exam`}>
                    <div className="progress__fill" style={{ "--value": `${(d.weight / maxWeight) * 100}%` } as React.CSSProperties} />
                  </div>
                  <span className="domain__score">{d.weight}%</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      {picking && (
        <ModuleStartDialog
          title={`${picking.name}: ${picking.description}`}
          detail={`${picking.count} question${picking.count === 1 ? "" : "s"}`}
          seconds={questionSeconds}
          busy={moduleBusy === picking.name}
          onCancel={() => setPicking(null)}
          onStart={(secs) => void goModule(picking.name, secs)}
        />
      )}
      <SiteFooter />
    </>
  );
}
