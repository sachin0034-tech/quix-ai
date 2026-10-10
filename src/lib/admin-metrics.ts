export interface EventRow {
  event: string;
  props: Record<string, unknown> | null;
  session_id: string | null;
  email: string | null;
  created_at: string;
}

export interface Metric {
  key: string;
  label: string;
  value: string;
  target: string;
  /** null = no data yet or no target */
  ok: boolean | null;
  primary: boolean;
}

const pct = (n: number, d: number) => (d > 0 ? n / d : null);
const fmt = (v: number | null) => (v === null ? "n/a" : `${(v * 100).toFixed(1)}%`);

/** Funnel and guardrail metrics from the PRD, derived from analytics_events. */
export function computeMetrics(events: EventRow[], leadCount: number): Metric[] {
  const sessions = (name: string, filter?: (e: EventRow) => boolean) =>
    new Set(events.filter((e) => e.event === name && (!filter || filter(e))).map((e) => e.session_id ?? e.email ?? "?"));
  const count = (name: string) => events.filter((e) => e.event === name).length;

  const landing = sessions("landing_view");
  const answeredQ1 = sessions("question_answered");
  const modalShown = sessions("email_modal_shown");
  const submitted = sessions("email_submitted");
  const fullDone = sessions("module_completed", (e) => e.props?.mode === "full");
  const failed = sessions("fail_report_generated");
  const failedWhoBooked = [...failed].filter((s) => events.some((e) => e.event === "call_booked" && e.session_id === s)).length;

  // Qualified lead: an email with at least 10 answered questions
  const answersByEmail = new Map<string, number>();
  for (const e of events) if (e.event === "question_answered" && e.email) answersByEmail.set(e.email, (answersByEmail.get(e.email) ?? 0) + 1);
  const qualified = [...answersByEmail.values()].filter((n) => n >= 10).length;

  const booked = new Set(events.filter((e) => e.event === "call_booked" && e.email).map((e) => e.email));
  const attended = new Set(events.filter((e) => e.event === "call_attended" && e.email).map((e) => e.email));
  const enrolled = new Set(events.filter((e) => e.event === "course_enrolled" && e.email).map((e) => e.email));
  const enrolledBookers = [...booked].filter((e) => enrolled.has(e)).length;

  const captureRate = pct(submitted.size, answeredQ1.size);
  const dropOff = modalShown.size ? 1 - submitted.size / modalShown.size : null;
  const tutorQuestions = new Set(events.filter((e) => e.event === "tutor_message").map((e) => String(e.props?.questionId)));
  const answeredCount = count("question_answered");
  const reportedRate = pct(count("question_reported"), answeredCount);

  const m = (key: string, label: string, v: number | null, target: string, ok: (v: number) => boolean, primary = false): Metric => ({
    key, label, value: fmt(v), target, ok: v === null ? null : ok(v), primary,
  });

  return [
    m("capture", "Email capture rate (emails / users who answered Q1)", captureRate, ">= 40%", (v) => v >= 0.4, true),
    { key: "qualified", label: "Qualified leads (email + 10 answers)", value: String(qualified), target: "[set from business plan]", ok: null, primary: true },
    { key: "leads", label: "Total leads stored", value: String(leadCount), target: "-", ok: null, primary: false },
    m("enrol", "Lead to course enrolment", pct(enrolled.size, Math.max(leadCount, submitted.size)), ">= 5% within 30 days", (v) => v >= 0.05, true),
    m("failbook", "Failing users who book a 1:1 call", pct(failedWhoBooked, failed.size), ">= 15%", (v) => v >= 0.15, true),
    m("callenrol", "Call to course enrolment", pct(enrolledBookers, booked.size), ">= 25%", (v) => v >= 0.25, true),
    m("q1", "Visitors who answer Q1", pct(answeredQ1.size, landing.size), ">= 50% of landing visitors", (v) => v >= 0.5),
    m("fullmock", "Users who complete a full mock (of leads)", pct(fullDone.size, Math.max(leadCount, submitted.size)), ">= 15%", (v) => v >= 0.15),
    m("attended", "Booked calls attended", pct(attended.size, booked.size), ">= 70%", (v) => v >= 0.7),
    m("tutor", "Tutor use (answered questions with a follow-up)", pct(tutorQuestions.size, answeredCount), ">= 20%", (v) => v >= 0.2),
    m("dropoff", "Guardrail: drop-off at the email modal", dropOff, "< 35%", (v) => v < 0.35),
    m("reported", "Guardrail: reported-question rate", reportedRate, "< 2%", (v) => v < 0.02),
  ];
}
