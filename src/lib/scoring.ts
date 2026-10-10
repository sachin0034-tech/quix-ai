import type {
  AttemptAnswer,
  BankQuestion,
  DomainStat,
  LiftItem,
  MissedItem,
  ModeId,
  OptionLabel,
  ResultSummary,
  SubSkillStat,
  TrackId,
} from "@/types/quiz";
import { PACE_SECONDS, PASS_SCORE, READY_SCORE, SCORE_MAX, SCORE_MIN } from "@/lib/config";
import type { DomainDef } from "@/lib/blueprint";
import { isCorrectAnswer, parseAnswer } from "@/lib/answers";

/** Accuracy (0..1) that corresponds to the "ready" readiness score of 800. */
export const READY_PCT = (READY_SCORE - SCORE_MIN) / (SCORE_MAX - SCORE_MIN);
/** Accuracy that corresponds to the 720 pass line on the linear estimate. */
export const PASS_PCT = (PASS_SCORE - SCORE_MIN) / (SCORE_MAX - SCORE_MIN);

/**
 * Readiness estimate on the official 100-1000 scale.
 *
 * Anthropic publishes no conversion from percent-correct to scaled score, so this is a transparent
 * linear mapping of the domain-weighted accuracy: score = 100 + 900 x accuracy. 720 lands at about
 * 69% weighted accuracy. It is an ESTIMATE and is labelled as such everywhere it appears.
 */
export function estimateReadiness(domains: { weight: number; pct: number | null }[]): number | null {
  const asked = domains.filter((d) => d.pct !== null);
  const totalWeight = asked.reduce((n, d) => n + d.weight, 0);
  if (!asked.length || totalWeight === 0) return null;
  const acc = asked.reduce((n, d) => n + d.weight * (d.pct as number), 0) / totalWeight;
  return Math.round(SCORE_MIN + (SCORE_MAX - SCORE_MIN) * acc);
}

/** "Ready" = estimate at or above 800 on each of the last two full mocks. */
export function isReady(fullMockReadiness: number[]): boolean {
  const last = fullMockReadiness.slice(-2);
  return last.length === 2 && last.every((r) => r >= READY_SCORE);
}

export interface ScoreInput {
  track: TrackId;
  /** The domains of this track as defined in the database */
  domains: DomainDef[];
  mode: ModeId;
  domainFilter?: string;
  /** Every question that was asked, in order */
  asked: BankQuestion[];
  answers: AttemptAnswer[];
  /** Resolves a stored answer key to the labels shown for this attempt */
  keysFor: (q: BankQuestion) => OptionLabel[];
  /** Options as displayed (for the missed-question list) */
  optionsFor: (q: BankQuestion) => { label: OptionLabel; text: string }[];
  explain: (q: BankQuestion) => string;
  totalSeconds: number;
}

export function modeProducesReadiness(mode: ModeId): boolean {
  return mode === "full" || mode === "diagnostic";
}

export function computeResult(input: ScoreInput): ResultSummary {
  const { track, mode, asked, answers, keysFor, optionsFor, explain } = input;
  const defDomains = input.domains;
  const byId = new Map(answers.map((a) => [a.id, a]));

  const domainAcc = new Map<string, { correct: number; total: number }>();
  const subAcc = new Map<string, { correct: number; total: number }>();
  const missed: MissedItem[] = [];
  let correct = 0;
  let unanswered = 0;
  let answeredMs = 0;
  let answeredCount = 0;
  let multiTotal = 0;
  let multiMissed = 0;
  let singleTotal = 0;
  let singleMissed = 0;

  for (const q of asked) {
    const a = byId.get(q.id);
    const keys = keysFor(q);
    const picks = a?.picks ?? [];
    const multi = parseAnswer(q.answer).length > 1;
    // The key was shuffled for display, so compare displayed labels
    const ok = !!a && isCorrectAnswer(picks, keys.join(","));
    if (!a) unanswered++;
    else {
      answeredMs += a.ms;
      answeredCount++;
    }
    if (ok) correct++;
    if (multi) {
      multiTotal++;
      if (!ok) multiMissed++;
    } else {
      singleTotal++;
      if (!ok) singleMissed++;
    }

    const d = domainAcc.get(q.domain) ?? { correct: 0, total: 0 };
    d.total++;
    if (ok) d.correct++;
    domainAcc.set(q.domain, d);

    const sk = `${q.domain}|${q.subSkill}`;
    const s = subAcc.get(sk) ?? { correct: 0, total: 0 };
    s.total++;
    if (ok) s.correct++;
    subAcc.set(sk, s);

    if (!ok) {
      missed.push({
        id: q.id,
        domain: q.domain,
        subSkill: q.subSkill,
        question: q.question,
        options: optionsFor(q),
        userPicks: picks,
        keys,
        explanation: explain(q),
        multi,
        ms: a?.ms ?? 0,
      });
    }
  }

  const domains: DomainStat[] = defDomains.map((d) => {
    const acc = domainAcc.get(d.name);
    return {
      domain: d.name,
      weight: d.weight,
      courseModule: d.courseModule,
      correct: acc?.correct ?? 0,
      total: acc?.total ?? 0,
      pct: acc ? acc.correct / acc.total : null,
    };
  });

  const subSkills: SubSkillStat[] = defDomains.flatMap((d) =>
    d.subSkills.map((s) => {
      const acc = subAcc.get(`${d.name}|${s.name}`);
      return {
        domain: d.name,
        subSkill: s.name,
        weight: s.weight,
        correct: acc?.correct ?? 0,
        total: acc?.total ?? 0,
        pct: acc ? acc.correct / acc.total : null,
      };
    })
  );

  const total = asked.length;
  const readiness = modeProducesReadiness(mode) ? estimateReadiness(domains) : null;
  const passed = readiness === null ? null : readiness >= PASS_SCORE;

  // Weakest domain: lowest accuracy among domains that were asked (higher weight breaks ties)
  const askedDomains = domains.filter((d) => d.pct !== null);
  const weakest = [...askedDomains].sort((a, b) => (a.pct as number) - (b.pct as number) || b.weight - a.weight)[0];

  // Lift: readiness points gained by bringing each area up to the "ready" accuracy
  const totalWeight = askedDomains.reduce((n, d) => n + d.weight, 0) || 1;
  const trackWeight = defDomains.reduce((n, d) => n + d.weight, 0);
  const span = SCORE_MAX - SCORE_MIN;
  const lifts: LiftItem[] = [
    ...askedDomains.map((d) => ({
      kind: "domain" as const,
      name: d.domain,
      domain: d.domain,
      pct: d.pct as number,
      weight: d.weight,
      lift: Math.round(span * (d.weight / totalWeight) * Math.max(0, READY_PCT - (d.pct as number))),
    })),
    // Only weighted sub-skills have a defined lift (weight x gap); unweighted ones are listed by accuracy instead
    ...subSkills
      .filter((s) => s.pct !== null && s.weight !== null)
      .map((s) => ({
        kind: "subSkill" as const,
        name: s.subSkill,
        domain: s.domain,
        pct: s.pct as number,
        weight: s.weight as number,
        lift: Math.round(span * ((s.weight as number) / trackWeight) * Math.max(0, READY_PCT - (s.pct as number))),
      })),
  ]
    .filter((l) => l.lift > 0)
    .sort((a, b) => b.lift - a.lift);

  const avgSeconds = answeredCount ? answeredMs / answeredCount / 1000 : 0;

  const patterns: string[] = [];
  if (multiTotal >= 2 && multiMissed / multiTotal > singleMissed / Math.max(1, singleTotal) + 0.15) {
    patterns.push(
      `You missed ${multiMissed} of ${multiTotal} multiple-response items. They are scored all-or-nothing, so check every option on its own before you submit.`
    );
  }
  if (unanswered > 0) {
    patterns.push(
      `${unanswered} question${unanswered === 1 ? " was" : "s were"} left unanswered. Running out of time costs points, so practise pacing in timed mocks.`
    );
  }
  if (avgSeconds > PACE_SECONDS) {
    patterns.push(
      `You averaged ${Math.round(avgSeconds)} seconds per question against the ${PACE_SECONDS}-second exam pace. Skip and return to slow items.`
    );
  }
  if (answeredCount >= 5 && avgSeconds < 30 && total > 0 && correct / total < 0.6) {
    patterns.push(
      `You averaged only ${Math.round(avgSeconds)} seconds per question while missing many. Slow down and read every option.`
    );
  }
  const repeated = subSkills
    .filter((s) => s.total >= 2 && s.pct !== null && s.pct <= 0.5)
    .sort((a, b) => (a.pct as number) - (b.pct as number) || (b.weight ?? 0) - (a.weight ?? 0))
    .slice(0, 2);
  for (const s of repeated) {
    patterns.push(`"${s.subSkill}" (${s.domain}) failed again and again: ${s.correct} of ${s.total} correct.`);
  }

  return {
    track,
    mode,
    domainFilter: input.domainFilter,
    correct,
    total,
    pct: total ? correct / total : 0,
    readiness,
    passLine: PASS_SCORE,
    gap: readiness === null ? 0 : Math.max(0, PASS_SCORE - readiness),
    passed,
    // Few items per domain make the estimate noisy
    lowConfidence: total < 30,
    domains,
    subSkills,
    weakestDomain: weakest?.domain ?? null,
    lifts,
    missed,
    patterns,
    avgSecondsPerQuestion: Math.round(avgSeconds),
    paceSeconds: PACE_SECONDS,
    totalSeconds: input.totalSeconds,
    unansweredCount: unanswered,
  };
}

/** Readiness label used next to the number. */
export function readinessLabel(readiness: number): string {
  if (readiness >= READY_SCORE) return "Looks ready";
  if (readiness >= PASS_SCORE) return "Close to ready";
  if (readiness >= 600) return "Building momentum";
  return "Keep practising";
}
