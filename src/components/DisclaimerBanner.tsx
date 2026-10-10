import { DISCLAIMER } from "@/lib/config";

/** Persistent site-wide banner (PRD: shown on every page). */
export default function DisclaimerBanner() {
  return (
    <div
      role="note"
      style={{
        background: "#f1f5fa",
        borderBottom: "1px solid var(--border)",
        color: "var(--ink)",
        fontSize: "13px",
        lineHeight: 1.5,
        textAlign: "center",
        padding: "7px 16px",
        position: "relative",
        zIndex: 60,
      }}
    >
      {DISCLAIMER}
    </div>
  );
}
