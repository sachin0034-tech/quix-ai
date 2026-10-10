"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { EMAIL_MODAL_AFTER, MAX_EMAIL_SKIPS, flags } from "@/lib/config";
import { EMAIL_KEY, answeredTotal, getEmail, getLearner, getProfile, saveProfile } from "@/lib/client/store";
import { track } from "@/lib/analytics";

const SKIPS_KEY = "quix_email_skips";

interface OpenOptions {
  /** Cannot be dismissed (used when the report needs an address) */
  required?: boolean;
  title?: string;
  body?: string;
}

interface EmailGateApi {
  email: string | null;
  /** True while the capture modal is on screen (the quiz pauses behind it) */
  modalOpen: boolean;
  /** Call after every checked answer. Shows the modal once per person (after Q1 by default). */
  onAnswered: () => void;
  /** Ask for an email on demand, e.g. to unlock the full report. Resolves with the email or null. */
  open: (opts?: OpenOptions) => Promise<string | null>;
}

const Ctx = createContext<EmailGateApi>({ email: null, modalOpen: false, onAnswered: () => {}, open: async () => null });
export const useEmailGate = () => useContext(Ctx);

const getSkips = () => {
  try {
    return Number(localStorage.getItem(SKIPS_KEY) ?? 0);
  } catch {
    return 0;
  }
};

export function EmailGateProvider({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [modal, setModal] = useState<{ required: boolean; opts: OpenOptions; counted: boolean } | null>(null);
  const resolver = useRef<((v: string | null) => void) | null>(null);

  const [input, setInput] = useState("");
  const [name, setName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage after mount
    setEmail(getEmail());
    const p = getProfile();
    setName(p.name ?? "");
    setExamDate(p.examDate ?? "");
  }, []);

  const close = useCallback((value: string | null) => {
    setModal(null);
    resolver.current?.(value);
    resolver.current = null;
  }, []);

  const open = useCallback((opts: OpenOptions = {}) => {
    if (getEmail()) return Promise.resolve(getEmail());
    setModal({ required: !!opts.required, opts, counted: false });
    return new Promise<string | null>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const onAnswered = useCallback(() => {
    if (!flags.emailModal || getEmail() || modal) return;
    const answered = answeredTotal();
    if (answered < EMAIL_MODAL_AFTER) return;
    // Skippable twice, then the modal becomes required
    const required = getSkips() >= MAX_EMAIL_SKIPS;
    setModal({ required, opts: {}, counted: true });
    resolver.current = null;
    track("email_modal_shown", { afterAnswers: answered, required });
  }, [modal]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, name, examDate: examDate || null, consent, source: "modal", sessionId: getLearner().sessionId }),
      });
    } catch {
      /* the lead is also kept locally; the quiz must never be blocked by a network error */
    }
    try {
      localStorage.setItem(EMAIL_KEY, trimmed);
    } catch {}
    saveProfile({ name: name || undefined, examDate: examDate || undefined });
    setEmail(trimmed);
    track("email_submitted", { consent, hasName: !!name, hasExamDate: !!examDate });
    setLoading(false);
    close(trimmed);
  }

  function handleSkip() {
    if (modal?.counted) {
      try {
        localStorage.setItem(SKIPS_KEY, String(getSkips() + 1));
      } catch {}
      track("email_skipped", { skips: getSkips() });
    }
    close(null);
  }

  const required = modal?.required ?? false;
  const field: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: "var(--r-input)",
    border: "1.5px solid var(--border)",
    fontSize: "15px",
    color: "var(--ink)",
    outline: "none",
    background: "#fff",
    fontFamily: "inherit",
  };
  const label: React.CSSProperties = { display: "block", fontSize: "13px", fontWeight: 600, color: "var(--ink)", margin: "14px 0 6px" };

  return (
    <Ctx.Provider value={{ email, modalOpen: !!modal, onAnswered, open }}>
      {modal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="email-modal-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(15,27,51,.7)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            padding: "16px",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "var(--r-feature)",
              padding: "36px 36px 28px",
              maxWidth: "480px",
              width: "100%",
              boxShadow: "var(--shadow-feature)",
              position: "relative",
              margin: "auto",
            }}
          >
            {!required && (
              <button
                onClick={handleSkip}
                aria-label="Skip and close"
                style={{
                  position: "absolute",
                  top: "16px",
                  right: "16px",
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  border: "1px solid var(--border)",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: "18px",
                  lineHeight: 1,
                  color: "var(--muted)",
                }}
              >
                ×
              </button>
            )}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/agentic-ai-logo-cropped.png" alt="Agentic AI Institute" style={{ height: "34px", width: "auto", marginBottom: "18px" }} />

            <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "10px" }}>
              <div style={{ width: "7px", height: "7px", borderRadius: "2px", background: "var(--accent)" }} />
              <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.6px", textTransform: "uppercase", color: "var(--muted)" }}>
                Claude Certification Practice Quiz
              </span>
            </div>

            <h2 id="email-modal-title" style={{ fontSize: "24px", fontWeight: 700, color: "var(--ink)", margin: "0 0 8px", lineHeight: 1.25, letterSpacing: "-0.02em" }}>
              {modal.opts.title ?? "Save your progress"}
            </h2>
            <p style={{ fontSize: "15px", lineHeight: 1.6, color: "var(--muted)", margin: "0 0 6px" }}>
              {modal.opts.body ??
                (required
                  ? "Add your email to keep going. It keeps your progress and sends your readiness report."
                  : "Add your email to keep your progress and get your readiness report. You can skip this for now.")}
            </p>

            <form onSubmit={handleSubmit}>
              <label htmlFor="gate-email" style={label}>Email address</label>
              <input
                id="gate-email"
                type="email"
                placeholder="you@company.com"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setError("");
                }}
                autoFocus
                autoComplete="email"
                aria-invalid={!!error}
                style={{ ...field, borderColor: error ? "var(--incorrect-text)" : "var(--border)" }}
              />
              {error && <p role="alert" style={{ fontSize: "13px", color: "var(--incorrect-text)", margin: "6px 0 0" }}>✗ {error}</p>}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label htmlFor="gate-name" style={label}>Name (optional)</label>
                  <input id="gate-name" type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" style={field} />
                </div>
                <div>
                  <label htmlFor="gate-date" style={label}>Exam date (optional)</label>
                  <input id="gate-date" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} style={field} />
                </div>
              </div>

              <label style={{ display: "flex", alignItems: "flex-start", gap: "9px", fontSize: "13px", color: "var(--muted)", marginTop: "16px", cursor: "pointer", lineHeight: 1.5 }}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ width: "18px", height: "18px", flexShrink: 0, marginTop: "1px" }} />
                <span>Send me study tips and course updates by email. I&apos;ll confirm my address first and can unsubscribe in one click. (Optional)</span>
              </label>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: "18px",
                  width: "100%",
                  padding: "14px",
                  borderRadius: "9px",
                  border: "none",
                  background: "var(--accent)",
                  color: "var(--navy)",
                  fontSize: "16px",
                  fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                  fontFamily: "inherit",
                  minHeight: "52px",
                }}
              >
                {loading ? "Saving…" : "Save my progress and keep going"}
              </button>

              {!required && (
                <button
                  type="button"
                  onClick={handleSkip}
                  style={{
                    marginTop: "10px",
                    width: "100%",
                    padding: "10px",
                    borderRadius: "var(--r-card)",
                    border: "1px solid var(--border)",
                    background: "#fff",
                    color: "var(--muted)",
                    fontSize: "14px",
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {modal.counted ? "Skip for now" : "Not now"}
                </button>
              )}

              <p style={{ fontSize: "12px", color: "var(--muted)", textAlign: "center", margin: "14px 0 0" }}>
                See our <Link href="/privacy" style={{ color: "inherit" }}>privacy policy</Link>. Independent practice resource, not affiliated with Anthropic.
              </p>
            </form>
          </div>
        </div>
      )}
      {children}
    </Ctx.Provider>
  );
}
