"use client";

import { useTransition } from "react";
import { resolveReportAction } from "@/app/admin/actions";

export default function ReportActions({ id, status }: { id: number; status: string }) {
  const [pending, start] = useTransition();
  const btn: React.CSSProperties = { padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "#fff", cursor: "pointer", marginRight: 8, fontFamily: "inherit" };
  return (
    <div style={{ marginTop: 8 }}>
      {status !== "upheld" && <button disabled={pending} style={btn} onClick={() => start(() => void resolveReportAction(id, "upheld"))}>Upheld (taken down / fixed)</button>}
      {status !== "dismissed" && <button disabled={pending} style={btn} onClick={() => start(() => void resolveReportAction(id, "dismissed"))}>Dismiss</button>}
      {status !== "open" && <button disabled={pending} style={btn} onClick={() => start(() => void resolveReportAction(id, "open"))}>Reopen</button>}
    </div>
  );
}
