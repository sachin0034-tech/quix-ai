"use client";

import { useState } from "react";
import type { TrackId } from "@/types/quiz";
import { BOOKING_URL, flags } from "@/lib/config";
import { TRACKS } from "@/lib/blueprint";
import { callRequested, getEmail, getProfile, markCallRequested } from "@/lib/client/store";
import { useEmailGate } from "@/components/EmailGate";

interface Props {
  track: TrackId;
  readiness?: number | null;
  reportUrl?: string | null;
  label?: string;
  variant?: "primary" | "outline";
}

/** Builds the scheduling link pre-filled with name, email, track, readiness, exam date and the report URL. */
export function bookingUrl(track: TrackId, readiness?: number | null, reportUrl?: string | null): string {
  const p = getProfile();
  const u = new URL(BOOKING_URL);
  const email = getEmail();
  if (email) u.searchParams.set("email", email);
  if (p.name) u.searchParams.set("name", p.name);
  // Calendly custom answers a1..a5, in the order of the event's questions
  u.searchParams.set("a1", TRACKS[track].code);
  if (readiness != null) u.searchParams.set("a2", String(readiness));
  if (p.examDate) u.searchParams.set("a3", p.examDate);
  if (reportUrl) u.searchParams.set("a4", reportUrl);
  return u.toString();
}

export default function BookingCTA({ track, readiness, reportUrl, label = "Book a free 30-minute review call", variant = "primary" }: Props) {
  const gate = useEmailGate();
  const [requested, setRequested] = useState(() => (typeof window === "undefined" ? false : callRequested(track)));
  const [waitlisted, setWaitlisted] = useState(false);

  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "14px 22px",
    borderRadius: "9px",
    fontWeight: 700,
    fontSize: "15px",
    fontFamily: "inherit",
    minHeight: "52px",
    textDecoration: "none",
    cursor: "pointer",
    border: variant === "primary" ? "none" : "1px solid #dce3ed",
    background: variant === "primary" ? "#ff9b50" : "#fff",
    color: "#071b39",
  };

  if (!flags.callSlotsOpen) {
    return (
      <button
        disabled={waitlisted}
        style={base}
        onClick={async () => {
          const email = getEmail() ?? (await gate.open({ required: true, title: "Join the waitlist", body: "All advisor slots are taken right now. Add your email and we'll tell you when one opens." }));
          if (!email) return;
          await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, track, source: "waitlist" }) }).catch(() => {});
          setWaitlisted(true);
        }}
      >
        {waitlisted ? "You're on the waitlist" : "Join the waitlist for a free review call"}
      </button>
    );
  }

  return (
    <a
      href={bookingUrl(track, readiness, reportUrl)}
      target="_blank"
      rel="noopener noreferrer"
      style={base}
      onClick={() => {
        markCallRequested(track);
        setRequested(true);
      }}
    >
      {requested ? "Reschedule or open your booking" : label}
    </a>
  );
}
