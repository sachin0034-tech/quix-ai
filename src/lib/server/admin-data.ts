import { db } from "@/lib/server/db";
import { bankSource } from "@/lib/bank";
import { TRACKS, TRACK_IDS, type DocLink } from "@/lib/blueprint";
import type { TrackId } from "@/types/quiz";

/** Read helpers for the admin pages. Everything comes from Supabase; nothing is hard-coded here. */

export interface AdminSubSkill { id?: number; name: string; weight: number | null }
export interface AdminDomain {
  id: number;
  title: string;
  track: TrackId | null;
  weight: number | null;
  courseModule: number | null;
  objective: string;
  docLinks: DocLink[];
  order: number;
  questionCount: number;
  subSkills: AdminSubSkill[];
}
export interface AdminQuestion {
  id: number;
  moduleId: number;
  section: string;
  difficulty: string;
  question: string;
  options: [string, string, string, string];
  answer: string;
  explanation: string;
  order: number;
}

export interface SchemaStatus {
  configured: boolean;
  /** Human-readable list of what the database still lacks */
  missing: string[];
  source: "database" | "code";
}

const MODULE_COLS = ["track", "weight", "objective", "course_module", "doc_links"];

export async function adminSchema(): Promise<SchemaStatus> {
  const c = db();
  if (!c) return { configured: false, missing: [], source: "code" };
  const missing: string[] = [];
  const mod = await c.from("quiz_modules").select("*").limit(1);
  if (mod.error) missing.push(`quiz_modules is unreadable: ${mod.error.message}`);
  else if (mod.data?.length) {
    const absent = MODULE_COLS.filter((k) => !(k in mod.data[0]));
    if (absent.length) missing.push(`quiz_modules is missing columns: ${absent.join(", ")}`);
  }
  const q = await c.from("quiz_questions").select("*").limit(1);
  if (!q.error && q.data?.length && !("explanation" in q.data[0])) missing.push("quiz_questions is missing the explanation column");
  const sub = await c.from("quiz_sub_skills").select("id").limit(1);
  if (sub.error) missing.push("table quiz_sub_skills does not exist");
  return { configured: true, missing, source: await bankSource() };
}

/** Track of a module row; falls back to the track that owns a domain of that name. */
function trackOf(row: Record<string, unknown>): TrackId | null {
  if (row.track === "associate" || row.track === "developer") return row.track;
  const title = String(row.title ?? "").trim();
  return TRACK_IDS.find((t) => TRACKS[t].domains.some((d) => d.name === title)) ?? null;
}

export async function adminDomains(): Promise<AdminDomain[]> {
  const c = db();
  if (!c) return [];
  const [mods, subs, qs] = await Promise.all([
    c.from("quiz_modules").select("*").order("order_index", { ascending: true }),
    c.from("quiz_sub_skills").select("*").order("order_index", { ascending: true }),
    c.from("quiz_questions").select("id, module_id"),
  ]);
  const counts = new Map<number, number>();
  for (const q of qs.data ?? []) counts.set(q.module_id, (counts.get(q.module_id) ?? 0) + 1);
  return (mods.data ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    track: trackOf(m),
    weight: m.weight != null ? Number(m.weight) : null,
    courseModule: m.course_module ?? null,
    objective: m.objective ?? m.description ?? "",
    docLinks: Array.isArray(m.doc_links) ? (m.doc_links as DocLink[]) : [],
    order: m.order_index ?? 0,
    questionCount: counts.get(m.id) ?? 0,
    subSkills: (subs.data ?? []).filter((s) => s.module_id === m.id).map((s) => ({ id: s.id, name: s.name, weight: s.weight == null ? null : Number(s.weight) })),
  }));
}

export async function adminQuestions(): Promise<AdminQuestion[]> {
  const c = db();
  if (!c) return [];
  const { data } = await c.from("quiz_questions").select("*").order("module_id", { ascending: true }).order("order_index", { ascending: true });
  return (data ?? []).map((r) => ({
    id: r.id,
    moduleId: r.module_id,
    section: r.section,
    difficulty: r.difficulty,
    question: r.question,
    options: [r.option_a, r.option_b, r.option_c, r.option_d],
    answer: r.answer,
    explanation: r.explanation ?? "",
    order: r.order_index ?? 0,
  }));
}
