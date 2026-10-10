"use client";

import { useRef, useState } from "react";
import type { PublicQuestion } from "@/types/quiz";
import { TUTOR_MAX_TURNS } from "@/lib/config";
import { track } from "@/lib/analytics";
import { getEmail } from "@/lib/client/store";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const CHIPS = ["Explain it like I'm not technical", "Why are the other options wrong?", "Give me an example"];

/**
 * "Explain it differently" tutor. Never blocks the quiz: if the model is unavailable the static
 * explanation above stays and a short notice appears here.
 */
export default function TutorPanel({
  question,
  seed,
  answered,
}: {
  question: PublicQuestion;
  seed: string;
  answered: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [reported, setReported] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const turns = msgs.filter((m) => m.role === "user").length;
  const capped = turns >= TUTOR_MAX_TURNS;

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy || capped) return;
    const next: Msg[] = [...msgs, { role: "user", content }];
    setMsgs([...next, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    setUnavailable(false);
    track("tutor_message", { questionId: question.id, turn: turns + 1 });
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed, questionId: question.id, answered, messages: next }),
      });
      if (!res.ok || !res.body) throw new Error("unavailable");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMsgs([...next, { role: "assistant", content: acc }]);
        endRef.current?.scrollIntoView({ block: "nearest" });
      }
      if (!acc.trim()) throw new Error("empty");
    } catch {
      setMsgs(next);
      setUnavailable(true);
    } finally {
      setBusy(false);
    }
  }

  async function report() {
    setReported(true);
    track("question_reported", { questionId: question.id });
    try {
      await fetch("/api/report-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, email: getEmail() ?? undefined }),
      });
    } catch {
      /* reporting is best effort */
    }
  }

  const btn: React.CSSProperties = {
    padding: "9px 14px",
    borderRadius: "9px",
    border: "1px solid var(--border)",
    background: "#fff",
    color: "var(--ink)",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  };

  return (
    <div style={{ marginTop: "16px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
        <button
          onClick={() => {
            if (!open) track("tutor_opened", { questionId: question.id });
            setOpen(!open);
          }}
          aria-expanded={open}
          style={{ ...btn, borderColor: "var(--accent)", background: "#fff3e8" }}
        >
          {open ? "Hide tutor" : "Explain it differently"}
        </button>
        <button onClick={report} disabled={reported} style={{ ...btn, color: "var(--muted)", cursor: reported ? "default" : "pointer" }}>
          {reported ? "Thanks, sent for review" : "Report this question"}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: "12px", border: "1px solid var(--border)", borderRadius: "var(--r-card)", padding: "16px", background: "#fff" }}>
          <p style={{ margin: "0 0 10px", fontSize: "13px", color: "var(--muted)" }}>
            {answered
              ? "Ask a follow-up about this question. The answer key never changes; if you think it's wrong, report it."
              : "This question isn't answered yet, so the tutor will only give you a hint about the concept."}{" "}
            {turns} of {TUTOR_MAX_TURNS} follow-ups used.
          </p>

          <div aria-live="polite" style={{ display: "grid", gap: "10px", maxHeight: "320px", overflowY: "auto" }}>
            {msgs.map((m, i) => (
              <div
                key={i}
                style={{
                  justifySelf: m.role === "user" ? "end" : "start",
                  maxWidth: "92%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  background: m.role === "user" ? "var(--wash)" : "var(--canvas)",
                  fontSize: "15px",
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.content || "…"}
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {unavailable && (
            <p role="status" style={{ margin: "10px 0 0", fontSize: "14px", color: "var(--incorrect-text)" }}>
              ✗ Tutor unavailable, try again shortly. The written explanation above still applies and the quiz is not affected.
            </p>
          )}

          {capped ? (
            <p style={{ margin: "10px 0 0", fontSize: "14px", color: "var(--muted)" }}>
              You&apos;ve used the {TUTOR_MAX_TURNS} follow-ups for this question. Try a domain drill on &ldquo;{question.subSkill}&rdquo; to keep practising.
            </p>
          ) : (
            <>
              {msgs.length === 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "4px" }}>
                  {CHIPS.map((c) => (
                    <button key={c} onClick={() => send(c)} style={{ ...btn, fontWeight: 500, fontSize: "13px" }}>
                      {c}
                    </button>
                  ))}
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(input);
                }}
                style={{ display: "flex", gap: "8px", marginTop: "12px" }}
              >
                <label htmlFor={`tutor-${question.id}`} style={{ position: "absolute", left: "-9999px" }}>
                  Ask the tutor
                </label>
                <input
                  id={`tutor-${question.id}`}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Why B and not D?"
                  maxLength={500}
                  style={{ flex: 1, padding: "11px 14px", borderRadius: "var(--r-input)", border: "1.5px solid var(--border)", fontSize: "15px", fontFamily: "inherit", color: "var(--ink)" }}
                />
                <button type="submit" disabled={busy || !input.trim()} style={{ ...btn, background: "var(--navy)", color: "#fff", borderColor: "var(--navy)", opacity: busy || !input.trim() ? 0.6 : 1 }}>
                  Ask
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
