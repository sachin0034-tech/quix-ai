"use client";

import Link from "next/link";

import { BOOKING_URL } from "@/lib/config";

const CALENDLY_URL = BOOKING_URL;

export default function Header({ moduleTitle }: { moduleTitle?: string }) {
  const onQuizPage = !!moduleTitle;

  return (
    <header style={{
      background: "#ffffff",
      borderBottom: "1px solid var(--border)",
      position: "sticky",
      top: 0,
      zIndex: 50,
      flexShrink: 0,
    }}>
      <div className="page-wrap" style={{
        minHeight: "88px",
        display: "flex",
        alignItems: "center",
        gap: "20px",
        position: "relative",
      }}>

        {/* Brand mark */}
        <Link
          href="/"
          style={{
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
          }}
          aria-label="Agentic AI Institute home"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/agentic-ai-logo-cropped.png"
            alt="Agentic AI Institute"
            className="nav-logo-img"
            style={{ height: "52px", width: "auto" }}
          />
        </Link>

        {/* Center label */}
        <span className="nav-label-center" style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: "14px",
          color: "var(--muted)",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "360px",
        }}>
          {moduleTitle ?? "Claude Certification Practice Quiz"}
        </span>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* CTA */}
        {onQuizPage ? (
          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="nav-book-btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "11px 18px",
              border: "1px solid var(--border)",
              borderRadius: "9px",
              fontSize: "14px",
              fontWeight: 700,
              color: "var(--ink)",
              textDecoration: "none",
              transition: "border-color 0.15s, background 0.15s",
              whiteSpace: "nowrap",
              minHeight: "42px",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border-hover)";
              (e.currentTarget as HTMLAnchorElement).style.background = "var(--canvas)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
            }}
          >
            Book 1-on-1 feedback
          </a>
        ) : (
          <Link
            href="/#tracks"
            className="nav-book-btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "11px 18px",
              border: "1px solid var(--border)",
              borderRadius: "9px",
              fontSize: "14px",
              fontWeight: 700,
              color: "var(--ink)",
              textDecoration: "none",
              transition: "border-color 0.15s, background 0.15s",
              whiteSpace: "nowrap",
              minHeight: "42px",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border-hover)";
              (e.currentTarget as HTMLAnchorElement).style.background = "var(--canvas)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
            }}
          >
            Choose your exam
          </Link>
        )}
      </div>
    </header>
  );
}
