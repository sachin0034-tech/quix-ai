"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { invalidateBank } from "@/lib/bank";
import { TRACK_IDS } from "@/lib/blueprint";

const ADMIN_EMAIL = "admin123@gmail.com";
const ADMIN_PASSWORD = "admin123@#";
const SESSION_VALUE = "quix_admin_v1";

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function loginAction(_: unknown, formData: FormData) {
  const email = (formData.get("email") as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    const cookieStore = await cookies();
    cookieStore.set("admin_session", SESSION_VALUE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 8,
      path: "/",
    });
    redirect("/admin");
  }

  return { error: "Invalid email or password" };
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("admin_session");
  redirect("/admin/login");
}

// ── Domains (quiz_modules + quiz_sub_skills) and questions (quiz_questions) ────

type Result = { error?: string; id?: number };

function afterWrite() {
  invalidateBank();
  for (const path of ["/", "/associate", "/developer", "/admin", "/admin/questions"]) revalidatePath(path);
}

export interface DomainInput {
  id?: number;
  track: string;
  title: string;
  weight: number;
  courseModule: number | null;
  objective: string;
  docLinks: { title: string; url: string }[];
  subSkills: { name: string; weight: number | null }[];
}

export async function saveDomainAction(d: DomainInput): Promise<Result> {
  await requireAdmin();
  const c = db();
  if (!c) return { error: "Supabase is not configured" };
  const title = d.title.trim();
  if (!title) return { error: "Domain name is required" };
  if (!(TRACK_IDS as string[]).includes(d.track)) return { error: "Choose a track" };
  if (!(d.weight >= 0 && d.weight <= 100)) return { error: "Weight must be between 0 and 100" };
  const names = d.subSkills.map((s) => s.name.trim()).filter(Boolean);
  if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) return { error: "Sub-skill names must be unique" };
  if (d.docLinks.some((l) => !/^https?:\/\//i.test(l.url))) return { error: "Doc links need a full http(s) URL" };

  const row = {
    title,
    track: d.track,
    weight: d.weight,
    course_module: d.courseModule,
    objective: d.objective.trim() || null,
    doc_links: d.docLinks.filter((l) => l.title.trim() && l.url.trim()),
  };
  let id = d.id;
  if (id) {
    const { error } = await c.from("quiz_modules").update(row).eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { data: max } = await c.from("quiz_modules").select("order_index").order("order_index", { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await c.from("quiz_modules").insert({ ...row, description: "", locked: false, order_index: (max?.order_index ?? 0) + 1 }).select("id").single();
    if (error) return { error: error.message };
    id = data.id as number;
  }

  // Replace the sub-skill list
  const del = await c.from("quiz_sub_skills").delete().eq("module_id", id);
  if (del.error) return { error: `${del.error.message}. Run the SQL in supabase/migrations/0001_cert_readiness.sql.` };
  const subs = d.subSkills
    .filter((s) => s.name.trim())
    .map((s, i) => ({ module_id: id, name: s.name.trim(), weight: s.weight == null ? null : Number(s.weight), order_index: i + 1 }));
  if (subs.length) {
    const ins = await c.from("quiz_sub_skills").insert(subs);
    if (ins.error) return { error: ins.error.message };
  }
  afterWrite();
  return { id };
}

export async function deleteDomainAction(id: number): Promise<Result> {
  await requireAdmin();
  const c = db();
  if (!c) return { error: "Supabase is not configured" };
  const { error } = await c.from("quiz_modules").delete().eq("id", id); // cascades to its sub-skills and questions
  if (error) return { error: error.message };
  afterWrite();
  return {};
}

export interface QuestionInput {
  id?: number;
  moduleId: number;
  section: string;
  difficulty: string;
  question: string;
  options: [string, string, string, string];
  /** "B" or "A,C" */
  answer: string;
  explanation: string;
}

export async function saveQuestionAction(q: QuestionInput): Promise<Result> {
  await requireAdmin();
  const c = db();
  if (!c) return { error: "Supabase is not configured" };
  if (!q.moduleId) return { error: "Choose a domain" };
  if (!q.section.trim()) return { error: "Sub-skill is required" };
  if (!q.question.trim()) return { error: "Question text is required" };
  if (q.options.some((o) => !o.trim())) return { error: "All four options are required" };
  if (!/^[ABCD](,[ABCD])*$/.test(q.answer)) return { error: "Select at least one correct answer" };
  if (!["Easy", "Medium", "Hard"].includes(q.difficulty)) return { error: "Choose a difficulty" };
  if (/\b(option|answer)\s+[ABCD]\b/i.test(q.explanation)) return { error: "The explanation refers to option letters, but options are shuffled for each learner. Describe the option instead." };

  const row = {
    module_id: q.moduleId,
    section: q.section.trim(),
    difficulty: q.difficulty,
    question: q.question.trim(),
    option_a: q.options[0].trim(),
    option_b: q.options[1].trim(),
    option_c: q.options[2].trim(),
    option_d: q.options[3].trim(),
    answer: q.answer,
    explanation: q.explanation.trim() || null,
  };
  if (q.id) {
    const { error } = await c.from("quiz_questions").update(row).eq("id", q.id);
    if (error) return { error: error.message };
    afterWrite();
    return { id: q.id };
  }
  const { data: max } = await c.from("quiz_questions").select("order_index").eq("module_id", q.moduleId).order("order_index", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await c.from("quiz_questions").insert({ ...row, order_index: (max?.order_index ?? 0) + 1 }).select("id").single();
  if (error) return { error: error.message };
  afterWrite();
  return { id: data.id as number };
}

export async function deleteQuestionAction(id: number): Promise<Result> {
  await requireAdmin();
  const c = db();
  if (!c) return { error: "Supabase is not configured" };
  const { error } = await c.from("quiz_questions").delete().eq("id", id);
  if (error) return { error: error.message };
  afterWrite();
  return {};
}

// ── Reported questions, calls ─────────────────────────────────────────────────

async function requireAdmin() {
  const store = await cookies();
  if (store.get("admin_session")?.value !== SESSION_VALUE) throw new Error("Not authorised");
}

export async function resolveReportAction(id: number, status: "upheld" | "dismissed" | "open"): Promise<{ error?: string }> {
  await requireAdmin();
  const c = db();
  if (!c) return { error: "Supabase is not configured" };
  const { error } = await c
    .from("reported_questions")
    .update({ status, resolved_at: status === "open" ? null : new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/reports");
  return {};
}

/** Advisor logs the call result and whether a course offer was made (call_attended, call_outcome). */
export async function updateCallAction(data: {
  id: number;
  status: "booked" | "attended" | "no_show" | "canceled";
  outcome: string;
  offerMade: boolean;
}): Promise<{ error?: string }> {
  await requireAdmin();
  const c = db();
  if (!c) return { error: "Supabase is not configured" };
  const { data: row, error } = await c
    .from("call_bookings")
    .update({ status: data.status, outcome: data.outcome.slice(0, 2000), offer_made: data.offerMade })
    .eq("id", data.id)
    .select("email")
    .maybeSingle();
  if (error) return { error: error.message };
  const events = [] as { event: string; props: Record<string, unknown>; email: string | null }[];
  if (data.status === "attended") events.push({ event: "call_attended", props: {}, email: row?.email ?? null });
  if (data.outcome || data.offerMade) events.push({ event: "call_outcome", props: { offerMade: data.offerMade, status: data.status }, email: row?.email ?? null });
  if (events.length) await c.from("analytics_events").insert(events);
  revalidatePath("/admin/calls");
  return {};
}
