import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db, safeInsert } from "@/lib/server/db";

interface CalendlyPayload {
  event: string;
  payload?: {
    uri?: string;
    email?: string;
    name?: string;
    scheduled_event?: { start_time?: string };
    questions_and_answers?: { question: string; answer: string }[];
  };
}

function validSignature(raw: string, header: string | null): boolean {
  const secret = process.env.CALENDLY_WEBHOOK_SECRET;
  if (!secret) return true; // not configured: accept (documented in .env.example)
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  if (!parts.t || !parts.v1) return false;
  const expected = createHmac("sha256", secret).update(`${parts.t}.${raw}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Calendly -> call_booked / cancellations. Prefill answers carry the report URL, track and readiness. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("calendly-webhook-signature"))) return NextResponse.json({ ok: false }, { status: 401 });
  let body: CalendlyPayload;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const p = body.payload;
  if (!p?.email) return NextResponse.json({ ok: true });

  const qa = Object.fromEntries((p.questions_and_answers ?? []).map((x) => [x.question.toLowerCase(), x.answer]));
  const find = (needle: string) => Object.entries(qa).find(([k]) => k.includes(needle))?.[1] ?? null;
  const reportUrl = find("report");

  if (body.event === "invitee.created") {
    await safeInsert("call_bookings", {
      invitee_uri: p.uri ?? null,
      email: p.email.toLowerCase(),
      name: p.name ?? null,
      start_time: p.scheduled_event?.start_time ?? null,
      track: find("track"),
      readiness: Number(find("readiness")) || null,
      report_url: reportUrl,
      status: "booked",
    });
    await safeInsert("analytics_events", { event: "call_booked", props: { track: find("track") }, email: p.email.toLowerCase() });
  } else if (body.event === "invitee.canceled" && p.uri) {
    await db()?.from("call_bookings").update({ status: "canceled" }).eq("invitee_uri", p.uri);
  }
  return NextResponse.json({ ok: true });
}
