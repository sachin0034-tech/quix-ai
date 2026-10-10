/** The analytics events from the PRD. */
export const EVENTS = [
  "landing_view",
  "track_selected",
  "module_started",
  "question_answered",
  "email_modal_shown",
  "email_submitted",
  "email_skipped",
  "module_completed",
  "tutor_opened",
  "tutor_message",
  "question_reported",
  "fail_report_generated",
  "fail_report_emailed",
  "report_pdf_downloaded",
  "call_booked",
  "call_attended",
  "call_outcome",
  "course_cta_clicked",
  "course_enrolled",
] as const;

export type AnalyticsEvent = (typeof EVENTS)[number];
