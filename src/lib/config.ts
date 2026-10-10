/** Central product configuration. Env-backed values are public (NEXT_PUBLIC_*). */

export const PASS_SCORE = 720;
export const READY_SCORE = 800;
export const SCORE_MIN = 100;
export const SCORE_MAX = 1000;
/** Official exam pace: 120 minutes for 60 items */
export const PACE_SECONDS = 120;

export const DISCLAIMER = "Independent practice resource. Not affiliated with or endorsed by Anthropic.";

export const BOOKING_URL =
  process.env.NEXT_PUBLIC_BOOKING_URL ?? "https://calendly.com/d/dtdk-7jq-xwm/1-1";

/** Course page the site links out to (price/URL are a business decision; override via env). */
export const COURSE_URL = process.env.NEXT_PUBLIC_COURSE_URL ?? "https://maven.com/mahesh-yadav/genaipm";

export const flags = {
  /** Email capture modal. Roll back by setting NEXT_PUBLIC_FLAG_EMAIL_MODAL=off */
  emailModal: process.env.NEXT_PUBLIC_FLAG_EMAIL_MODAL !== "off",
  /** AI tutor. Roll back by setting NEXT_PUBLIC_FLAG_TUTOR=off */
  tutor: process.env.NEXT_PUBLIC_FLAG_TUTOR !== "off",
  /** Optional "Exam conditions" toggle on full mocks (PRD V1.1) */
  examConditions: process.env.NEXT_PUBLIC_FLAG_EXAM_CONDITIONS === "on",
  /** Free calls are bookable; set to "off" to switch the button to a waitlist */
  callSlotsOpen: process.env.NEXT_PUBLIC_CALL_SLOTS_OPEN !== "false",
};

/** A/B test: the modal appears after this many answered questions (1 or 3). */
export const EMAIL_MODAL_AFTER = Number(process.env.NEXT_PUBLIC_EMAIL_MODAL_AFTER ?? 1) === 3 ? 3 : 1;

/** Times the email modal can be skipped before it becomes required. */
export const MAX_EMAIL_SKIPS = 2;

/** Tutor limits */
export const TUTOR_MAX_TURNS = 5;
