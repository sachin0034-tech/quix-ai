"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CheckResult, OptionLabel, PublicQuestion } from "@/types/quiz";
import { MODES, TRACKS } from "@/lib/blueprint";
import { flags } from "@/lib/config";
import { track as trackEvent } from "@/lib/analytics";
import {
  getAttempt,
  getLearner,
  getSeen,
  getSkillHistory,
  recordAnswer,
  saveAttempt,
  type StoredAnswer,
  type StoredAttempt,
} from "@/lib/client/store";
import { useEmailGate } from "@/components/EmailGate";
import TutorPanel from "@/components/TutorPanel";
import Header from "@/components/Header";

export default function QuizPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [attempt, setAttempt] = useState<StoredAttempt | null | undefined>(undefined);

  useEffect(() => {
    const a = getAttempt(params.id);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage after mount
    setAttempt(a);
    if (a?.finishedAt) router.replace(`/results/${a.id}`);
  }, [params.id, router]);

  if (attempt === undefined || attempt?.finishedAt) {
    return (
      <main style={{ padding: "96px 48px", textAlign: "center" }}>
        <p style={{ color: "var(--muted)" }}>Loading questions…</p>
      </main>
    );
  }
  if (attempt === null) {
    return (
      <main style={{ padding: "96px 48px", textAlign: "center" }}>
        <p style={{ color: "var(--muted)" }}>
          We couldn&apos;t find this attempt on this device.{" "}
          <Link href="/" style={{ color: "var(--navy)" }}>
            Start a new one
          </Link>
        </p>
      </main>
    );
  }
  return <QuizRunner attempt={attempt} />;
}

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function QuizRunner({ attempt }: { attempt: StoredAttempt }) {
  const router = useRouter();
  const gate = useEmailGate();
  const trackDef = TRACKS[attempt.track];
  const feedback = !attempt.examConditions;

  const [questions, setQuestions] = useState<PublicQuestion[]>(attempt.questions);
  const [answers, setAnswers] = useState<Record<number, StoredAnswer>>(attempt.answers);
  const [checks, setChecks] = useState<Record<number, CheckResult>>(attempt.checks);
  const [currentIdx, setCurrentIdx] = useState(Math.min(attempt.idx, attempt.questions.length - 1));
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const shownAt = useRef(0);

  // Mobile carousel — tracks which option card is currently visible (0–4)
  const [visibleOptIdx, setVisibleOptIdx] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  const total = attempt.total;
  const q = questions[currentIdx];
  const selected: OptionLabel[] = answers[q.id]?.picks ?? [];
  const picks = q.picks;
  const isMulti = picks > 1;
  const isComplete = (qq: PublicQuestion) => (answers[qq.id]?.picks.length ?? 0) === qq.picks;
  const currentComplete = selected.length === picks;
  const check = checks[q.id];
  // Feedback mode: the answer locks and is revealed once the server has checked it
  const revealed = feedback && !!check;
  const locked = revealed || checking || (feedback && currentComplete);
  const correctLabels = check?.keys ?? [];
  const currentCorrect = !!check?.correct;
  const isLast = currentIdx === total - 1;
  const isFirst = currentIdx === 0;
  const primaryDisabled = !currentComplete || (feedback && !revealed) || checking || finishing || gate.modalOpen;
  const primaryLabel = isLast ? "See my results →" : "Next question →";
  const deadline = attempt.limitSeconds ? attempt.startedAt + attempt.limitSeconds * 1000 : null;

  // Persist progress so a refresh resumes the attempt
  useEffect(() => {
    saveAttempt({ ...attempt, questions, answers, checks, idx: currentIdx });
  }, [attempt, questions, answers, checks, currentIdx]);

  useEffect(() => {
    shownAt.current = Date.now();
  }, [currentIdx]);

  useEffect(() => {
    trackEvent("module_started", { track: attempt.track, mode: attempt.mode, domain: attempt.domain });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    saveAttempt({ ...attempt, questions, answers, checks, idx: currentIdx, finishedAt: Date.now() });
    router.push(`/results/${attempt.id}`);
  }, [finishing, attempt, questions, answers, checks, currentIdx, router]);

  // Countdown: finishes the attempt when time runs out
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline]);
  const timeUp = !!deadline && now >= deadline;
  useEffect(() => {
    if (timeUp && !finishing) {
      const t = setTimeout(() => void finish(), 2500);
      return () => clearTimeout(t);
    }
  }, [timeUp, finishing, finish]);

  async function runCheck(qq: PublicQuestion, chosen: OptionLabel[]) {
    setChecking(true);
    setCheckError(false);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: attempt.seed, id: qq.id, picks: chosen, learner: getLearner() }),
      });
      if (!res.ok) throw new Error("check failed");
      const result = (await res.json()) as CheckResult;
      setChecks((prev) => ({ ...prev, [qq.id]: result }));
      recordAnswer(qq, result.correct);
      trackEvent("question_answered", {
        correct: result.correct,
        domain: qq.domain,
        subSkill: qq.subSkill,
        seconds: Math.round((answers[qq.id]?.ms ?? 0) / 1000),
        mode: attempt.mode,
      });
      gate.onAnswered();
    } catch {
      setCheckError(true);
    } finally {
      setChecking(false);
    }
  }

  // Single-answer questions lock on the first click; multi-answer questions toggle
  // until the required number is picked, then lock.
  function selectAnswer(label: OptionLabel) {
    if (locked || gate.modalOpen) return;
    const current = answers[q.id]?.picks ?? [];
    let next: OptionLabel[];
    if (!isMulti) next = [label];
    else if (current.includes(label)) next = current.filter((l) => l !== label);
    else if (current.length >= picks) return;
    else next = [...current, label].sort() as OptionLabel[];

    const ms = (answers[q.id]?.ms ?? 0) + (next.length === picks ? Date.now() - shownAt.current : 0);
    if (next.length === picks) shownAt.current = Date.now();
    setAnswers((prev) => ({ ...prev, [q.id]: { picks: next, ms } }));
    if (next.length === picks && feedback) void runCheck(q, next);
  }

  async function handleNext() {
    if (primaryDisabled) return;
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1);
    } else if (questions.length < total) {
      // Adaptive modes pick the next item from the learner's weakest sub-skill
      setChecking(true);
      try {
        const res = await fetch("/api/next", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seed: attempt.seed,
            track: attempt.track,
            domain: attempt.domain,
            askedIds: questions.map((x) => x.id),
            answered: [],
            history: getSkillHistory(attempt.track),
            seen: getSeen(),
          }),
        });
        const { question } = (await res.json()) as { question: PublicQuestion | null };
        if (!question) return void (await finish());
        setQuestions((prev) => [...prev, question]);
        setCurrentIdx((i) => i + 1);
      } catch {
        setCheckError(true);
      } finally {
        setChecking(false);
      }
    } else {
      await finish();
    }
  }

  function handleBack() {
    if (!isFirst) setCurrentIdx((i) => i - 1);
  }

  function handleFinishEarly() {
    const answered = questions.filter(isComplete).length;
    const missing = total - answered;
    if (missing > 0 && !window.confirm(`${missing} question${missing === 1 ? " is" : "s are"} unanswered and will count as incorrect. Finish now?`)) return;
    void finish();
  }

  // Mobile carousel helpers
  function scrollToOpt(idx: number) {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollLeft = idx * el.offsetWidth;
    setVisibleOptIdx(idx);
  }

  function handleCarouselScroll() {
    const el = carouselRef.current;
    if (!el) return;
    setVisibleOptIdx(Math.round(el.scrollLeft / el.offsetWidth));
  }

  // Keyboard handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (gate.modalOpen) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const optionLabels: OptionLabel[] = ["A", "B", "C", "D"];
      if (["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        const label = optionLabels[Number(e.key) - 1];
        if (label) selectAnswer(label);
      } else if (e.key === "Enter") {
        e.preventDefault();
        void handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (!isFirst) setCurrentIdx((i) => i - 1);
      } else if (e.key === "ArrowRight" && currentIdx < questions.length - 1) {
        e.preventDefault();
        if (!primaryDisabled) setCurrentIdx((i) => i + 1);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, isFirst, currentComplete, answers, checks, checking, finishing, questions.length, gate.modalOpen]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Reset carousel to first card when question changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset transient UI when the question changes
    setVisibleOptIdx(0);
    setCheckError(false);
    if (carouselRef.current) carouselRef.current.scrollLeft = 0;
  }, [currentIdx]);

  // Segment progress bar
  function segmentState(i: number) {
    const qq = questions[i];
    if (i === currentIdx) return "current";
    if (qq && isComplete(qq)) return "answered";
    return "default";
  }

  const segmentColors: Record<string, string> = {
    default: "rgba(255,255,255,.18)",
    current: "var(--accent)",
    answered: "rgba(255,255,255,1)",
  };

  type OptState = "default" | "selected" | "correct" | "wrong" | "dimmed";

  function optionState(label: OptionLabel): OptState {
    if (revealed) {
      if (correctLabels.includes(label)) return "correct";
      if (selected.includes(label)) return "wrong";
      return "dimmed";
    }
    return selected.includes(label) ? "selected" : "default";
  }

  // Tag shown on an option after the answer is checked
  function optionTag(label: OptionLabel): string | null {
    if (!revealed) return null;
    const picked = selected.includes(label);
    if (correctLabels.includes(label)) return picked ? "Your answer · Correct" : "Correct answer";
    return picked ? "Your answer · Incorrect" : null;
  }

  function getOptionStyles(state: OptState) {
    if (state === "correct" || state === "wrong") {
      const color = state === "correct" ? "var(--correct-text)" : "var(--incorrect-text)";
      return {
        wrapper: {
          border: `2px solid ${color}`,
          background: state === "correct" ? "var(--correct-bg)" : "var(--incorrect-bg)",
          color: "var(--ink)",
        },
        badge: { background: color, color: "#ffffff", border: "none" },
        text: { color: "var(--ink)" },
      };
    }
    if (state === "dimmed") {
      return {
        wrapper: {
          border: "1px solid var(--border)",
          background: "#ffffff",
          color: "var(--ink)",
          opacity: 0.6,
        },
        badge: {
          background: "#ffffff",
          color: "var(--muted)",
          border: "1px solid var(--border)",
        },
        text: { color: "var(--ink)" },
      };
    }
    if (state === "selected") {
      return {
        wrapper: {
          border: "2px solid var(--accent)",
          background: "#fff3e8",
          color: "var(--ink)",
        },
        badge: { background: "var(--accent)", color: "#ffffff", border: "none" },
        text: { color: "var(--ink)" },
      };
    }
    return {
      wrapper: {
        border: "1px solid var(--border)",
        background: "#ffffff",
        color: "var(--ink)",
      },
      badge: {
        background: "#ffffff",
        color: "var(--muted)",
        border: "1px solid var(--border)",
      },
      text: { color: "var(--ink)" },
    };
  }

  const modeTitle = `${trackDef.short} · ${MODES[attempt.mode].title}${attempt.domain ? `: ${attempt.domain}` : ""}`;
  const remaining = deadline ? deadline - now : null;

  return (
    <>
      <Header moduleTitle={modeTitle} />

      <div
        style={{
          minHeight: "calc(100vh - 64px)",
          display: "flex",
          flexDirection: "column",
          background: "var(--canvas)",
        }}
      >
        {/* ── Navy band ── */}
        <div
          style={{
            background: "var(--gradient)",
            padding: "28px 0 36px",
            flexShrink: 0,
          }}
        >
          <div
            className="quiz-band-inner"
            style={{ maxWidth: "860px", margin: "0 auto", padding: "0 48px" }}
          >
            {/* Row 1 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                marginBottom: "24px",
              }}
            >
              <Link
                href={`/${attempt.track}`}
                style={{
                  fontSize: "14px",
                  color: "var(--on-navy-2)",
                  textDecoration: "none",
                  flexShrink: 0,
                }}
              >
                ← All modules
              </Link>
              <div style={{ flex: 1 }} />
              {remaining !== null && (
                <span
                  role="timer"
                  aria-label={`Time remaining ${fmt(remaining)}`}
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: remaining < 300_000 ? "var(--accent)" : "#ffffff",
                    background: "rgba(255,255,255,.12)",
                    borderRadius: "var(--r-pill)",
                    padding: "4px 12px",
                    whiteSpace: "nowrap",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  ⏱ {fmt(remaining)}
                </span>
              )}
              <span
                style={{
                  fontSize: "14px",
                  color: "var(--on-navy-2)",
                  whiteSpace: "nowrap",
                }}
              >
                {questions.filter(isComplete).length} of {total} answered
              </span>
            </div>

            {attempt.examConditions && (
              <p style={{ margin: "-8px 0 14px", fontSize: "13px", color: "var(--on-navy-2)" }}>
                Exam conditions: feedback is hidden until you finish.
              </p>
            )}

            {/* Segmented progress */}
            <div
              role="progressbar"
              aria-valuenow={currentIdx + 1}
              aria-valuemin={1}
              aria-valuemax={total}
              aria-label={`Question ${currentIdx + 1} of ${total}`}
              style={{
                display: "flex",
                gap: "4px",
                alignItems: "center",
                height: "16px",
              }}
            >
              {Array.from({ length: total }, (_, i) => {
                const state = segmentState(i);
                return (
                  <div
                    key={i}
                    onClick={() => questions[i] && setCurrentIdx(i)}
                    style={{
                      flex: 1,
                      borderRadius: "var(--r-pill)",
                      background: segmentColors[state],
                      height: state === "current" ? "8px" : "4px",
                      transition: "background 0.2s, height 0.2s",
                      cursor: questions[i] ? "pointer" : "default",
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Content area ── */}
        <div style={{ flex: 1, padding: "40px 0 80px" }}>
          <div
            className="quiz-content-inner"
            style={{ maxWidth: "860px", margin: "0 auto", padding: "0 48px" }}
          >
            {/* Quiz card */}
            <div
              key={currentIdx}
              className="card-enter quiz-card"
              style={{
                background: "#ffffff",
                borderRadius: "var(--r-quiz-card)",
                boxShadow: "var(--shadow-feature)",
                padding: "40px",
              }}
            >
              {/* Card header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "24px",
                }}
              >
                <span
                  style={{
                    padding: "5px 14px",
                    borderRadius: "var(--r-pill)",
                    background: "var(--accent)",
                    color: "var(--navy)",
                    fontSize: "13px",
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                    flexShrink: 0,
                    fontFamily: "var(--font-manrope), sans-serif",
                  }}
                >
                  {String(currentIdx + 1).padStart(2, "0")}
                </span>
                <span style={{ fontSize: "14px", color: "var(--muted)" }}>
                  Question {currentIdx + 1} of {total} · {q.domain}
                </span>
              </div>

              {/* Question */}
              <p
                className="quiz-question"
                style={{
                  fontSize: "22px",
                  lineHeight: "32px",
                  fontWeight: 600,
                  color: "var(--ink)",
                  letterSpacing: "-0.02em",
                  margin: isMulti ? "0 0 14px" : "0 0 28px",
                }}
              >
                {q.question}
              </p>

              {isMulti && (
                <p
                  role="status"
                  aria-live="polite"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "8px",
                    fontSize: "14px",
                    color: "var(--ink)",
                    margin: "0 0 20px",
                  }}
                >
                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: "var(--r-pill)",
                      background: "#fff3e8",
                      border: "1px solid var(--accent)",
                      fontSize: "12px",
                      fontWeight: 700,
                      letterSpacing: "0.02em",
                    }}
                  >
                    Select {picks}
                  </span>
                  <span>
                    {revealed
                      ? `This question has ${picks} correct answers, and it is scored all-or-nothing.`
                      : `Select ${picks} options (${selected.length} of ${picks} selected).${feedback ? ` Your answer is checked once all ${picks} are picked.` : ""}`}
                  </span>
                </p>
              )}

              {/* Options — Desktop list (hidden on ≤460px) */}
              <div
                className="quiz-options-desktop"
                style={{ display: "flex", flexDirection: "column", gap: "10px" }}
              >
                {q.options.map((opt) => {
                  const state = optionState(opt.label);
                  const styles = getOptionStyles(state);
                  return (
                    <button
                      key={opt.label}
                      onClick={() => selectAnswer(opt.label)}
                      disabled={locked}
                      aria-pressed={selected.includes(opt.label)}
                      className={`option-btn${state === "selected" ? " option-selected" : ""}${revealed ? " option-answered" : ""}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        padding: "14px 18px",
                        borderRadius: "var(--r-option)",
                        textAlign: "left",
                        width: "100%",
                        cursor: revealed ? "default" : "pointer",
                        ...styles.wrapper,
                        transition: "all 0.15s",
                      }}
                    >
                      <span
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "var(--r-option)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "13px",
                          fontWeight: 600,
                          flexShrink: 0,
                          transition: "all 0.15s",
                          ...styles.badge,
                        }}
                      >
                        {opt.label}
                      </span>
                      <span
                        style={{ flex: 1, fontSize: "15px", lineHeight: "24px", ...styles.text }}
                      >
                        {opt.text}
                      </span>
                      {optionTag(opt.label) && (
                        <span
                          style={{
                            flexShrink: 0,
                            fontSize: "12px",
                            fontWeight: 700,
                            color: state === "correct" ? "var(--correct-text)" : "var(--incorrect-text)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {state === "correct" ? "✓ " : "✗ "}
                          {optionTag(opt.label)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Options — Mobile swipeable carousel (visible only on ≤460px) */}
              <div className="quiz-options-mobile">
                <p className="mobile-answer-label">Answer</p>

                {/* Swipeable card track */}
                <div
                  ref={carouselRef}
                  className="mobile-carousel"
                  onScroll={handleCarouselScroll}
                >
                  {q.options.map((opt) => {
                    const state = optionState(opt.label);
                    const styles = getOptionStyles(state);
                    return (
                      <div key={opt.label} className="mobile-option-slide">
                        <button
                          onClick={() => selectAnswer(opt.label)}
                          disabled={locked}
                          aria-pressed={selected.includes(opt.label)}
                          className="mobile-option-card"
                          style={styles.wrapper as React.CSSProperties}
                        >
                          <div
                            className="mobile-option-badge"
                            style={styles.badge as React.CSSProperties}
                          >
                            {opt.label}
                          </div>
                          <p
                            className="mobile-option-text"
                            style={{ color: (styles.text as React.CSSProperties).color }}
                          >
                            {opt.text}
                          </p>
                          {optionTag(opt.label) && (
                            <span
                              className={`result-tag ${state === "correct" ? "correct-tag-mobile" : "wrong-tag-mobile"}`}
                            >
                              {state === "correct" ? "✓ " : "✗ "}
                              {optionTag(opt.label)}
                            </span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Swipe hint */}
                <p className="mobile-swipe-hint" aria-hidden="true">
                  ← swipe →
                </p>

                {/* A / B / C / D navigation */}
                <div
                  className="mobile-carousel-nav"
                  role="group"
                  aria-label="Answer navigation"
                >
                  {q.options.map((opt, optIdx) => {
                    const isViewing = optIdx === visibleOptIdx;
                    const isChosen = selected.includes(opt.label);
                    const state = optionState(opt.label);
                    return (
                      <button
                        key={opt.label}
                        // Only scrolls to the card; tapping the card itself selects it,
                        // so viewing an option can't accidentally lock in an answer
                        onClick={() => scrollToOpt(optIdx)}
                        aria-label={`View option ${opt.label}${isChosen ? " (selected)" : ""}`}
                        className={
                          "mobile-nav-btn" +
                          (isViewing ? " mnb-viewing" : "") +
                          (isChosen ? " mnb-chosen" : "") +
                          (state === "correct" ? " mnb-correct" : "") +
                          (state === "wrong" ? " mnb-wrong" : "")
                        }
                      >
                        <span>{opt.label}</span>
                        {isChosen && (
                          <span className="mnb-dot" aria-hidden="true">
                            ●
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Answer feedback */}
              <div aria-live="polite">
                {revealed && check && (
                  <>
                    <div
                      style={{
                        marginTop: "20px",
                        padding: "12px 16px",
                        borderRadius: "var(--r-option)",
                        background: currentCorrect ? "var(--correct-bg)" : "var(--incorrect-bg)",
                        color: currentCorrect ? "#14532d" : "#991b1b",
                        fontSize: "15px",
                        fontWeight: 600,
                      }}
                    >
                      {currentCorrect
                        ? "✓ Correct!"
                        : `✗ Incorrect. The correct answer${correctLabels.length > 1 ? "s are" : " is"} ${correctLabels.join(" and ")}.`}
                    </div>
                    <div
                      style={{
                        marginTop: "12px",
                        padding: "14px 16px",
                        borderRadius: "var(--r-option)",
                        background: "var(--canvas)",
                        border: "1px solid var(--border)",
                        fontSize: "15px",
                        lineHeight: 1.65,
                        color: "var(--ink)",
                      }}
                    >
                      <strong style={{ display: "block", marginBottom: "4px", fontSize: "13px", letterSpacing: ".4px", textTransform: "uppercase", color: "var(--muted)" }}>
                        Explanation
                      </strong>
                      {check.explanation}
                    </div>
                    {flags.tutor && <TutorPanel key={q.id} question={q} seed={attempt.seed} answered />}
                  </>
                )}
                {!feedback && currentComplete && (
                  <p style={{ marginTop: "16px", fontSize: "14px", color: "var(--muted)" }}>Answer saved. You can change it until you finish.</p>
                )}
                {checking && !revealed && <p style={{ marginTop: "16px", fontSize: "14px", color: "var(--muted)" }}>Checking…</p>}
                {checkError && (
                  <p role="alert" style={{ marginTop: "16px", fontSize: "14px", color: "var(--incorrect-text)" }}>
                    ✗ Couldn&apos;t reach the server.{" "}
                    <button
                      onClick={() => (currentComplete && feedback && !check ? void runCheck(q, selected) : void handleNext())}
                      style={{ background: "none", border: "none", color: "var(--navy)", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", fontSize: "14px" }}
                    >
                      Retry
                    </button>
                  </p>
                )}
              </div>

              {/* Primary action + Back button row */}
              <div
                className="quiz-action-row"
                style={{
                  marginTop: "28px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                {/* Back */}
                <button
                  onClick={handleBack}
                  disabled={isFirst}
                  aria-label="Go to previous question"
                  style={{
                    padding: "14px 22px",
                    borderRadius: "9px",
                    border: "1.5px solid var(--border)",
                    background: "#ffffff",
                    color: isFirst ? "var(--disabled)" : "var(--ink)",
                    fontSize: "15px",
                    fontWeight: 600,
                    cursor: isFirst ? "not-allowed" : "pointer",
                    transition: "border-color 0.15s, color 0.15s",
                    flexShrink: 0,
                    minHeight: "52px",
                    fontFamily: "inherit",
                  }}
                >
                  ← Back
                </button>

                {/* Next only appears once the answer has been checked (feedback mode) */}
                <button
                  onClick={() => void handleNext()}
                  disabled={primaryDisabled}
                  className="quiz-primary-btn"
                  style={{
                    flex: 1,
                    padding: "14px 32px",
                    borderRadius: "9px",
                    border: "none",
                    background: primaryDisabled ? "var(--disabled)" : "var(--accent)",
                    color: primaryDisabled ? "#ffffff" : "var(--navy)",
                    fontSize: "16px",
                    fontWeight: 700,
                    cursor: primaryDisabled ? "not-allowed" : "pointer",
                    transition: "background 0.2s, transform 0.15s",
                    letterSpacing: "-0.01em",
                    minHeight: "52px",
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => {
                    if (!primaryDisabled) {
                      (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-hover)";
                      (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = primaryDisabled
                      ? "var(--disabled)"
                      : "var(--accent)";
                    (e.currentTarget as HTMLButtonElement).style.transform = "none";
                  }}
                >
                  {primaryLabel}
                </button>
              </div>
            </div>

            {/* Below card: keyboard hint + finish early */}
            <div style={{ marginTop: "16px", textAlign: "center", display: "grid", gap: "8px" }}>
              <span
                className="quiz-keyboard-hint"
                style={{ fontSize: "12px", color: "var(--muted)" }}
              >
                Use 1–4 to select · Enter to advance · ← → navigate
              </span>
              <button
                onClick={handleFinishEarly}
                style={{ background: "none", border: "none", color: "var(--muted)", textDecoration: "underline", cursor: "pointer", fontSize: "13px", fontFamily: "inherit" }}
              >
                Finish and see results
              </button>
            </div>
          </div>
        </div>
      </div>

      {timeUp && (
        <div role="alertdialog" aria-modal="true" aria-label="Time is up" style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(15,27,51,.8)", display: "grid", placeItems: "center", padding: "24px" }}>
          <div style={{ background: "#fff", borderRadius: "var(--r-feature)", padding: "32px", maxWidth: "420px", textAlign: "center" }}>
            <h2 style={{ margin: "0 0 8px", fontSize: "24px" }}>Time&apos;s up</h2>
            <p style={{ margin: 0, color: "var(--muted)" }}>Unanswered questions count as incorrect. Taking you to your results…</p>
          </div>
        </div>
      )}
    </>
  );
}
