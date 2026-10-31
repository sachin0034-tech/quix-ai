"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import type { CheckResult, OptionLabel, PublicQuestion } from "@/types/quiz";
import { MODES, MODULE_QUESTION_SECONDS, TRACKS } from "@/lib/blueprint";
import { pauseTiming, remainingMs, type QuestionTiming } from "@/lib/question-timer";
import { track as trackEvent } from "@/lib/analytics";
import {
  getAttempt,
  getLearner,
  getSeen,
  getSkillHistory,
  recordAnswer,
  recordDemoAnswer,
  saveAttempt,
  type StoredAnswer,
  type StoredAttempt,
} from "@/lib/client/store";
import { useEmailGate } from "@/components/EmailGate";
import Icon from "@/components/Icon";
import Modal from "@/components/Modal";
import Header from "@/components/Header";
import RichText from "@/components/RichText";
import "@/app/design/quiz.css";

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
      <main className="quiz-main container container--narrow">
        <p className="checking" role="status">
          <span className="checking__dot" aria-hidden="true" />
          Loading Questions…
        </p>
      </main>
    );
  }
  if (attempt === null) {
    return (
      <main className="quiz-main container container--narrow">
        <p className="t-muted">
          We couldn&apos;t find this attempt on this device.{" "}
          <Link className="btn btn--link" href="/">
            Start a New One
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
  const [pauseHintFor, setPauseHintFor] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const shownAt = useRef(0);
  // Module quizzes give each question its own clock
  /** Module quizzes: the learner's chosen seconds per question; null = no timer, so no pause and full points */
  const questionSeconds = attempt.questionSeconds === undefined ? MODULE_QUESTION_SECONDS : attempt.questionSeconds;
  const perQ = attempt.mode === "module" && questionSeconds !== null ? questionSeconds * 1000 : null;
  const [timing, setTiming] = useState<Record<number, QuestionTiming>>(attempt.qTiming ?? {});
  const [showTimeUp, setShowTimeUp] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const qTextRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const mounted = useRef(false);
  const focusNextOnReveal = useRef(false);

  const total = attempt.total;
  const q = questions[currentIdx];
  const selected: OptionLabel[] = answers[q.id]?.picks ?? [];
  const picks = q.picks;
  const isMulti = picks > 1;
  const isComplete = (qq: PublicQuestion) => (answers[qq.id]?.picks.length ?? 0) === qq.picks;
  const currentComplete = selected.length === picks;
  const check = checks[q.id];
  const qTime = timing[q.id];
  const timedOut = !!qTime?.timedOut;
  /** The learner paused this question: a right answer earns half a point and it has the longer limit */
  const paused = !!qTime?.paused;
  /** The clock is frozen for good: a pause cannot be undone, but the learner can still answer */
  const frozen = paused && qTime?.pausedAt !== undefined;
  /** Answered, out of time, or paused: the question is settled and the learner can go on */
  const resolved = currentComplete || timedOut || paused;
  /** The clock runs from the moment the question is shown until an answer is complete or the time is gone */
  const clockRunning = perQ !== null && !currentComplete && !timedOut && !check && !frozen;
  const qRemaining = perQ === null ? null : remainingMs(qTime, now, perQ);
  const limitMs = perQ === null ? 0 : perQ;
  // Feedback mode: the answer locks and is revealed once the server has checked it
  const revealed = feedback && !!check;
  const locked = revealed || checking || (feedback && currentComplete);
  const correctLabels = check?.keys ?? [];
  const currentCorrect = !!check?.correct;
  /** Right answer with the timer paused: half a point, shown in yellow rather than red */
  const halfCredit = check?.credit === 0.5;
  const isLast = currentIdx === total - 1;
  const isFirst = currentIdx === 0;
  const primaryDisabled = !resolved || (feedback && !revealed && !paused) || checking || finishing || gate.modalOpen;
  const primaryLabel = isLast ? "See Results" : "Next Question";
  const deadline = attempt.limitSeconds ? attempt.startedAt + attempt.limitSeconds * 1000 : null;

  // Persist progress so a refresh resumes the attempt
  useEffect(() => {
    saveAttempt({ ...attempt, questions, answers, checks, idx: currentIdx, qTiming: timing });
  }, [attempt, questions, answers, checks, currentIdx, timing]);

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
    saveAttempt({ ...attempt, questions, answers, checks, idx: currentIdx, qTiming: timing, finishedAt: Date.now() });
    router.push(`/results/${attempt.id}`);
  }, [finishing, attempt, questions, answers, checks, currentIdx, timing, router]);

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

  // Start a question's clock the first time it is shown (stored, so refreshing the page does not restart it)
  useEffect(() => {
    if (perQ === null || check || timing[q.id]) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start the clock when a question is first shown
    setTiming((prev) => ({ ...prev, [q.id]: { startedAt: Date.now() } }));
  }, [perQ, q.id, check, timing]);

  // Tick while a clock is running
  useEffect(() => {
    if (!clockRunning) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [clockRunning]);

  // Out of time: stop the clock, fetch the correct answer and tell the learner
  const outOfTime = clockRunning && !!qTime && qRemaining !== null && qRemaining <= 0;
  useEffect(() => {
    if (outOfTime) void runTimeout(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outOfTime, q.id]);

  /** Freezes this question's clock: a right answer now earns half a point, the clock stays stopped, and the learner can still answer */
  function pauseClock() {
    if (!clockRunning) return;
    const at = Date.now();
    // The first pause of the session gets a gentle inline reminder, never a popup
    if (!Object.values(timing).some((t) => t.paused)) setPauseHintFor(q.id);
    setTiming((prev) => ({ ...prev, [q.id]: pauseTiming(prev[q.id], at) }));
    setNow(at);
    trackEvent("question_timer_paused", { track: attempt.track, mode: attempt.mode, domain: q.domain });
  }

  async function runTimeout(qq: PublicQuestion) {
    setTiming((prev) => ({ ...prev, [qq.id]: { ...prev[qq.id], startedAt: prev[qq.id]?.startedAt ?? Date.now(), pausedAt: undefined, timedOut: true } }));
    setChecking(true);
    setCheckError(false);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: attempt.seed, id: qq.id, picks: [], timedOut: true, learner: getLearner(), mode: attempt.mode, module: attempt.module }),
      });
      if (!res.ok) throw new Error("check failed");
      const result = (await res.json()) as CheckResult;
      setChecks((prev) => ({ ...prev, [qq.id]: result }));
      recordAnswer(qq, false);
      trackEvent("question_answered", { correct: false, timedOut: true, domain: qq.domain, subSkill: qq.subSkill, seconds: questionSeconds, mode: attempt.mode });
      setShowTimeUp(true);
    } catch {
      setCheckError(true);
    } finally {
      setChecking(false);
    }
  }

  async function runCheck(qq: PublicQuestion, chosen: OptionLabel[]) {
    setChecking(true);
    setCheckError(false);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: attempt.seed, id: qq.id, picks: chosen, paused: !!timing[qq.id]?.paused, learner: getLearner(), mode: attempt.mode, module: attempt.module }),
      });
      if (!res.ok) throw new Error("check failed");
      const result = (await res.json()) as CheckResult;
      setChecks((prev) => ({ ...prev, [qq.id]: result }));
      focusNextOnReveal.current = true;
      // The demo is kept out of the learner's practice history; it only counts towards the email gate
      if (attempt.mode === "demo") recordDemoAnswer();
      else recordAnswer(qq, result.credit > 0);
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
    if (locked || gate.modalOpen || outOfTime || showTimeUp) return;
    const current = answers[q.id]?.picks ?? [];
    let next: OptionLabel[];
    if (!isMulti) next = [label];
    else if (current.includes(label)) next = current.filter((l) => l !== label);
    else if (current.length >= picks) return;
    else next = [...current, label].sort() as OptionLabel[];

    const ms = (answers[q.id]?.ms ?? 0) + (next.length === picks ? Date.now() - shownAt.current : 0);
    if (next.length === picks) shownAt.current = Date.now();
    setAnswers((prev) => ({ ...prev, [q.id]: { picks: next, ms } }));
    // Answering stops this question's clock
    if (next.length === picks && perQ !== null) {
      const stopped = Date.now();
      setTiming((prev) => (prev[q.id]?.stoppedAt ? prev : { ...prev, [q.id]: { startedAt: prev[q.id]?.startedAt ?? stopped, stoppedAt: stopped } }));
    }
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

  /** Questions the learner has settled with a real answer (paused ones earn at most half a point) */
  const answeredCount = questions.filter((qq) => isComplete(qq) && !timing[qq.id]?.paused).length;
  const missingCount = total - answeredCount;
  const correctCount = questions.filter((qq) => checks[qq.id]?.correct).length;

  function handleFinishEarly() {
    setFinishOpen(true);
  }

  // Keyboard handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (gate.modalOpen || finishOpen) return;
      if (showTimeUp) {
        // The "time's up" popup is open: Enter closes it, nothing else reacts
        if (e.key === "Enter") {
          e.preventDefault();
          setShowTimeUp(false);
        }
        return;
      }
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.closest('[role="listbox"]') || e.metaKey || e.ctrlKey || e.altKey) return;
      const optionLabels: OptionLabel[] = ["A", "B", "C", "D", "E"];
      const letterIdx = optionLabels.indexOf(e.key.toUpperCase() as OptionLabel);
      if (["1", "2", "3", "4", "5"].includes(e.key) || letterIdx > -1) {
        e.preventDefault();
        const label = letterIdx > -1 ? optionLabels[letterIdx] : optionLabels[Number(e.key) - 1];
        if (label && q.options.some((o) => o.label === label)) selectAnswer(label);
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
    [q, isFirst, currentComplete, resolved, showTimeUp, answers, checks, checking, finishing, questions.length, gate.modalOpen, finishOpen]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // New question: clear transient UI and move focus to the question text
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset transient UI when the question changes
    setShowTimeUp(false);
    setCheckError(false);
    if (mounted.current) {
      qTextRef.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else mounted.current = true;
  }, [currentIdx]);

  // After a fresh answer is revealed, move focus to Next so keyboard users can continue
  useEffect(() => {
    if (focusNextOnReveal.current && revealed && !gate.modalOpen && !showTimeUp) {
      focusNextOnReveal.current = false;
      nextRef.current?.focus();
    }
  }, [revealed, gate.modalOpen, showTimeUp]);

  // Segment progress bar: answered segments show the result once it is known, the current one is navy
  function segmentClass(i: number) {
    const qq = questions[i];
    const c = qq && checks[qq.id];
    if (c && feedback) return c.correct ? "is-correct" : c.credit === 0.5 ? "is-partial" : "is-incorrect";
    if (qq && (isComplete(qq) || timing[qq.id]?.timedOut || timing[qq.id]?.paused)) return "is-answered";
    return i === currentIdx ? "is-current" : "";
  }

  /** Status shown next to each question in the navigator */
  function navStatus(i: number): { text: string; tone: "" | "is-correct" | "is-partial" | "is-incorrect" } {
    const qq = questions[i];
    const c = qq && checks[qq.id];
    if (c && feedback) {
      if (c.correct) return { text: "Correct", tone: "is-correct" };
      return c.credit === 0.5 ? { text: "Half Point", tone: "is-partial" } : { text: "Incorrect", tone: "is-incorrect" };
    }
    if (qq && isComplete(qq)) return { text: "Answered", tone: "" };
    return { text: "Unanswered", tone: "" };
  }

  type OptState = "default" | "selected" | "correct" | "partial" | "wrong" | "dimmed";

  function optionState(label: OptionLabel): OptState {
    if (revealed) {
      if (correctLabels.includes(label)) return halfCredit ? "partial" : "correct";
      if (selected.includes(label)) return "wrong";
      return "dimmed";
    }
    return selected.includes(label) ? "selected" : "default";
  }

  // Tag shown on an option after the answer is checked
  function optionTag(label: OptionLabel): string | null {
    if (!revealed) return null;
    const picked = selected.includes(label);
    if (correctLabels.includes(label)) return picked ? (halfCredit ? "Your Answer · Half Point" : "Your Answer · Correct") : "Correct Answer";
    return picked ? "Your Answer" : null;
  }

  const modeTitle = `${trackDef.short} · ${MODES[attempt.mode].title}${attempt.domain ? `: ${attempt.domain}` : ""}${attempt.module ? `: ${attempt.module}` : ""}${attempt.level ? ` · Level ${attempt.level}` : ""}`;
  const remaining = deadline ? deadline - now : null;
  const lowQ = clockRunning && qRemaining !== null && qRemaining <= 10_000;
  const navItems = questions.map((_, i) => ({ i, ...navStatus(i) }));
  const correctWord = `The correct answer${correctLabels.length > 1 ? "s are" : " is"} ${correctLabels.join(" and ")}`;

  return (
    <div className="quiz-page">
      <a className="skip-link" href="#q-card">Skip to Question</a>
      <Header moduleTitle={modeTitle} />

      {/* Quiz bar: back, progress, clock(s), navigator */}
      <div className="quiz-bar">
        <div className="container quiz-bar__inner">
          <Link className="quiz-bar__back" href={`/${attempt.track}`} aria-label="All Modules">
            <Icon name="arrow-left" />
            <span className="label">All Modules</span>
          </Link>
          <div className="quiz-bar__progress">
            <span className="quiz-bar__count" aria-live="polite">
              {questions.filter(isComplete).length} of {total} answered
            </span>
            <div className="segments" style={{ "--count": total } as React.CSSProperties} aria-hidden="true">
              {Array.from({ length: total }, (_, i) => (
                <span key={i} className={`segments__item ${segmentClass(i)}`} />
              ))}
            </div>
          </div>
          <div className="quiz-bar__tools">
            {qRemaining !== null && perQ !== null && (
              <span
                className={`timer${lowQ ? " is-warning" : ""}${!clockRunning ? " is-paused" : ""}`}
                role="timer"
                aria-label={`Time left for this question ${fmt(qRemaining)}${clockRunning ? "" : ", stopped"}`}
              >
                <Icon name="clock" size="sm" />
                <span className="timer__value">{fmt(qRemaining)}</span>
              </span>
            )}
            {attempt.mode === "module" && perQ !== null && clockRunning && !check && (
              <button type="button" className="btn btn--secondary btn--sm" onClick={pauseClock}>
                Pause Timer (half points)
              </button>
            )}
            {remaining !== null && (
              <span className={`timer${remaining < 300_000 ? " is-warning" : ""}`} role="timer" aria-label={`Time remaining ${fmt(remaining)}`}>
                <Icon name="clock" size="sm" />
                <span className="timer__value">{fmt(remaining)}</span>
              </span>
            )}
            <QuestionNav items={navItems} current={currentIdx} total={total} onSelect={setCurrentIdx} />
          </div>
        </div>
        {qRemaining !== null && perQ !== null && (
          <div className="container quiz-timebar">
            <div className="quiz-timebar__track" aria-hidden="true">
              <div
                className={`quiz-timebar__fill${clockRunning ? " is-running" : ""}${lowQ ? " is-low" : ""}`}
                style={{ "--value": `${Math.round((qRemaining / limitMs) * 100)}%` } as React.CSSProperties}
              />
            </div>
            <p className="quiz-timebar__note">
              {timedOut
                ? "Time's up for this question."
                : paused && !currentComplete
                  ? "Timer paused. Take your time and pick your answer: this question earns at most half a point."
                  : clockRunning
                    ? `${questionSeconds} seconds per question. Answer before it runs out.`
                    : "Clock stopped. Continue when you are ready."}
            </p>
            {pauseHintFor === q.id && paused && !check && (
              <p className="quiz-timebar__hint" role="status">
                A gentle reminder: a paused question earns at most half a point, even with the right answer.
              </p>
            )}
          </div>
        )}
      </div>

      <main className="quiz-main">
        <div className="container container--narrow">
          {attempt.examConditions && <p className="quiz-note">Exam conditions: feedback is hidden until you finish.</p>}

          <section className="q-card" id="q-card" aria-label="Question">
            <p className="q-meta">
              <span className="q-meta__num">Question {currentIdx + 1} of {total}</span>
              <span aria-hidden="true">·</span>
              <span>{q.domain}</span>
            </p>
            <h1 className={`q-text${isMulti ? " q-text--multi" : ""}`} id="q-text" tabIndex={-1} ref={qTextRef}>
              <RichText text={q.question} />
            </h1>

            {isMulti && (
              <p className="q-meta q-select" role="status" aria-live="polite">
                <span className="tag">Select {picks}</span>
                <span>
                  {revealed
                    ? `This question has ${picks} correct answers, and it is scored all-or-nothing.`
                    : `Select ${picks} options (${selected.length} of ${picks} selected).${feedback ? ` Your answer is checked once all ${picks} are picked.` : ""}`}
                </span>
              </p>
            )}

            <div className="options" role="group" aria-labelledby="q-text">
              {q.options.map((opt) => {
                const state = optionState(opt.label);
                const tag = optionTag(opt.label);
                const cls = state === "selected" ? " is-selected" : state === "correct" ? " is-correct" : state === "partial" ? " is-partial" : state === "wrong" ? " is-incorrect" : state === "dimmed" ? " is-dimmed" : "";
                return (
                  <button
                    key={opt.label}
                    type="button"
                    className={`option${cls}`}
                    onClick={() => selectAnswer(opt.label)}
                    disabled={locked}
                    aria-pressed={selected.includes(opt.label)}
                    aria-describedby={revealed ? "feedback" : undefined}
                  >
                    <span className="option__key" aria-hidden="true">{opt.label}</span>
                    <span className="option__text">
                      <span className="sr-only">Option {opt.label}: </span>
                      <RichText text={opt.text} />
                    </span>
                    {tag && (
                      <span className="option__status">
                        <Icon name={state === "correct" || state === "partial" ? "check" : "x"} size="sm" />
                        {tag}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div role="status" aria-live="polite">
              {revealed && check && (
                <div className={`feedback feedback--${currentCorrect ? "correct" : halfCredit ? "partial" : "incorrect"}`} id="feedback">
                  <p className="feedback__status">
                    <Icon name={currentCorrect || halfCredit ? "check" : "x"} />
                    {currentCorrect
                      ? "Correct."
                      : timedOut
                        ? `Time's Up. ${correctWord}.`
                        : halfCredit
                          ? `Half a point (0.5). Your answer is right, but the timer was paused. Time on this question: ${fmt(answers[q.id]?.ms ?? 0)}.`
                          : `Incorrect. ${correctWord}.`}
                  </p>
                  <p className="feedback__label">Explanation</p>
                  <p className="feedback__text">{check.explanation}</p>
                  {!!check.resources?.length && (
                    <div className="feedback__resource">
                      <span className="t-muted">Read More on Skill Jar:</span>
                      {check.resources.map((r) => (
                        <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer">
                          {r.title}
                          <Icon name="external" size="sm" />
                          <span className="sr-only">(opens in a new tab)</span>
                        </a>
                      ))}
                      <span className="note">Opens in a new tab. You need a Skill Jar account to open the course.</span>
                    </div>
                  )}
                </div>
              )}
              {!feedback && currentComplete && <p className="quiz-note">Answer saved. You can change it until you finish.</p>}
              {checking && !revealed && (
                <p className="checking">
                  <span className="checking__dot" aria-hidden="true" />
                  Checking…
                </p>
              )}
              {checkError && (
                <p role="alert" className="quiz-error">
                  <Icon name="x" size="sm" />
                  Couldn&apos;t reach the server.
                  <button
                    type="button"
                    className="btn btn--link"
                    onClick={() => (timedOut && !check ? void runTimeout(q) : currentComplete && feedback && !check ? void runCheck(q, selected) : void handleNext())}
                  >
                    Retry
                  </button>
                </p>
              )}
            </div>

            <div className="q-actions">
              <button type="button" className="btn btn--secondary" onClick={handleBack} disabled={isFirst} aria-label="Previous Question">
                <Icon name="arrow-left" />
                <span className="label">Back</span>
              </button>
              <button type="button" className="btn btn--accent" ref={nextRef} onClick={() => void handleNext()} disabled={primaryDisabled}>
                {primaryLabel}
              </button>
            </div>
          </section>

          <div className="quiz-foot">
            <button className="btn btn--link" type="button" onClick={handleFinishEarly}>
              Finish and See Results
            </button>
          </div>
        </div>
      </main>

      {finishOpen && (
        <Modal role="alertdialog" labelledBy="finish-title" describedBy="finish-text" onClose={() => setFinishOpen(false)}>
          <h2 className="modal__title" id="finish-title">Finish and See Results?</h2>
          <div className={`modal__summary${feedback ? "" : " modal__summary--2"}`}>
            <div><strong>{answeredCount}</strong><span>Answered</span></div>
            {feedback && <div><strong className="is-success">{correctCount}</strong><span>Correct</span></div>}
            <div><strong>{missingCount}</strong><span>Unanswered</span></div>
          </div>
          <p className="modal__text" id="finish-text">
            {missingCount > 0
              ? `${missingCount} ${missingCount === 1 ? "question is" : "questions are"} unanswered and will count as incorrect.`
              : "You've answered every question."}
          </p>
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" data-autofocus onClick={() => setFinishOpen(false)}>Keep Going</button>
            <button
              type="button"
              className="btn btn--accent"
              onClick={() => {
                setFinishOpen(false);
                void finish();
              }}
            >
              See Results
            </button>
          </div>
        </Modal>
      )}

      {showTimeUp && timedOut && check && (
        <Modal role="alertdialog" labelledBy="qtimeup-title" onClose={() => setShowTimeUp(false)}>
          <h2 className="modal__title" id="qtimeup-title">Time&apos;s Up</h2>
          <p className="modal__text">
            You ran out of the {questionSeconds} seconds for this question, so it counts as missed. The correct answer{correctLabels.length > 1 ? "s are" : " is"}:
          </p>
          <div className="options">
            {q.options.filter((o) => correctLabels.includes(o.label)).map((o) => (
              <div key={o.label} className="option is-correct">
                <span className="option__key" aria-hidden="true">{o.label}</span>
                <span className="option__text"><RichText text={o.text} /></span>
                <span className="option__status"><Icon name="check" size="sm" />Correct Answer</span>
              </div>
            ))}
          </div>
          <div className="modal__actions">
            <button type="button" className="btn btn--accent" data-autofocus onClick={() => setShowTimeUp(false)}>Continue</button>
          </div>
        </Modal>
      )}

      {timeUp && (
        <Modal role="alertdialog" labelledBy="timeup-title" describedBy="timeup-text" required>
          <h2 className="modal__title" id="timeup-title">Time&apos;s Up</h2>
          <p className="modal__text" id="timeup-text">Unanswered questions count as incorrect. Taking you to your results…</p>
        </Modal>
      )}
    </div>
  );
}

/** Jump-to-question listbox (prototype `.listbox`): arrow keys, Home/End, Enter/Space, Esc restores focus to the button */
function QuestionNav({
  items,
  current,
  total,
  onSelect,
}: {
  items: { i: number; text: string; tone: "" | "is-correct" | "is-partial" | "is-incorrect" }[];
  current: number;
  total: number;
  onSelect: (i: number) => void;
}) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(current);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const n = items.length;

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) btnRef.current?.focus();
  };
  const openList = () => {
    setActive(current);
    setOpen(true);
  };
  const choose = (i: number) => {
    onSelect(i);
    close();
  };

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);
  useEffect(() => {
    if (open) document.getElementById(`${uid}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, uid]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function onListKey(e: React.KeyboardEvent) {
    e.stopPropagation();
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % n); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + n) % n); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(n - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(active); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "Tab") close(false);
  }

  return (
    <div className="listbox quiz-nav" ref={rootRef}>
      <button
        ref={btnRef}
        className="listbox__button"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Jump to Question"
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            openList();
          }
        }}
      >
        <span className="listbox__value">{current + 1} / {total}</span>
        <Icon name="chevron-down" size="sm" />
      </button>
      <ul
        ref={listRef}
        className="listbox__list"
        role="listbox"
        tabIndex={-1}
        aria-label="Questions"
        aria-activedescendant={`${uid}-${active}`}
        hidden={!open}
        onKeyDown={onListKey}
      >
        {items.map((it) => (
          <li
            key={it.i}
            id={`${uid}-${it.i}`}
            role="option"
            aria-selected={it.i === current}
            className={`listbox__option${it.i === active ? " is-active" : ""}`}
            onClick={() => choose(it.i)}
          >
            <span>Question {it.i + 1}</span>
            <span className={`weight quiz-nav__status ${it.tone}`}>
              {it.tone === "is-correct" && <Icon name="check" size="sm" />}
              {it.tone === "is-incorrect" && <Icon name="x" size="sm" />}
              {it.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
