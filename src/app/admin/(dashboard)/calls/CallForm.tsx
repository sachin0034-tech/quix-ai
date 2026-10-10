"use client";

import { useState, useTransition } from "react";
import { updateCallAction } from "@/app/admin/actions";

type Status = "booked" | "attended" | "no_show" | "canceled";

export default function CallForm({ id, status, outcome, offerMade }: { id: number; status: string; outcome: string; offerMade: boolean }) {
  const [s, setS] = useState<Status>(status as Status);
  const [o, setO] = useState(outcome);
  const [offer, setOffer] = useState(offerMade);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await updateCallAction({ id, status: s, outcome: o, offerMade: offer });
          setMsg(r.error ?? "Saved");
        });
      }}
      style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
    >
      <select value={s} onChange={(e) => setS(e.target.value as Status)} style={{ padding: 6 }}>
        <option value="booked">Booked</option><option value="attended">Attended</option><option value="no_show">No-show</option><option value="canceled">Canceled</option>
      </select>
      <input value={o} onChange={(e) => setO(e.target.value)} placeholder="Outcome notes" style={{ flex: 1, minWidth: 200, padding: 6 }} />
      <label style={{ fontSize: 14 }}><input type="checkbox" checked={offer} onChange={(e) => setOffer(e.target.checked)} /> Course offer made</label>
      <button disabled={pending} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "var(--navy)", color: "#fff", cursor: "pointer" }}>Save</button>
      {msg && <span style={{ fontSize: 13, color: "var(--muted)" }}>{msg}</span>}
    </form>
  );
}
