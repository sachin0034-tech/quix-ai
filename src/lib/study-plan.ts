import type { ResultSummary } from "@/types/quiz";
import { TRACKS, type DocLink, type DomainDef } from "@/lib/blueprint";
import { READY_SCORE } from "@/lib/config";
import { READY_PCT } from "@/lib/scoring";

export interface PlanDay {
  day: number;
  /** ISO date when an exam date was given, else null */
  date: string | null;
  title: string;
  tasks: string[];
  focus?: string;
}

export interface PlanDomain {
  name: string;
  pct: number;
  weakSubSkills: string[];
  whatToStudy: string;
  docLinks: DocLink[];
  courseModule: number;
  drill: string;
}

export interface StudyPlan {
  summary: string;
  /** True when the exam is close enough that the plan is deliberately narrow */
  tight: boolean;
  /** True when no exam date was given and the 14-day default was used */
  askForDate: boolean;
  looksReady: boolean;
  days: PlanDay[];
  domains: PlanDomain[];
  retest: { day: number; target: number; text: string };
}

export interface PlanInput {
  result: ResultSummary;
  /** The domains of the result's track as defined in the database */
  domains: DomainDef[];
  /** yyyy-mm-dd */
  examDate?: string | null;
  /** True when the last two full mocks were both 800+ */
  readyStreak?: boolean;
  now?: Date;
}

const DAY_MS = 86_400_000;

export function daysUntil(examDate: string | null | undefined, now: Date): number | null {
  if (!examDate) return null;
  const t = Date.parse(`${examDate}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((t - today) / DAY_MS);
}

/** Deterministic plan skeleton. The optional AI step only adds wording to this structure. */
export function buildStudyPlan({ result, domains, examDate, readyStreak, now = new Date() }: PlanInput): StudyPlan {
  const track = TRACKS[result.track];
  const until = daysUntil(examDate, now);
  const askForDate = until === null || until < 1;
  const totalDays = askForDate ? 14 : Math.min(Math.max(until as number, 1), 28);
  const tight = !askForDate && (until as number) <= 7;
  const looksReady = !!readyStreak;

  const dateOf = (day: number) =>
    askForDate ? null : new Date(now.getTime() + (day - 1) * DAY_MS).toISOString().slice(0, 10);

  // Weak domains ranked by how much they would lift the overall estimate
  const domainLifts = result.lifts.filter((l) => l.kind === "domain");
  const weakCount = tight ? 2 : 4;
  const weak = domainLifts.slice(0, weakCount);

  const planDomains: PlanDomain[] = weak.map((l) => {
    const def = domains.find((d) => d.name === l.name);
    const weakSubs = result.subSkills
      .filter((s) => s.domain === l.name && s.pct !== null && (s.pct as number) < READY_PCT)
      .sort((a, b) => (a.pct as number) - (b.pct as number))
      .slice(0, 3)
      .map((s) => s.subSkill);
    return {
      name: l.name,
      pct: l.pct,
      weakSubSkills: weakSubs,
      whatToStudy: `${def?.objective ?? l.name}${weakSubs.length ? ` Start with: ${weakSubs.join(", ")}.` : ""}`,
      docLinks: def?.docLinks ?? [],
      courseModule: def?.courseModule ?? 1,
      drill: `Domain drill: ${l.name}`,
    };
  });

  const retestDay = totalDays;
  const days: PlanDay[] = [];

  if (looksReady) {
    days.push(
      { day: 1, date: dateOf(1), title: "Review your mistakes", tasks: ["Open Review mistakes and work through every item you've missed.", "Skim the explanations for anything you got right by guessing."] },
      { day: Math.min(2, totalDays), date: dateOf(Math.min(2, totalDays)), title: "One final full mock", tasks: [`Sit a full ${track.items}-question mock in ${track.minutes} minutes under exam conditions.`, `Book the real exam once the estimate stays at ${READY_SCORE} or higher.`] }
    );
    return {
      summary: `You look ready: your estimate has stayed at ${READY_SCORE} or higher across two full mocks. Do one final mock and review your mistakes, then book the exam. This is an estimate, not a guarantee.`,
      tight: false,
      askForDate,
      looksReady: true,
      days,
      domains: planDomains,
      retest: { day: Math.min(2, totalDays), target: READY_SCORE, text: `One more full mock at ${READY_SCORE}+ before booking.` },
    };
  }

  const studyDays = Math.max(1, totalDays - 1);
  for (let d = 1; d <= studyDays; d++) {
    const dom = planDomains.length ? planDomains[(d - 1) % planDomains.length] : undefined;
    const tasks: string[] = [];
    let title: string;
    if (!dom) {
      title = "Mixed practice";
      tasks.push("Take a Quick sprint, then review every explanation.");
    } else if (d % 3 === 0) {
      title = "Quick sprint and review";
      tasks.push("Take a Quick sprint (10 adaptive questions).", "Review every missed explanation and note the pattern.");
    } else if (Math.ceil(d / planDomains.length) % 2 === 1) {
      title = `Study: ${dom.name}`;
      tasks.push(dom.whatToStudy, ...dom.docLinks.map((l) => `Read: ${l.title} (${l.url})`), `Course: Module ${dom.courseModule}.`);
    } else {
      title = `Drill: ${dom.name}`;
      tasks.push(`${dom.drill} (20 questions).`, "Re-read the explanation for each miss.");
    }
    days.push({ day: d, date: dateOf(d), title, tasks });
  }
  days.push({
    day: retestDay,
    date: dateOf(retestDay),
    title: "Retest: full mock",
    tasks: [
      `Sit a full ${track.items}-question mock in ${track.minutes} minutes.`,
      `Target: an estimate of ${READY_SCORE} or higher before booking the real exam.`,
      "Run Review mistakes afterwards.",
    ],
  });

  const names = planDomains.length > 1 ? `${planDomains.slice(0, -1).map((d) => d.name).join(", ")} and ${planDomains[planDomains.length - 1].name}` : (planDomains[0]?.name ?? "");
  const gap = result.readiness !== null ? `Your estimate is ${result.readiness} against the ${result.passLine} pass line. ` : "";
  const summary = tight
    ? `${gap}Your exam is only ${until} day${until === 1 ? "" : "s"} away, which is tight. This plan narrows to your two highest-impact areas${names ? `: ${names}` : ""}. Consider moving the exam if the retest stays below ${READY_SCORE}.`
    : `${gap}This ${totalDays}-day plan focuses on ${names || "mixed practice"}, then finishes with a full mock.${askForDate ? " Add your exam date to sharpen it." : ""}`;

  return {
    summary,
    tight,
    askForDate,
    looksReady: false,
    days,
    domains: planDomains,
    retest: { day: retestDay, target: READY_SCORE, text: `Full mock on day ${retestDay}; target ${READY_SCORE}+ before booking the real exam.` },
  };
}
