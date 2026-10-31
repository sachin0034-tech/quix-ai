/** Per-question countdown of a module quiz. Stored with the attempt so a refresh cannot restart the clock. */
export interface QuestionTiming {
  /** When the question was first shown */
  startedAt: number;
  /** When the learner finished answering: the clock stops here */
  stoppedAt?: number;
  /** The time ran out before an answer was given */
  timedOut?: boolean;
  /** The learner paused this question's clock: a right answer earns half a point and it gets the longer time limit */
  paused?: boolean;
  /** Set while the clock is frozen by the pause */
  pausedAt?: number;
  /** Total time spent frozen, which does not count against the limit */
  pausedMs?: number;
  /** The time ran out and the learner has not yet chosen to continue (reveal the answer) or reattempt */
  expired?: boolean;
  /** The time ran out and the learner chose to try again: the clock stays stopped and the question earns no points */
  reattempt?: boolean;
}

/**
 * Milliseconds left on a question's clock. A question not shown yet has all of its time. A paused question's limit
 * is `pausedLimitMs` instead, and its clock stands still while frozen.
 */
export function remainingMs(t: QuestionTiming | undefined, now: number, limitMs: number, pausedLimitMs = limitMs): number {
  if (!t) return limitMs;
  if (t.timedOut) return 0;
  const limit = t.paused ? pausedLimitMs : limitMs;
  return Math.max(0, limit - ((t.pausedAt ?? t.stoppedAt ?? now) - t.startedAt - (t.pausedMs ?? 0)));
}

/** Freezes a question's clock: a right answer now earns half a point and it has the longer limit. */
export function pauseTiming(t: QuestionTiming | undefined, now: number): QuestionTiming {
  const base = t ?? { startedAt: now };
  return { ...base, paused: true, pausedAt: base.pausedAt ?? now };
}

/** Restarts a frozen clock; the frozen time is not counted. */
export function resumeTiming(t: QuestionTiming, now: number): QuestionTiming {
  if (t.pausedAt === undefined) return t;
  const { pausedAt, ...rest } = t;
  return { ...rest, pausedMs: (t.pausedMs ?? 0) + (now - pausedAt) };
}
