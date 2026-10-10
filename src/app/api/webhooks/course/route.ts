import { NextResponse } from "next/server";
import { safeInsert } from "@/lib/server/db";
import { readJson } from "@/lib/server/http";

/** The course platform posts here when a lead enrols (course_enrolled). Shared-secret header required. */
export async function POST(req: Request) {
  const secret = process.env.COURSE_WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-webhook-secret") !== secret) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await readJson<{ email?: string; course?: string }>(req);
  if (!b?.email) return NextResponse.json({ ok: false }, { status: 400 });
  await safeInsert("analytics_events", { event: "course_enrolled", props: { course: b.course ?? null }, email: b.email.toLowerCase() });
  return NextResponse.json({ ok: true });
}
