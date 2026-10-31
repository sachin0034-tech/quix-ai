import type { BankQuestion, Difficulty, ModuleLesson, ModuleQuiz, Option, OptionLabel, PublicQuestion, Resource, TrackId } from "@/types/quiz";
import { DEMO_SIZE, TRACKS, TRACK_IDS, type DocLink, type DomainDef, type SubSkillDef, type SubmoduleDef } from "@/lib/blueprint";
import { parseAnswer, requiredPicks } from "@/lib/answers";
import { db } from "@/lib/server/db";
import { CODE_BANK } from "./code-bank";
import { levelFromDatabase, MODULE_BANK, MODULE_QUIZZES } from "./module-bank";

/**
 * Question bank and exam blueprint. SERVER ONLY: it carries answer keys, so only API routes and
 * server components may import it. Browsers receive PublicQuestion objects (no key, no explanation).
 *
 * Everything is read from Supabase:
 *   quiz_modules     one row per exam domain (track, weight, objective, course_module, doc_links)
 *   quiz_sub_skills  the weighted sub-skills of a domain
 *   quiz_questions   questions (section = sub-skill, explanation, submodule_id, demo_order)
 *   quiz_submodules  Skill Jar courses under a domain (navigation and content only; never scored)
 *   quiz_skilljar_topics  the links shown with a question's explanation
 * Built-in defaults (src/lib/blueprint.ts, src/lib/bank/code-bank.ts) are used only when the database
 * is not configured, errors, or holds no recognised domains; columns/rows missing from the database
 * fall back to the default for that domain name.
 */

export type Blueprint = Record<TrackId, DomainDef[]>;

const TTL_MS = 60_000;

interface ModuleRow {
  id: number;
  title: string;
  description?: string | null;
  order_index?: number | null;
  track?: string | null;
  weight?: number | string | null;
  objective?: string | null;
  course_module?: number | null;
  doc_links?: unknown;
}
interface SubSkillRow { module_id: number; name: string; weight: number | string | null; order_index?: number | null }
interface QuestionRow {
  id: number; module_id: number; section: string; difficulty: string; question: string;
  option_a: string; option_b: string; option_c: string; option_d: string; answer: string;
  explanation?: string | null; order_index?: number;
  submodule_id?: number | null; demo_order?: number | null; topic_id?: number | null; module_only?: boolean | null; level?: number | null;
}
interface MemberRow { id?: number; topic_id: number; question_id: number }
interface SubmoduleRow { id: number; module_id: number; title: string; description?: string | null; order_index?: number | null; course_position?: number | null }
interface TopicRow { id: number; submodule_id: number; course_title: string; lesson_title?: string | null; url?: string | null; order_index?: number | null }

const isHttpUrl = (u: unknown): u is string => typeof u === "string" && /^https?:\/\//i.test(u.trim());

/** A topic's link text: the lesson first, with its course in brackets; a course-level topic is just the course. */
const topicTitle = (t: TopicRow) => (t.lesson_title?.trim() ? `${t.lesson_title.trim()} (${t.course_title.trim()})` : t.course_title.trim());

const defaultDomain = (title: string): { track: TrackId; def: DomainDef } | undefined => {
  for (const t of TRACK_IDS) {
    const def = TRACKS[t].domains.find((d) => d.name === title);
    if (def) return { track: t, def };
  }
};

const isTrackId = (v: unknown): v is TrackId => v === "associate" || v === "developer";

function parseDocLinks(v: unknown): DocLink[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const links = v.filter((l): l is DocLink => !!l && typeof l.title === "string" && typeof l.url === "string");
  return links;
}

/** Builds the blueprint and the question list from raw database rows. Pure, so it is unit tested. */
export function buildFromRows(
  modules: ModuleRow[],
  subSkillRows: SubSkillRow[],
  questionRows: QuestionRow[],
  submoduleRows: SubmoduleRow[] = [],
  topicRows: TopicRow[] = [],
  memberRows: MemberRow[] = []
): { domains: Blueprint; bank: BankQuestion[]; modules: Record<TrackId, ModuleQuiz[]> } {
  const domains: Blueprint = { associate: [], developer: [] };
  const byModule = new Map<number, { track: TrackId; name: string }>();

  const submoduleNames = new Map(submoduleRows.map((x) => [x.id, x.title.trim()]));

  // Skill Jar links: only topics with a usable URL can be shown as links. A topic that names a lesson is shown only to
  // the questions that point at it; the topics without a lesson are the course-level link of the whole submodule.
  const bySubmodule = new Map<number, Resource[]>();
  const lessonTopic = new Map<number, { submoduleId: number; link: Resource; lesson: string }>();
  for (const t of [...topicRows].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0) || a.id - b.id)) {
    if (!isHttpUrl(t.url) || !t.course_title?.trim()) continue;
    const link = { title: topicTitle(t), url: t.url.trim() };
    if (t.lesson_title?.trim()) lessonTopic.set(t.id, { submoduleId: t.submodule_id, link, lesson: t.lesson_title.trim() });
    else bySubmodule.set(t.submodule_id, [...(bySubmodule.get(t.submodule_id) ?? []), link]);
  }

  for (const m of [...modules].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))) {
    const name = m.title.trim();
    const dflt = defaultDomain(name);
    const track = isTrackId(m.track) ? m.track : dflt?.track;
    if (!track) continue; // not part of the Claude certification blueprint
    const weight = m.weight != null && m.weight !== "" ? Number(m.weight) : dflt?.def.weight;
    if (weight == null || Number.isNaN(weight)) continue;

    const own = subSkillRows
      .filter((s) => s.module_id === m.id)
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
      .map<SubSkillDef>((s) => ({ name: s.name.trim(), weight: s.weight == null || s.weight === "" ? null : Number(s.weight) }));
    const subSkills = own.length ? own : (dflt?.def.subSkills ?? []);

    const submodules = submoduleRows
      .filter((x) => x.module_id === m.id)
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0) || a.id - b.id)
      .map<SubmoduleDef>((x) => ({ id: x.id, name: x.title.trim(), description: x.description?.trim() ?? "", position: x.course_position ?? null, topics: bySubmodule.get(x.id) ?? [] }));

    domains[track].push({
      name,
      weight,
      subSkills: [...subSkills],
      submodules,
      docLinks: parseDocLinks(m.doc_links) ?? dflt?.def.docLinks ?? [],
      courseModule: m.course_module ?? dflt?.def.courseModule ?? domains[track].length + 1,
      objective: m.objective?.trim() || dflt?.def.objective || m.description?.trim() || name,
    });
    byModule.set(m.id, { track, name });
  }

  // The lesson the question points at (if it belongs to the question's own submodule), else its course-level link
  const lessonOf = (r: QuestionRow) => {
    const lesson = r.topic_id != null ? lessonTopic.get(r.topic_id) : undefined;
    return lesson && lesson.submoduleId === r.submodule_id ? lesson : undefined;
  };
  const resourcesOf = (r: QuestionRow): Resource[] => {
    if (r.submodule_id == null) return [];
    const lesson = lessonOf(r);
    return lesson ? [lesson.link] : (bySubmodule.get(r.submodule_id) ?? []);
  };

  const bank: BankQuestion[] = [];
  for (const r of questionRows) {
    const home = byModule.get(r.module_id);
    if (!home) continue;
    const opts = [r.option_a, r.option_b, r.option_c, r.option_d];
    if (opts.some((t) => !t?.trim()) || !parseAnswer(r.answer).length) continue;
    const sub = r.section.trim();
    // A section nobody defined as a sub-skill still gets drawn: it joins its domain (unweighted, or with the average weight if the domain is weighted)
    const dom = domains[home.track].find((d) => d.name === home.name) as DomainDef;
    if (sub && !dom.subSkills.some((x) => x.name === sub)) {
      const weighted = dom.subSkills.filter((x) => x.weight != null);
      const avg = weighted.length === dom.subSkills.length && weighted.length ? weighted.reduce((n, x) => n + (x.weight as number), 0) / weighted.length : null;
      dom.subSkills.push({ name: sub, weight: avg === null ? null : +avg.toFixed(2) });
    }
    bank.push({
      id: r.id,
      track: home.track,
      domain: home.name,
      subSkill: sub,
      difficulty: (["Easy", "Medium", "Hard"].includes(r.difficulty) ? r.difficulty : "Medium") as Difficulty,
      question: r.question,
      options: opts.map((text, i) => ({ label: (["A", "B", "C", "D"] as OptionLabel[])[i], text })),
      answer: r.answer,
      explanation: r.explanation?.trim() || undefined,
      guideVersion: "v1.0",
      submoduleId: r.submodule_id ?? null,
      topicId: r.topic_id ?? null,
      lessonName: lessonOf(r)?.lesson ?? null,
      submoduleName: r.submodule_id != null ? (submoduleNames.get(r.submodule_id) ?? null) : null,
      moduleOnly: r.module_only === true,
      level: r.level === 2 || r.level === 3 ? r.level : 1,
      demoOrder: r.demo_order != null && r.demo_order >= 1 && r.demo_order <= DEMO_SIZE ? r.demo_order : null,
      resources: resourcesOf(r),
    });
  }
  const moduleQuizzes = buildModuleQuizzes({ submodules: submoduleRows, topics: topicRows, members: memberRows, trackOf: (id) => byModule.get(id)?.track, bank });
  return { domains, bank, modules: moduleQuizzes };
}

/**
 * The module quiz of every course. A module is a submodule name: a course taught under several domains is one module.
 * A lesson is a topic that names a lesson, grouped by its name across those domains, and its questions are the
 * members the admin put in it. A question belongs to at most one lesson of a course (the first membership wins).
 */
export function buildModuleQuizzes(input: {
  submodules: SubmoduleRow[];
  topics: TopicRow[];
  members: MemberRow[];
  trackOf: (moduleId: number) => TrackId | undefined;
  bank: BankQuestion[];
}): Record<TrackId, ModuleQuiz[]> {
  const out: Record<TrackId, ModuleQuiz[]> = { associate: [], developer: [] };
  const topicById = new Map(input.topics.map((t) => [t.id, t]));
  const bankById = new Map(input.bank.map((q) => [q.id, q]));
  const topicsInOrder = [...input.topics].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0) || a.id - b.id);
  const members = [...input.members].sort((a, b) => (a.id ?? 0) - (b.id ?? 0) || a.topic_id - b.topic_id || a.question_id - b.question_id);

  for (const track of TRACK_IDS) {
    const courses = new Map<string, { position: number; description: string; subIds: Set<number> }>();
    for (const sm of input.submodules) {
      if (input.trackOf(sm.module_id) !== track) continue;
      const name = sm.title.trim();
      const c = courses.get(name) ?? { position: Infinity, description: "", subIds: new Set<number>() };
      c.position = Math.min(c.position, sm.course_position ?? Infinity);
      if (!c.description && sm.description?.trim()) c.description = sm.description.trim();
      c.subIds.add(sm.id);
      courses.set(name, c);
    }
    for (const [name, c] of courses) {
      const lessons = new Map<string, ModuleLesson>();
      for (const t of topicsInOrder) {
        const lesson = t.lesson_title?.trim();
        if (!c.subIds.has(t.submodule_id) || !lesson || !isHttpUrl(t.url) || lessons.has(lesson)) continue;
        lessons.set(lesson, { name: lesson, link: { title: `${lesson} (${name})`, url: t.url.trim() }, questions: [] });
      }
      const claimed = new Set<number>();
      for (const m of members) {
        const t = topicById.get(m.topic_id);
        const q = bankById.get(m.question_id);
        const lesson = t && c.subIds.has(t.submodule_id) ? lessons.get(t.lesson_title?.trim() ?? "") : undefined;
        if (!lesson || !q || q.track !== track || claimed.has(q.id)) continue;
        claimed.add(q.id);
        lesson.questions.push(q);
      }
      out[track].push({
        name,
        description: c.description,
        position: Number.isFinite(c.position) ? c.position : null,
        lessons: [...lessons.values()],
        extras: input.bank.filter((q) => q.track === track && q.submoduleName === name && !claimed.has(q.id)),
      });
    }
  }
  return out;
}

/** Every question a module quiz can draw: its lessons' questions, then the course's lesson-less ones. */
export const moduleQuestions = (m: ModuleQuiz): BankQuestion[] => [...m.lessons.flatMap((l) => l.questions), ...m.extras];

/** Kept for tests and callers that only need the question mapping. */
export const rowsToBank = (modules: ModuleRow[], rows: QuestionRow[]) => buildFromRows(modules, [], rows).bank;

interface Loaded { at: number; domains: Blueprint; bank: BankQuestion[]; modules: Record<TrackId, ModuleQuiz[]>; levels: Record<number, { bank: BankQuestion[]; quizzes: ModuleQuiz[] }>; source: "database" | "code" }
let cache: Loaded | null = null;

const defaults = (): Blueprint => ({ associate: [...TRACKS.associate.domains], developer: [...TRACKS.developer.domains] });

async function load(): Promise<Loaded> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  let result: Omit<Loaded, "levels"> | null = null;
  const c = db();
  if (c) {
    try {
      const [mods, subs, qs, submods, topics, members] = await Promise.all([
        c.from("quiz_modules").select("*"),
        c.from("quiz_sub_skills").select("*"), // missing before the migration: treated as empty
        c.from("quiz_questions").select("*").order("order_index", { ascending: true }),
        c.from("quiz_submodules").select("*"), // submodules and their links are optional too
        c.from("quiz_skilljar_topics").select("*"),
        c.from("quiz_lesson_questions").select("*"), // module quiz lessons: optional until the migration has run
      ]);
      if (mods.error || qs.error) throw new Error((mods.error ?? qs.error)?.message);
      const built = buildFromRows(
        mods.data as ModuleRow[],
        (subs.error ? [] : subs.data) as SubSkillRow[],
        qs.data as QuestionRow[],
        (submods.error ? [] : submods.data) as SubmoduleRow[],
        (topics.error ? [] : topics.data) as TopicRow[],
        (members.error ? [] : members.data) as MemberRow[]
      );
      if (built.bank.length) result = { at: Date.now(), ...built, source: "database" };
    } catch (err) {
      console.warn("[bank] database read failed, using built-in questions:", err instanceof Error ? err.message : err);
    }
  }
  const base = result ?? { at: Date.now(), domains: defaults(), bank: CODE_BANK, modules: { associate: [], developer: [] }, source: "code" as const };
  // The Developer By Module exams are Modules 1-5 from the module question files, whatever the database holds
  // Levels 2 and 3 come from the database: the questions stored with that level (empty while there are none)
  const empty = { bank: [], quizzes: [] };
  const levels = {
    1: { bank: MODULE_BANK, quizzes: MODULE_QUIZZES },
    2: levelFromDatabase(base.bank, 2) ?? empty,
    3: levelFromDatabase(base.bank, 3) ?? empty,
  };
  cache = { ...base, bank: [...base.bank, ...MODULE_BANK], modules: { ...base.modules, developer: MODULE_QUIZZES }, levels };
  return cache;
}

/** Drops the cache so admin edits show up immediately on this server instance. */
export function invalidateBank(): void {
  cache = null;
}

export async function getBank(): Promise<BankQuestion[]> {
  return (await load()).bank;
}

export async function getBlueprint(): Promise<Blueprint> {
  return (await load()).domains;
}

export async function bankSource(): Promise<"database" | "code"> {
  return (await load()).source;
}

export async function getQuestion(id: number): Promise<BankQuestion | undefined> {
  return (await getBank()).find((q) => q.id === id);
}

/** The questions the exam-weighted modes (diagnostic, sprint, drill, full mock) draw from: module-quiz-only questions are left out. */
export async function trackBank(track: TrackId): Promise<BankQuestion[]> {
  return (await getBank()).filter((q) => q.track === track && !q.moduleOnly);
}

/** Every question of a track, module-quiz-only ones included (for review of missed questions). */
export async function allTrackBank(track: TrackId): Promise<BankQuestion[]> {
  return (await getBank()).filter((q) => q.track === track);
}

/** The Developer By Module questions and quizzes of a level (1, 2 or 3) */
export async function getLevel(level: number): Promise<{ bank: BankQuestion[]; quizzes: ModuleQuiz[] }> {
  const { levels } = await load();
  return levels[level] ?? levels[1];
}

export async function getModuleQuizzes(): Promise<Record<TrackId, ModuleQuiz[]>> {
  return (await load()).modules;
}

/**
 * The link under a question's explanation while a module quiz is being taken: the lesson of that module the question
 * belongs to, else the question's own link.
 */
export async function moduleResourcesFor(q: BankQuestion, moduleName: string | undefined): Promise<Resource[]> {
  if (!moduleName) return q.resources ?? [];
  const mod = (await getModuleQuizzes())[q.track].find((m) => m.name === moduleName);
  const lesson = mod?.lessons.find((l) => l.questions.some((x) => x.id === q.id));
  return lesson ? [lesson.link] : (q.resources ?? []);
}

export interface TrackModule {
  name: string;
  /** One-line description for the module card; empty when the admin has not written one */
  description: string;
  /** Questions in the track that belong to it */
  count: number;
}

export interface TrackMeta {
  track: TrackId;
  /** Questions the exam-weighted modes (diagnostic, sprint, drill, full mock) draw from */
  total: number;
  /** Module-quiz-only questions (By Module, every level) */
  moduleOnly: number;
  /** Every question of the track: the full-mock pool plus all module questions */
  all: number;
  domains: { name: string; weight: number; count: number }[];
  /** Practice-by-module list: the Skill Jar courses that have questions, in path order */
  modules: TrackModule[];
}

/** The practice-by-module list of a track: modules that have questions, ordered by the admin's position, then by name. */
export function trackModules(modules: ModuleQuiz[]): TrackModule[] {
  return modules
    .map((m) => ({ m, count: moduleQuestions(m).length }))
    .filter((x) => x.count > 0)
    .sort((a, b) => (a.m.position ?? Infinity) - (b.m.position ?? Infinity) || a.m.name.localeCompare(b.m.name))
    .map((x) => ({ name: x.m.name, description: x.m.description, count: x.count }));
}

export async function bankMeta(): Promise<Record<TrackId, TrackMeta>> {
  const { bank, domains, modules, levels } = await load();
  const out = {} as Record<TrackId, TrackMeta>;
  for (const id of TRACK_IDS) {
    const items = bank.filter((q) => q.track === id && !q.moduleOnly);
    // Developer By Module questions are the ones of every level; other tracks use their module-quiz-only questions
    const moduleOnly = id === "developer" ? Object.values(levels).reduce((n, l) => n + l.bank.length, 0) : bank.filter((q) => q.track === id && q.moduleOnly).length;
    out[id] = {
      track: id,
      total: items.length,
      moduleOnly,
      all: items.length + moduleOnly,
      domains: domains[id].map((d) => ({ name: d.name, weight: d.weight, count: items.filter((q) => q.domain === d.name).length })),
      modules: trackModules(modules[id]),
    };
  }
  return out;
}

// ── Option shuffling ─────────────────────────────────────────────────────
// Option order is shuffled per attempt (seeded) so a learner cannot game a skewed key.
// The same seed regenerates the same order for checking, results and the tutor.

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LABELS: OptionLabel[] = ["A", "B", "C", "D", "E"];

/** order[displayIndex] = index into the original option array */
function optionOrder(q: BankQuestion, seed: string): number[] {
  const rng = mulberry32(hash(`${seed}:${q.id}`));
  const order = q.options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function presentOptions(q: BankQuestion, seed: string): Option[] {
  return optionOrder(q, seed).map((orig, i) => ({ label: LABELS[i], text: q.options[orig].text }));
}

/** Correct labels as displayed for this seed. */
export function displayKeys(q: BankQuestion, seed: string): OptionLabel[] {
  const order = optionOrder(q, seed);
  const keys = new Set(parseAnswer(q.answer));
  return order.flatMap((orig, i) => (keys.has(q.options[orig].label) ? [LABELS[i]] : [])).sort() as OptionLabel[];
}

export function toPublic(q: BankQuestion, seed: string): PublicQuestion {
  return {
    id: q.id,
    track: q.track,
    domain: q.domain,
    subSkill: q.subSkill,
    difficulty: q.difficulty,
    question: q.question,
    options: presentOptions(q, seed),
    picks: requiredPicks(q.answer),
  };
}
