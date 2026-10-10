"use client";

import { useEffect } from "react";
import Link from "next/link";
import { BOOKING_URL } from "@/lib/config";
import { TRACKS, TRACK_IDS } from "@/lib/blueprint";
import type { TrackMeta } from "@/lib/bank";
import type { TrackId } from "@/types/quiz";
import { track as trackEvent } from "@/lib/analytics";
import Header from "@/components/Header";

const CALENDLY_URL = BOOKING_URL;
const BLUE = "#214f91";

type Meta = Record<TrackId, TrackMeta>;

function PrepReportCard({ meta }: { meta: Meta }) {
  const totalQ = TRACK_IDS.reduce((n, t) => n + meta[t].total, 0);
  return (
    <div style={{
      background: "#fff",
      borderRadius: "16px",
      padding: "25px",
      color: "#10213b",
      boxShadow: "0 25px 70px rgba(0,0,0,.15)",
      border: "1px solid #d7e4f8",
      width: "100%",
    }}>
      {/* Top row */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "10px",
        borderBottom: "1px solid #dce3ed",
        paddingBottom: "17px",
        flexWrap: "wrap",
        rowGap: "10px",
      }}>
        <span style={{
          fontSize: "13px",
          fontWeight: 800,
          letterSpacing: ".5px",
          color: "#273b56",
          fontFamily: "var(--font-manrope), sans-serif",
          textTransform: "uppercase",
          margin: 0,
        }}>
          Your Claude Certification Prep
        </span>
        <span style={{
          fontSize: "13px",
          color: "#44536a",
          background: "#f1f5fa",
          borderRadius: "4px",
          padding: "3px 7px",
          fontWeight: 500,
        }}>
          CCAO-F · CCDV-F
        </span>
      </div>

      {/* Stats grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "12px",
        margin: "22px 0 16px",
      }}>
        <div style={{ background: "#f1f5fa", border: "1px solid #dce3ed", borderRadius: "10px", padding: "16px" }}>
          <strong style={{ display: "block", color: "#071b39", fontFamily: "var(--font-manrope), sans-serif", fontSize: "48px", lineHeight: "1.1" }}>
            {totalQ}
          </strong>
          <span style={{ display: "block", color: "#10213b", fontSize: "14px", marginTop: "7px" }}>
            Practice questions
          </span>
        </div>
        <div style={{ background: "#f1f5fa", border: "1px solid #dce3ed", borderRadius: "10px", padding: "16px" }}>
          <strong style={{ display: "block", color: "#071b39", fontFamily: "var(--font-manrope), sans-serif", fontSize: "48px", lineHeight: "1.1" }}>
            {TRACK_IDS.length}
          </strong>
          <span style={{ display: "block", color: "#10213b", fontSize: "14px", marginTop: "7px" }}>
            Exam tracks
          </span>
        </div>
      </div>

      {/* Open modules note */}
      <div style={{ borderLeft: "3px solid #ff9b50", padding: "10px 14px", marginBottom: "18px", background: "#fff3e8" }}>
        <strong style={{ display: "block", fontSize: "14px", color: "#10213b" }}>
          Every module open · Free to start
        </strong>
        <span style={{ display: "block", fontSize: "14px", color: "#10213b" }}>
          Diagnostic, sprints, drills, full mocks
        </span>
      </div>

      {/* Track list */}
      <div>
        {TRACK_IDS.map((id) => (
          <div key={id} style={{
            display: "grid",
            gridTemplateColumns: "76px minmax(0,1fr) 52px",
            gap: "9px",
            alignItems: "start",
            borderBottom: "1px solid #dce3ed",
            padding: "10px 0",
            fontSize: "14px",
            lineHeight: "1.4",
            color: "#10213b",
          }}>
            <span style={{ color: BLUE }}>{TRACKS[id].code}</span>
            <strong style={{ fontWeight: 500, fontSize: "14px" }}>{TRACKS[id].name}</strong>
            <b style={{ textAlign: "right", color: BLUE, fontSize: "14px" }}>{meta[id].total}Q</b>
          </div>
        ))}
      </div>

      {/* Action box */}
      <div style={{ marginTop: "20px", padding: "15px", borderRadius: "8px", background: "#fff3e8", borderLeft: "3px solid #ff9b50" }}>
        <span style={{
          display: "block", fontSize: "13px", letterSpacing: ".4px", color: "#a33f08",
          fontWeight: 800, marginBottom: "6px",
          fontFamily: "var(--font-manrope), sans-serif", textTransform: "uppercase",
        }}>
          Personalised to your answers
        </span>
        <strong style={{ fontSize: "14px", lineHeight: "1.5", display: "block" }}>
          Get a readiness estimate and study plan.
        </strong>
        <p style={{ fontSize: "14px", lineHeight: "1.5", margin: "6px 0 0", color: "#44536a" }}>
          Finish a module to see where to focus next.
        </p>
      </div>

      <p style={{ fontSize: "13px", color: "#64748b", margin: "15px 0 0", lineHeight: "1.55" }}>
        Every module is free. An email unlocks your full report.
      </p>
    </div>
  );
}

const OUTCOMES = [
  {
    n: "01",
    h: "Instant feedback on every answer",
    p: "Wrong picks turn red, the right answer turns green, and a written explanation opens straight away.",
  },
  {
    n: "02",
    h: "A readiness estimate out of 1,000",
    p: "See your estimate on the official scale with the 720 pass line marked, plus percent correct for every domain. It is an estimate, not an official score.",
  },
  {
    n: "03",
    h: "A plan if you fall short",
    p: "Score under 720 on a full mock or the diagnostic and you get a detailed report, a day-by-day study plan, a PDF and an offer of a free review call.",
  },
];

const STEPS = [
  {
    n: "1",
    h: "Pick your track and any module",
    p: "Start with the diagnostic, or jump to a quick sprint, a domain drill or a full mock. Nothing is locked.",
  },
  {
    n: "2",
    h: "Answer and learn on the spot",
    p: "Get red and green feedback with an explanation after every question, and ask the Claude-powered tutor to explain it differently.",
  },
  {
    n: "3",
    h: "See how ready you are",
    p: "Get your readiness estimate, your weakest domain and what to practise next. Retake until it stays at 800 or higher.",
  },
];

const FAQS = [
  {
    q: "Which exams does this cover?",
    a: "The Claude Certified Associate (CCAO-F) and the Claude Certified Developer (CCDV-F). Both tracks are here, with topic modules that follow the official exam-guide domains and weights.",
  },
  {
    q: "Is it free? Why do you ask for my email?",
    a: "Every module is free and open. We ask for your email once, after your first answered question, to save your progress and send your report. You can skip it twice before it is required.",
  },
  {
    q: "How is the readiness estimate calculated?",
    a: "It is your domain-weighted percent correct mapped onto the 100–1,000 scale, with 720 marked as the pass line. Anthropic does not publish how percent maps to the scaled score, so it is labelled an estimate everywhere. We call you ready when it stays at 800 or higher across 2 full mocks.",
  },
  {
    q: "Is this an official Anthropic exam?",
    a: "No. This is an independent practice resource from Agentic AI Institute, not affiliated with or endorsed by Anthropic. It does not reproduce real exam questions, award a certification or guarantee a pass.",
  },
  {
    q: "Will I have to book a call or buy the course?",
    a: "No. You can use the quizzes and your study plan on your own. If you score under 720 you are offered a free 30-minute review call, and the course is an optional next step.",
  },
];

export default function HomeClient({ meta }: { meta: Meta }) {
  const totalQ = TRACK_IDS.reduce((n, t) => n + meta[t].total, 0);

  useEffect(() => {
    trackEvent("landing_view");
  }, []);

  return (
    <>
      <Header />

      <main style={{ minHeight: "100vh", backgroundColor: "#ffffff" }}>

        {/* ── Hero ── */}
        <section style={{ background: "#071b39", color: "white", overflow: "hidden" }}>
          <div className="page-wrap">
            <div className="hero-grid">
              {/* Left: copy */}
              <div>
                <p style={{
                  fontSize: "14px",
                  letterSpacing: "1.4px",
                  fontWeight: 800,
                  color: "#ff9b50",
                  textTransform: "uppercase",
                  margin: "0 0 20px",
                  fontFamily: "var(--font-manrope), sans-serif",
                  lineHeight: "1.5",
                }}>
                  Claude Certification Preparation
                </p>

                <h1 style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  fontSize: "clamp(32px, 4.2vw, 56px)",
                  fontWeight: 800,
                  lineHeight: 1.15,
                  letterSpacing: "-0.035em",
                  color: "#ffffff",
                  margin: 0,
                }}>
                  Claude Certification<br />
                  <em style={{ fontStyle: "normal", color: "#ff9b50" }}>Practice Quiz</em>
                </h1>

                <p style={{
                  fontSize: "18px",
                  lineHeight: 1.65,
                  color: "#c7d4e7",
                  maxWidth: "470px",
                  margin: "24px 0 27px",
                }}>
                  Find out whether you are ready for the Claude Certified Associate or
                  Developer exam. Get instant red and green feedback on every answer and
                  a readiness estimate on the official 1,000-point scale.
                </p>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                {TRACK_IDS.map((id) => (
                <Link
                  key={id}
                  href={`/${id}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "17px 24px",
                    borderRadius: "9px",
                    background: id === "associate" ? "#ff9b50" : "transparent",
                    border: id === "associate" ? "none" : "1.5px solid #ff9b50",
                    color: id === "associate" ? "#071b39" : "#ff9b50",
                    fontWeight: 700,
                    fontSize: "16px",
                    textDecoration: "none",
                    minHeight: "54px",
                    transition: "background .15s, transform .15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.transform = "none";
                  }}
                >
                  {TRACKS[id].short} ({TRACKS[id].code}) →
                </Link>
                ))}
                </div>

                <p style={{ fontSize: "14px", color: "#dce7f7", margin: "13px 0 5px" }}>
                  2 exam tracks · {totalQ} questions · Free · Every module open
                </p>
                <p style={{ fontSize: "14px", lineHeight: 1.55, color: "#b5c5dc", maxWidth: "370px", margin: 0 }}>
                  Pick a track, then any module: a full mock, a domain drill, a quick sprint or the
                  diagnostic. Nothing is locked.
                </p>

                {/* Byline */}
                <div className="hero-byline" style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "center",
                  borderTop: "1px solid rgba(255,255,255,.13)",
                  paddingTop: "24px",
                  marginTop: "28px",
                  fontSize: "14px",
                  color: "#f1f4fa",
                }}>
                  <span style={{
                    background: "#243955",
                    border: "1px solid #4a5b75",
                    borderRadius: "50%",
                    flexShrink: 0,
                    width: "42px",
                    height: "42px",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 700,
                    fontFamily: "var(--font-manrope), sans-serif",
                    color: "white",
                    fontSize: "14px",
                  }}>
                    MY
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ display: "block" }}>Created by Agentic AI Institute</span>
                    <span style={{ display: "block", color: "#b5c5dc", fontSize: "14px", marginTop: "3px" }}>
                      From Mahesh Yadav&apos;s Claude certification preparation program
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: prep report card */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <PrepReportCard meta={meta} />
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats strip ── */}
        <section style={{ borderBottom: "1px solid var(--border)", background: "#ffffff" }}>
          <div className="page-wrap">
            <div className="stats-strip">
              <p style={{ fontSize: "14px", lineHeight: 1.65, margin: 0, color: "var(--muted)" }}>
                Claude Associate and Developer practice from{" "}
                <strong style={{ color: "var(--ink)", fontWeight: 500 }}>Agentic AI Institute</strong>
              </p>
              <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: "22px" }}>
                <b style={{ display: "block", fontSize: "17px", fontWeight: 700, lineHeight: 1.5, color: "var(--ink)" }}>
                  Detailed practice
                </b>
                <span style={{ fontSize: "14px", color: "var(--muted)", display: "block", marginTop: "3px" }}>
                  {totalQ} original questions
                </span>
              </div>
              <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: "22px" }}>
                <b style={{ display: "block", fontSize: "17px", fontWeight: 700, lineHeight: 1.5, color: "var(--ink)" }}>
                  Both exams, one site
                </b>
                <span style={{ fontSize: "14px", color: "var(--muted)", display: "block", marginTop: "3px" }}>
                  Associate and Developer, all modules open
                </span>
              </div>
              <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: "22px" }}>
                <b style={{ display: "block", fontSize: "17px", fontWeight: 700, lineHeight: 1.5, color: "var(--ink)" }}>
                  Instant feedback
                </b>
                <span style={{ fontSize: "14px", color: "var(--muted)", display: "block", marginTop: "3px" }}>
                  Readiness estimate out of 1,000
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Tracks section ── */}
        <section id="tracks" style={{ padding: "80px 0", background: "#F4F6F9" }}>
          <div className="page-wrap">
            <div className="section-head">
              <div>
                <p style={{
                  fontSize: "14px",
                  letterSpacing: "1px",
                  fontWeight: 800,
                  color: BLUE,
                  textTransform: "uppercase",
                  margin: "0 0 16px",
                  fontFamily: "var(--font-manrope), sans-serif",
                }}>
                  Choose your exam
                </p>
                <h2 style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  fontSize: "clamp(30px, 3.4vw, 42px)",
                  fontWeight: 800,
                  color: "var(--ink)",
                  margin: 0,
                  letterSpacing: "-0.035em",
                }}>
                  Two exams.<br />Every module open.
                </h2>
              </div>
              <p style={{ color: "var(--muted)", margin: 0, fontSize: "16px", lineHeight: 1.65 }}>
                Each track offers a readiness diagnostic, quick sprints, domain drills and a
                full mock that copies the real exam format and domain weights.
              </p>
            </div>

            <div className="module-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
              {TRACK_IDS.map((id) => {
                const t = TRACKS[id];
                return (
                  <Link key={id} href={`/${id}`} onClick={() => trackEvent("track_selected", { track: id, via: "home" })} style={{ textDecoration: "none", display: "flex" }}>
                    <article style={{
                      border: "1px solid #dce3ed",
                      borderRadius: "10px",
                      padding: "23px 19px",
                      background: "white",
                      display: "flex",
                      flexDirection: "column",
                      width: "100%",
                      cursor: "pointer",
                    }}>
                      <span style={{
                        display: "block",
                        color: BLUE,
                        fontSize: "14px",
                        fontWeight: 800,
                        letterSpacing: "1px",
                        marginBottom: "27px",
                        fontFamily: "var(--font-manrope), sans-serif",
                      }}>
                        {t.code} / Open access
                      </span>
                      <h3 style={{
                        fontFamily: "var(--font-manrope), sans-serif",
                        fontSize: "22px",
                        lineHeight: 1.35,
                        fontWeight: 800,
                        color: "var(--ink)",
                        margin: "0 0 14px",
                        letterSpacing: "-0.025em",
                      }}>
                        {t.name}
                      </h3>
                      <p style={{ fontSize: "15px", color: "var(--muted)", lineHeight: 1.7, margin: 0, flex: 1 }}>
                        {t.audience} {meta[id].domains.length} domains, {t.items} questions in {t.minutes} minutes on the real exam.
                      </p>
                      <span style={{
                        display: "block",
                        fontSize: "14px",
                        color: "#654a39",
                        borderTop: "1px solid #dce3ed",
                        paddingTop: "14px",
                        marginTop: "24px",
                      }}>
                        {meta[id].total} practice questions · diagnostic, sprint, drill, full mock
                      </span>
                      <span style={{
                        display: "block",
                        width: "100%",
                        marginTop: "16px",
                        padding: "12px 18px",
                        borderRadius: "9px",
                        border: "1px solid #dce3ed",
                        background: "white",
                        color: "var(--ink)",
                        fontWeight: 700,
                        fontSize: "14px",
                        textAlign: "center",
                        lineHeight: 1.3,
                        minHeight: "44px",
                      }}>
                        Practice {t.short} →
                      </span>
                    </article>
                  </Link>
                );
              })}
            </div>

            <p style={{ fontSize: "14px", color: "var(--muted)", margin: "18px 0 0" }}>
              Topic modules follow the official exam-guide domains and weights (v1.0, July 2026).
              Practice questions are original and independent; the readiness score is an estimate.
            </p>
          </div>
        </section>

        {/* ── Outcomes / results section ── */}
        <section style={{ background: "#ffffff" }}>
          <div className="page-wrap">
            <div className="outcomes-grid">
              <div>
                <p style={{
                  fontSize: "14px",
                  letterSpacing: "1.4px",
                  fontWeight: 800,
                  color: BLUE,
                  textTransform: "uppercase",
                  margin: "0 0 20px",
                  fontFamily: "var(--font-manrope), sans-serif",
                }}>
                  Turn your score into a revision plan
                </p>
                <h2 style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  fontSize: "clamp(30px, 3.4vw, 42px)",
                  fontWeight: 800,
                  color: "var(--ink)",
                  margin: 0,
                  letterSpacing: "-0.035em",
                }}>
                  Know what to<br />revise next.
                </h2>
                <p style={{ color: "var(--muted)", maxWidth: "335px", margin: "22px 0", fontSize: "16px", lineHeight: 1.65 }}>
                  Use your answers to focus your certification preparation on the
                  areas that need more practice.
                </p>
              </div>

              <div style={{ display: "grid", gap: "25px" }}>
                {OUTCOMES.map(({ n, h, p }) => (
                  <article key={n} style={{ display: "flex", gap: "20px" }}>
                    <span style={{
                      border: "1px solid #cdd9e9",
                      borderRadius: "50%",
                      minWidth: "38px",
                      height: "38px",
                      display: "grid",
                      placeContent: "center",
                      fontSize: "14px",
                      color: BLUE,
                      background: "white",
                      flexShrink: 0,
                      fontWeight: 600,
                    }}>
                      {n}
                    </span>
                    <div>
                      <h3 style={{
                        fontFamily: "var(--font-manrope), sans-serif",
                        fontSize: "19px",
                        fontWeight: 800,
                        margin: 0,
                        letterSpacing: "-0.025em",
                        color: "var(--ink)",
                      }}>
                        {h}
                      </h3>
                      <p style={{ fontSize: "15px", color: "var(--muted)", margin: "9px 0 0", lineHeight: 1.65 }}>
                        {p}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section style={{ padding: "80px 0", background: "#F4F6F9" }}>
          <div className="page-wrap">
            <div style={{ textAlign: "center", marginBottom: "38px" }}>
              <p style={{
                fontSize: "14px",
                letterSpacing: "1.4px",
                fontWeight: 800,
                color: BLUE,
                textTransform: "uppercase",
                margin: "0 0 16px",
                fontFamily: "var(--font-manrope), sans-serif",
              }}>
                How it works
              </p>
              <h2 style={{
                fontFamily: "var(--font-manrope), sans-serif",
                fontSize: "clamp(30px, 3.4vw, 42px)",
                fontWeight: 800,
                color: "var(--ink)",
                margin: 0,
                letterSpacing: "-0.035em",
              }}>
                Take the test. Learn from every answer.
              </h2>
            </div>

            <div className="steps-grid">
              {STEPS.map(({ n, h, p }) => (
                <article key={n} style={{ position: "relative", paddingLeft: "50px" }}>
                  <span style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "#071b39",
                    color: "white",
                    display: "grid",
                    placeContent: "center",
                    fontSize: "14px",
                    fontWeight: 700,
                  }}>
                    {n}
                  </span>
                  <h3 style={{
                    fontFamily: "var(--font-manrope), sans-serif",
                    fontSize: "17px",
                    fontWeight: 800,
                    margin: 0,
                    paddingTop: "4px",
                    letterSpacing: "-0.025em",
                    color: "var(--ink)",
                  }}>
                    {h}
                  </h3>
                  <p style={{ color: "var(--muted)", fontSize: "15px", margin: "12px 0 0", lineHeight: 1.65 }}>
                    {p}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Cohort / unlock banner ── */}
        <section style={{ paddingBottom: "80px", background: "#ffffff" }}>
          <div className="page-wrap">
            <div style={{
              background: "#071b39",
              borderRadius: "14px",
              padding: "46px",
              color: "white",
            }}>
              <div className="cohort-grid">
                <div>
                  <p style={{
                    fontSize: "14px",
                    letterSpacing: "1.4px",
                    fontWeight: 800,
                    color: "#ff9b50",
                    textTransform: "uppercase",
                    margin: "0 0 16px",
                    fontFamily: "var(--font-manrope), sans-serif",
                  }}>
                    Want guided certification preparation?
                  </p>
                  <h2 style={{
                    fontFamily: "var(--font-manrope), sans-serif",
                    fontSize: "clamp(26px, 2.5vw, 34px)",
                    fontWeight: 800,
                    color: "white",
                    margin: 0,
                    lineHeight: 1.25,
                    letterSpacing: "-0.025em",
                  }}>
                    Prepare for Claude certification.<br />
                    Build with Claude Code.
                  </h2>
                  <p style={{ fontSize: "16px", color: "#c7d4e7", margin: "22px 0", lineHeight: 1.65 }}>
                    Score under 720 and get a free 30-minute 1-on-1 review of your results,
                    with a personal study plan for Claude Certified Associate or Developer.
                  </p>
                  <a
                    href={CALENDLY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: "14px", color: "#ff9b50", textUnderlineOffset: "5px", textDecoration: "underline" }}
                  >
                    Book a free 1-on-1 call
                  </a>
                </div>

                <div
                  className="cohort-aside-border"
                  style={{
                    borderLeft: "1px solid rgba(255,255,255,.15)",
                    paddingLeft: "40px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "flex-start",
                  }}
                >
                  <span style={{
                    fontSize: "14px",
                    color: "#aebfd8",
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                    fontWeight: 800,
                    fontFamily: "var(--font-manrope), sans-serif",
                    marginBottom: "16px",
                    display: "block",
                  }}>
                    Start with a practice score
                  </span>
                  <h3 style={{
                    fontFamily: "var(--font-manrope), sans-serif",
                    fontSize: "24px",
                    lineHeight: 1.4,
                    fontWeight: 800,
                    color: "white",
                    margin: "0 0 22px",
                    letterSpacing: "-0.025em",
                  }}>
                    Put your Claude knowledge to the test.
                  </h3>
                  <Link
                    href="#tracks"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "17px 24px",
                      borderRadius: "9px",
                      background: "#ff9b50",
                      color: "#071b39",
                      fontWeight: 700,
                      fontSize: "14px",
                      textDecoration: "none",
                      minHeight: "54px",
                      transition: "background .15s, transform .15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.background = "#ffb77e";
                      (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.background = "#ff9b50";
                      (e.currentTarget as HTMLAnchorElement).style.transform = "none";
                    }}
                  >
                    Choose your exam →
                  </Link>
                  <p style={{ fontSize: "14px", color: "#b8c8df", maxWidth: "270px", margin: "14px 0 0", lineHeight: 1.65 }}>
                    No purchase or call booking required.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ── FAQ ── */}
        <section style={{ padding: "80px 0", background: "#F4F6F9", borderTop: "1px solid var(--border)" }}>
          <div className="page-wrap">
            <div className="faq-grid">
              <div>
                <p style={{
                  fontSize: "14px",
                  letterSpacing: "1.4px",
                  fontWeight: 800,
                  color: BLUE,
                  textTransform: "uppercase",
                  margin: "0 0 16px",
                  fontFamily: "var(--font-manrope), sans-serif",
                }}>
                  Before you start
                </p>
                <h2 style={{
                  fontFamily: "var(--font-manrope), sans-serif",
                  fontSize: "clamp(30px, 3.4vw, 42px)",
                  fontWeight: 800,
                  color: "var(--ink)",
                  margin: 0,
                  letterSpacing: "-0.035em",
                }}>
                  A few answers.
                </h2>
              </div>

              <div>
                {FAQS.map(({ q, a }) => (
                  <details key={q} className="faq-details">
                    <summary>{q}</summary>
                    <p>{a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section style={{ background: "#071b39", textAlign: "center", color: "white", padding: "60px 0" }}>
          <div className="page-wrap">
            <p style={{
              fontSize: "14px",
              letterSpacing: "1.4px",
              fontWeight: 800,
              color: "#ff9b50",
              textTransform: "uppercase",
              margin: "0 0 20px",
              fontFamily: "var(--font-manrope), sans-serif",
            }}>
              Prepare with a clear revision plan
            </p>
            <h2 style={{
              fontFamily: "var(--font-manrope), sans-serif",
              fontSize: "clamp(30px, 4vw, 42px)",
              fontWeight: 800,
              color: "white",
              margin: "0 0 27px",
              letterSpacing: "-0.035em",
            }}>
              Find out if you are<br />ready to certify.
            </h2>
            <Link
              href="#tracks"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "17px 32px",
                borderRadius: "9px",
                background: "#ff9b50",
                color: "#071b39",
                fontWeight: 700,
                fontSize: "16px",
                textDecoration: "none",
                minHeight: "54px",
                transition: "background .15s, transform .15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "#ffb77e";
                (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "#ff9b50";
                (e.currentTarget as HTMLAnchorElement).style.transform = "none";
              }}
            >
              Choose your exam →
            </Link>
            <p style={{ fontSize: "14px", color: "#b8c8df", margin: "17px 0 0" }}>
              Every module open · Instant explanations · Free retakes
            </p>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer style={{ borderTop: "1px solid var(--border)" }}>
          <div className="page-wrap" style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "20px",
            paddingTop: "26px",
            paddingBottom: "26px",
            fontSize: "14px",
            color: "var(--muted)",
            flexWrap: "wrap",
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/agentic-ai-logo-cropped.png" alt="Agentic AI Institute" style={{ height: "36px", width: "auto" }} />
            <span>Claude Certification Practice Quiz · Independent, not affiliated with Anthropic</span>
            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: "3px" }}
            >
              Book a 1-on-1 call
            </a>
          </div>
        </footer>
      </main>
    </>
  );
}
