import type { BankQuestion, ModuleQuiz, OptionLabel } from "@/types/quiz";
import data from "./module-bank.json";

/**
 * The By Module exams of the Developer track: Modules 1-5, Level 1. Generated from 1.md..5.md by
 * scripts/build-module-bank.ts (npm run bank:modules). These questions are module-only: they never enter the
 * exam-weighted full mock, which keeps drawing from the existing Level 1 bank.
 * Levels 2 and 3 have the same five modules; their questions live in the database (see levelFromDatabase below).
 */

/** Far above any database id, so the two can never collide */
const ID_BASE = 9_000_000;

interface RawModule {
  module: number;
  title: string;
  level: number;
  questions: { n: number; difficulty: BankQuestion["difficulty"]; question: string; options: { label: string; text: string }[]; answer: string; explanation: string }[];
}

const raw = (data as { modules: RawModule[] }).modules;

export const moduleName = (n: number) => `Module ${n}`;

const toBank = (modules: RawModule[], idBase: number): BankQuestion[] =>
  modules.flatMap((m) =>
    m.questions.map<BankQuestion>((q) => ({
      id: idBase + m.module * 1000 + q.n,
      track: "developer",
      domain: `${moduleName(m.module)}: ${m.title}`,
      subSkill: m.title,
      difficulty: q.difficulty,
      question: q.question,
      options: q.options.map((o) => ({ label: o.label as OptionLabel, text: o.text })),
      answer: q.answer,
      explanation: q.explanation,
      guideVersion: "v1.0",
      submoduleName: moduleName(m.module),
      moduleOnly: true,
      resources: [],
    }))
  );

export const MODULE_BANK: BankQuestion[] = toBank(raw, ID_BASE);

const quizzes = (modules: RawModule[], bank: BankQuestion[]): ModuleQuiz[] =>
  modules.map((m) => ({
    name: moduleName(m.module),
    description: m.title,
    position: m.module,
    lessons: [],
    extras: bank.filter((q) => q.submoduleName === moduleName(m.module)),
  }));

/** One quiz per module; its questions are drawn together (no lessons) */
export const MODULE_QUIZZES: ModuleQuiz[] = quizzes(raw, MODULE_BANK);

/** The course (submodule) names a Level 2 or 3 question can carry in the database, and the module each one is */
const MODULE_OF_COURSE: Record<string, number> = {
  "MSO Foundations": 1,
  "Production-Grade Prompting, Agents & Tool Use": 2,
  "Claude Code, MCP & Integration": 3,
  "Production Engineering, Evals & Security": 4,
  "Accelerators & IP Contribution": 5,
  "Accelerators, IP & Deployment": 5,
};

/**
 * A database level (2 or 3) as the database holds it: questions stored with that level, regrouped into Modules 1-5
 * by their course. Returns null when the database has none.
 */
export function levelFromDatabase(bank: BankQuestion[], level: number): { bank: BankQuestion[]; quizzes: ModuleQuiz[] } | null {
  const titles = new Map(raw.map((m) => [m.module, m.title]));
  const ofLevel = bank
    .filter((q) => q.track === "developer" && q.level === level && q.submoduleName != null && MODULE_OF_COURSE[q.submoduleName] != null)
    .map<BankQuestion>((q) => {
      const n = MODULE_OF_COURSE[q.submoduleName as string];
      return { ...q, domain: `${moduleName(n)}: ${titles.get(n)}`, submoduleName: moduleName(n), moduleOnly: true, resources: [] };
    });
  if (!ofLevel.length) return null;
  return { bank: ofLevel, quizzes: quizzes(raw, ofLevel) };
}
