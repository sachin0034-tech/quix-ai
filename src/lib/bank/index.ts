import type { BankQuestion, Difficulty, Option, OptionLabel, PublicQuestion, TrackId } from "@/types/quiz";
import { TRACKS, TRACK_IDS, type DocLink, type DomainDef, type SubSkillDef } from "@/lib/blueprint";
import { parseAnswer, requiredPicks } from "@/lib/answers";
import { db } from "@/lib/server/db";
import { CODE_BANK } from "./code-bank";

/**
 * Question bank and exam blueprint. SERVER ONLY: it carries answer keys, so only API routes and
 * server components may import it. Browsers receive PublicQuestion objects (no key, no explanation).
 *
 * Everything is read from Supabase:
 *   quiz_modules     one row per exam domain (track, weight, objective, course_module, doc_links)
 *   quiz_sub_skills  the weighted sub-skills of a domain
 *   quiz_questions   questions (section = sub-skill, explanation)
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
}

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
export function buildFromRows(modules: ModuleRow[], subSkillRows: SubSkillRow[], questionRows: QuestionRow[]): { domains: Blueprint; bank: BankQuestion[] } {
  const domains: Blueprint = { associate: [], developer: [] };
  const byModule = new Map<number, { track: TrackId; name: string }>();

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

    domains[track].push({
      name,
      weight,
      subSkills: [...subSkills],
      docLinks: parseDocLinks(m.doc_links) ?? dflt?.def.docLinks ?? [],
      courseModule: m.course_module ?? dflt?.def.courseModule ?? domains[track].length + 1,
      objective: m.objective?.trim() || dflt?.def.objective || m.description?.trim() || name,
    });
    byModule.set(m.id, { track, name });
  }

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
    });
  }
  return { domains, bank };
}

/** Kept for tests and callers that only need the question mapping. */
export const rowsToBank = (modules: ModuleRow[], rows: QuestionRow[]) => buildFromRows(modules, [], rows).bank;

interface Loaded { at: number; domains: Blueprint; bank: BankQuestion[]; source: "database" | "code" }
let cache: Loaded | null = null;

const defaults = (): Blueprint => ({ associate: [...TRACKS.associate.domains], developer: [...TRACKS.developer.domains] });

async function load(): Promise<Loaded> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  let result: Loaded | null = null;
  const c = db();
  if (c) {
    try {
      const [mods, subs, qs] = await Promise.all([
        c.from("quiz_modules").select("*"),
        c.from("quiz_sub_skills").select("*"), // missing before the migration: treated as empty
        c.from("quiz_questions").select("*").order("order_index", { ascending: true }),
      ]);
      if (mods.error || qs.error) throw new Error((mods.error ?? qs.error)?.message);
      const built = buildFromRows(mods.data as ModuleRow[], (subs.error ? [] : subs.data) as SubSkillRow[], qs.data as QuestionRow[]);
      if (built.bank.length) result = { at: Date.now(), ...built, source: "database" };
    } catch (err) {
      console.warn("[bank] database read failed, using built-in questions:", err instanceof Error ? err.message : err);
    }
  }
  cache = result ?? { at: Date.now(), domains: defaults(), bank: CODE_BANK, source: "code" };
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

export async function trackBank(track: TrackId): Promise<BankQuestion[]> {
  return (await getBank()).filter((q) => q.track === track);
}

export interface TrackMeta {
  track: TrackId;
  total: number;
  domains: { name: string; weight: number; count: number }[];
}

export async function bankMeta(): Promise<Record<TrackId, TrackMeta>> {
  const { bank, domains } = await load();
  const out = {} as Record<TrackId, TrackMeta>;
  for (const id of TRACK_IDS) {
    const items = bank.filter((q) => q.track === id);
    out[id] = {
      track: id,
      total: items.length,
      domains: domains[id].map((d) => ({ name: d.name, weight: d.weight, count: items.filter((q) => q.domain === d.name).length })),
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

const LABELS: OptionLabel[] = ["A", "B", "C", "D"];

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
