"use client";

import type { AnalyticsEvent } from "./analytics-events";

const SESSION_KEY = "quix_session_id";

function sessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

/** Fire-and-forget event. Never throws and never blocks the UI. */
export function track(event: AnalyticsEvent, props: Record<string, unknown> = {}): void {
  try {
    const email = localStorage.getItem("quix_user_email") ?? undefined;
    const body = JSON.stringify({ event, props, sessionId: sessionId(), email });
    if (navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" }))) return;
    void fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
  } catch {
    /* analytics must never break the product */
  }
}
