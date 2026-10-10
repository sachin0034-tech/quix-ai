import { NextResponse } from "next/server";
import { safeInsert } from "@/lib/server/db";
import { readJson } from "@/lib/server/http";
import { EVENTS } from "@/lib/analytics-events";

/** Analytics sink. Unknown event names are dropped so the table stays clean. */
export async function POST(req: Request) {
  const b = await readJson<{ event: string; props?: Record<string, unknown>; sessionId?: string; email?: string }>(req);
  if (!b || !(EVENTS as readonly string[]).includes(b.event)) return NextResponse.json({ ok: false }, { status: 400 });
  await safeInsert("analytics_events", {
    event: b.event,
    props: b.props ?? {},
    session_id: b.sessionId?.slice(0, 64) ?? null,
    email: b.email?.slice(0, 254) ?? null,
  });
  return NextResponse.json({ ok: true });
}
