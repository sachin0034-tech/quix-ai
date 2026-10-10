import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { mergeSessionIntoEmail } from "@/lib/server/missed";
import { bad, readJson } from "@/lib/server/http";

interface Body {
  email: string;
  name?: string;
  examDate?: string | null;
  consent?: boolean;
  track?: string;
  source?: string;
  sessionId?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Stores the one lead record per email. Server-side so the browser never needs table access. */
export async function POST(req: Request) {
  const b = await readJson<Body>(req);
  const email = b?.email?.trim().toLowerCase();
  if (!b || !email || email.length > 254 || !EMAIL.test(email)) return bad("Enter a valid email address.");

  const row = {
    email,
    name: b.name?.trim().slice(0, 120) || null,
    exam_date: b.examDate && /^\d{4}-\d{2}-\d{2}$/.test(b.examDate) ? b.examDate : null,
    marketing_consent: !!b.consent,
    track: b.track === "associate" || b.track === "developer" ? b.track : null,
    source: (b.source ?? "modal").slice(0, 40),
  };

  const c = db();
  if (c) {
    let { error } = await c.from("quiz_leads").upsert(row, { onConflict: "email" });
    if (error) {
      // Tables from before the migration only have an email column
      console.warn(`[lead] full upsert failed (${error.message}); retrying with email only`);
      ({ error } = await c.from("quiz_leads").upsert({ email }, { onConflict: "email" }));
      if (error) console.warn(`[lead] email-only upsert failed: ${error.message}`);
    }
  }
  // Carry misses recorded under the anonymous session over to the email, so review works on any device
  if (typeof b.sessionId === "string" && b.sessionId) await mergeSessionIntoEmail(b.sessionId.slice(0, 64), email);
  return NextResponse.json({ ok: true });
}
