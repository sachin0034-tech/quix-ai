export type Difficulty = "Easy" | "Medium" | "Hard";
export type OptionLabel = "A" | "B" | "C" | "D";
export type AnswerLabel = OptionLabel | "?";

export type TrackId = "associate" | "developer";

export type ModeId = "diagnostic" | "sprint" | "drill" | "full" | "review";

export interface Option {
  label: OptionLabel;
  text: string;
}

/** A question as stored in the bank (server side only: carries the key). */
export interface BankQuestion {
  id: number;
  track: TrackId;
  domain: string;
  subSkill: string;
  difficulty: Difficulty;
  question: string;
  options: Option[];
  /** Correct label(s): "B" for single-answer, "A,C" for multi-answer questions */
  answer: string;
  explanation?: string;
  /** Exam guide the item was written against, e.g. "v1.0" */
  guideVersion: string;
}

/** A question as sent to the browser: no key, no explanation. */
export interface PublicQuestion {
  id: number;
  track: TrackId;
  domain: string;
  subSkill: string;
  difficulty: Difficulty;
  question: string;
  options: Option[];
  /** How many options must be selected ("Select N") */
  picks: number;
}

export interface CheckResult {
  correct: boolean;
  keys: OptionLabel[];
  explanation: string;
}

export interface AttemptAnswer {
  id: number;
  picks: OptionLabel[];
  /** Milliseconds spent on the question */
  ms: number;
}

export interface DomainStat {
  domain: string;
  weight: number;
  /** Course module that covers the domain (from the database) */
  courseModule?: number;
  correct: number;
  total: number;
  /** 0..1, null when no item from the domain was asked */
  pct: number | null;
}

export interface SubSkillStat {
  domain: string;
  subSkill: string;
  /** null when the exam guide gives this sub-skill no weight */
  weight: number | null;
  correct: number;
  total: number;
  pct: number | null;
}

export interface MissedItem {
  id: number;
  domain: string;
  subSkill: string;
  question: string;
  options: Option[];
  userPicks: OptionLabel[];
  keys: OptionLabel[];
  explanation: string;
  multi: boolean;
  ms: number;
}

export interface LiftItem {
  kind: "domain" | "subSkill";
  name: string;
  domain: string;
  pct: number;
  weight: number;
  /** Readiness points gained by reaching the "ready" accuracy level */
  lift: number;
}

export interface ResultSummary {
  track: TrackId;
  mode: ModeId;
  domainFilter?: string;
  correct: number;
  total: number;
  pct: number;
  /** 100-1000 estimate; null for modes that do not produce one */
  readiness: number | null;
  passLine: number;
  gap: number;
  passed: boolean | null;
  lowConfidence: boolean;
  domains: DomainStat[];
  subSkills: SubSkillStat[];
  weakestDomain: string | null;
  lifts: LiftItem[];
  missed: MissedItem[];
  patterns: string[];
  avgSecondsPerQuestion: number;
  paceSeconds: number;
  totalSeconds: number;
  unansweredCount: number;
}
