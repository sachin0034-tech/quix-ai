"use client";

import { useState } from "react";
import { MODULE_MAX_QUESTION_SECONDS, MODULE_MIN_QUESTION_SECONDS, MODULE_QUESTION_SECONDS } from "@/lib/blueprint";
import Modal from "@/components/Modal";
import Segmented from "@/components/ui/Segmented";
import RangeField from "@/components/ui/RangeField";

/** Shown after a learner picks a module: timed (seconds per question, pause for half points) or no timer at all (full points) */
export default function ModuleStartDialog({ title, detail, seconds, busy, onCancel, onStart }: {
  title: string;
  detail: string;
  /** Last choice: seconds per question, or null for no timer */
  seconds: number | null;
  busy: boolean;
  onCancel: () => void;
  onStart: (seconds: number | null) => void;
}) {
  const [timed, setTimed] = useState(seconds !== null);
  const [secs, setSecs] = useState(seconds ?? MODULE_QUESTION_SECONDS);

  return (
    <Modal labelledBy="module-start-title" describedBy="module-start-detail" onClose={busy ? undefined : onCancel}>
      <h2 className="modal__title" id="module-start-title">{title}</h2>
      <p className="modal__text" id="module-start-detail">{detail}</p>
      <div className="field">
        <span className="field__label" id="module-timer-label">Timer</span>
        <Segmented
          labelledBy="module-timer-label"
          value={timed ? 1 : 0}
          onChange={(v) => setTimed(v === 1)}
          options={[{ value: 1, label: "Timed" }, { value: 0, label: "No Timer" }]}
        />
      </div>
      {timed ? (
        <>
          <RangeField label="Time Per Question (Seconds)" value={secs} min={MODULE_MIN_QUESTION_SECONDS} max={MODULE_MAX_QUESTION_SECONDS} onChange={setSecs} />
          <p className="modal__text">You can pause the timer on any question, but a right answer then earns half a point.</p>
        </>
      ) : (
        <p className="modal__text">No clock on any question. Take your time: a right answer earns the full point.</p>
      )}
      <div className="modal__actions">
        <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" className="btn btn--accent" data-autofocus onClick={() => onStart(timed ? secs : null)} disabled={busy}>
          {busy ? "Starting…" : timed ? `Start (${secs} sec each)` : "Start (No Timer)"}
        </button>
      </div>
    </Modal>
  );
}
