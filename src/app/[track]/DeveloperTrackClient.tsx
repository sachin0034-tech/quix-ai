"use client";

import "../design/track.css";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FULL_MOCK_MAX_MINUTES, FULL_MOCK_MAX_QUESTIONS, FULL_MOCK_MIN_MINUTES, FULL_MOCK_MIN_QUESTIONS, LEVELS, MODULE_QUESTION_SECONDS, MODULE_SIZE, OPEN_LEVELS, TRACKS } from "@/lib/blueprint";
import type { TrackMeta } from "@/lib/bank";
import { startAttempt, startDevFullMock } from "@/lib/client/start";
import { track as trackEvent } from "@/lib/analytics";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import Icon from "@/components/Icon";
import Segmented, { type SegmentedOption } from "@/components/ui/Segmented";
import RangeField from "@/components/ui/RangeField";

type Screen = "home" | "full-mock-config";

/** What each level holds: its total question count, and the count of each module (Level 1 counts come from `meta`) */
export interface LevelCounts {
  total: Record<number, number>;
  modules: Record<number, Record<string, number>>;
}

const LEVEL_NOTE = "This level will be available in a future update.";
/** A level is locked until it is open and holds questions, so a level whose questions are not loaded yet stays locked */
const isLocked = (totals: Record<number, number>, lvl: number) => !OPEN_LEVELS.includes(lvl) || !((totals[lvl] ?? 0) > 0);
const levelOptions = (totals: Record<number, number>, describedBy?: string): SegmentedOption[] =>
  LEVELS.map((lvl) => {
    const locked = isLocked(totals, lvl);
    return { value: lvl, label: `Level ${lvl}`, disabled: locked, note: LEVEL_NOTE, describedBy: locked ? describedBy : undefined };
  });

export default function DeveloperTrackClient({ meta, levels }: { meta: TrackMeta; levels: LevelCounts }) {
  const router = useRouter();
  const def = TRACKS.developer;

  const [screen, setScreen] = useState<Screen>("home");
  const [level, setLevel] = useState(1);
  const [moduleLevels, setModuleLevels] = useState<Record<string, number>>({});
  const levelFor = (name: string) => moduleLevels[name] ?? 1;
  const [questionCount, setQuestionCount] = useState(53);
  const [timerMinutes, setTimerMinutes] = useState(120);
  const moduleTotal = levels.total[level] ?? 0;
  const [fullBusy, setFullBusy] = useState(false);
  const [moduleBusy, setModuleBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const configureBtnRef = useRef<HTMLButtonElement>(null);
  const configureTitleRef = useRef<HTMLHeadingElement>(null);
  const focusTarget = useRef<"title" | "button" | null>(null);

  useEffect(() => {
    trackEvent("track_selected", { track: "developer", via: "page" });
  }, []);

  useEffect(() => {
    if (focusTarget.current === "title") configureTitleRef.current?.focus();
    else if (focusTarget.current === "button") configureBtnRef.current?.focus();
    focusTarget.current = null;
  }, [screen]);

  async function startFullMock() {
    setFullBusy(true);
    setError("");
    const r = await startDevFullMock({ questionCount: Math.min(questionCount, moduleTotal), timerMinutes, level });
    if ("id" in r) router.push(`/quiz/${r.id}`);
    else {
      setError(r.error);
      setFullBusy(false);
    }
  }

  async function startModule(name: string) {
    setModuleBusy(name);
    setError("");
    const r = await startAttempt({ track: "developer", mode: "module", module: name, level: levelFor(name) });
    if ("id" in r) router.push(`/quiz/${r.id}`);
    else {
      setError(r.error);
      setModuleBusy(null);
    }
  }

  const countAt = (m: { name: string; count: number }) => {
    const lvl = levelFor(m.name);
    return lvl === 1 ? m.count : levels.modules[lvl]?.[m.name] ?? 0;
  };

  const modules = meta.modules.length > 0 ? meta.modules : [
    { name: "Module 1", description: "MSO Foundations", count: 23 },
    { name: "Module 2", description: "Production-Grade Prompting, Agents & Tool Use", count: 25 },
    { name: "Module 3", description: "Claude Code, MCP & Integration", count: 12 },
    { name: "Module 4", description: "Production Engineering, Evals & Security", count: 12 },
    { name: "Module 5", description: "Accelerators, IP & Deployment", count: 12 },
  ];

  const maxQuestions = Math.min(FULL_MOCK_MAX_QUESTIONS, moduleTotal);
  const effectiveCount = Math.max(FULL_MOCK_MIN_QUESTIONS, Math.min(questionCount, maxQuestions));

  return (
    <>
      <Header />
      <main id="main">
        <section className="page-head" aria-labelledby="track-title">
          <div className="container">
            <Link className="page-head__crumb" href="/#tracks"><Icon name="arrow-left" size="sm" />All Tracks</Link>
            <div className="stack stack--16">
              <span className="tag tag--on-navy">{def.code}</span>
              <h1 className="t-h1" id="track-title">{def.name}</h1>
              <p className="t-lead measure t-on-navy-muted">
                {def.audience} Choose Full Mock Exam to test across all 5 modules, or By Module to practice one course at a time.
              </p>
            </div>
          </div>
        </section>

        <section className="section section--soft-top" id="modes" aria-labelledby="modes-title">
          <div className="container">
            <div className="stack stack--16 stack--mb">
              <span className="eyebrow">Exam Modes</span>
              <h2 className="t-h2" id="modes-title">Pick How You Want to Practice</h2>
            </div>
            {error && <p role="alert" className="track-error">{error}</p>}

            {screen === "home" && (
              <div className="dev-modes">
                <article className="card card--lg card--featured">
                  <div className="card__head"><span className="tag">Exam Rehearsal</span><Icon name="calendar" size="lg" className="track-ico--blue" /></div>
                  <h3 className="t-h3">Full Mock Exam</h3>
                  <p className="mode-card__desc">Questions drawn from all 5 course modules. Set your level, timer, and question count before you start.</p>
                  <div className="card__foot">
                    <p className="mode-card__facts">
                      <span><Icon name="list" size="sm" />Up to {levels.total[1]} questions</span>
                      <span><Icon name="clock" size="sm" />Configurable timer</span>
                    </p>
                    <button
                      ref={configureBtnRef}
                      className="btn btn--accent btn--block"
                      type="button"
                      onClick={() => { focusTarget.current = "title"; setScreen("full-mock-config"); setError(""); }}
                    >
                      Configure
                    </button>
                  </div>
                </article>

                <article className="card card--lg">
                  <div className="card__head"><span className="tag tag--neutral">Focused Practice</span><Icon name="layers" size="lg" className="track-ico--muted" /></div>
                  <h3 className="t-h3">By Module</h3>
                  <p className="mode-card__desc">
                    Practice one course module at a time. {MODULE_QUESTION_SECONDS} seconds per question. Pause a question to skip it — it counts as incorrect but gives you 60 seconds to review.
                  </p>
                  <div className="card__foot">
                    <p className="mode-card__facts">
                      <span><Icon name="layers" size="sm" />{modules.length} modules</span>
                      <span><Icon name="list" size="sm" />Up to {MODULE_SIZE} questions each</span>
                      <span><Icon name="clock" size="sm" />{MODULE_QUESTION_SECONDS} sec/question</span>
                    </p>
                    <a className="btn btn--secondary btn--block" href="#by-module">Browse Modules <Icon name="arrow-down" /></a>
                  </div>
                </article>
              </div>
            )}

            {screen === "full-mock-config" && (
              <div className="card card--lg">
                <div className="cluster cluster--between">
                  <button className="btn btn--link" type="button" onClick={() => { focusTarget.current = "button"; setScreen("home"); }}>
                    <Icon name="arrow-left" size="sm" />Back
                  </button>
                  <span className="tag">Exam Rehearsal</span>
                </div>
                <h3 className="t-h3" ref={configureTitleRef} tabIndex={-1}>Configure Full Mock</h3>
                <div className="configure">
                  <div className="configure__col">
                    <div className="field">
                      <span className="field__label" id="mock-level-label">Level</span>
                      <Segmented labelledBy="mock-level-label" value={level} onChange={setLevel} options={levelOptions(levels.total, "locked-level-note")} />
                      {LEVELS.some((lvl) => isLocked(levels.total, lvl)) && <span className="field__hint" id="locked-level-note">{LEVEL_NOTE}</span>}
                    </div>
                  </div>
                  <div className="configure__col">
                    <RangeField
                      label="Number of Questions"
                      value={effectiveCount}
                      min={FULL_MOCK_MIN_QUESTIONS}
                      max={maxQuestions}
                      onChange={setQuestionCount}
                      endNote={`Max ${moduleTotal} questions (${modules.length} modules)`}
                    />
                    <RangeField
                      label="Time Limit (Minutes)"
                      value={timerMinutes}
                      min={FULL_MOCK_MIN_MINUTES}
                      max={FULL_MOCK_MAX_MINUTES}
                      onChange={setTimerMinutes}
                    />
                  </div>
                  <div className="configure__foot">
                    <p className="t-sm t-muted" aria-live="polite">
                      Recommended: ~{Math.round((timerMinutes * 60) / Math.max(1, effectiveCount))} seconds per question at current settings
                    </p>
                    <button className="btn btn--accent btn--lg" type="button" onClick={() => void startFullMock()} disabled={fullBusy}>
                      {fullBusy ? "Starting…" : `Start Full Mock (${effectiveCount}Q · ${timerMinutes} min)`}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="section section--muted section--anchor" id="by-module" aria-labelledby="bm-title">
          <div className="container">
            <div className="section-head">
              <span className="eyebrow">By Module</span>
              <h2 className="t-h2" id="bm-title">Practice One Module at a Time</h2>
              <p className="t-muted measure">{MODULE_QUESTION_SECONDS} seconds per question. Pause a question to mark it incorrect and get 60 seconds to study the answer before moving on.</p>
            </div>
            <div className="module-grid">
              {modules.map((m) => {
                const n = Math.min(countAt(m), MODULE_SIZE);
                return (
                  <article className="card" key={m.name}>
                    <span className="mode-grid__num">{m.name}</span>
                    <h3 className="t-h4">{m.description}</h3>
                    <Segmented ariaLabel={`${m.name} level`} value={levelFor(m.name)} onChange={(lvl) => setModuleLevels((prev) => ({ ...prev, [m.name]: lvl }))} options={levelOptions(levels.total)} />
                    <div className="card__foot">
                      <p className="mode-card__facts">
                        <span><Icon name="list" size="sm" />{n} question{n === 1 ? "" : "s"}</span>
                        <span><Icon name="clock" size="sm" />{MODULE_QUESTION_SECONDS} sec each</span>
                        <span>Pause available</span>
                      </p>
                      <button className="btn btn--secondary btn--block" type="button" onClick={() => void startModule(m.name)} disabled={!!moduleBusy}>
                        {moduleBusy === m.name ? "Starting…" : <>Start Level {levelFor(m.name)} <Icon name="arrow-right" /></>}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
