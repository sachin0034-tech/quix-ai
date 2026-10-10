import { TUTOR_MAX_TURNS } from "@/lib/config";

export const FAQ_URL = "https://anthropic-partners.skilljar.com/page/faq-certifications";
const AS_OF = "October 2026";

const REPLIES = {
  empty: "I didn't catch that. Ask me about this question or its topic.",
  examDump:
    "I can't help with that. Real exam items are confidential under Anthropic's NDA, and I don't know what appears on the live exam. I can run you through a domain drill on the same skill instead.",
  keyRequest:
    "I can only explain the current question you've already answered. I won't share answer keys for other items or for a mock.",
  pii: "Please don't share personal data such as employee IDs, emails or phone numbers here. I won't repeat it. Ask me about the question or its topic instead.",
  cap: "You've used the 5 follow-ups for this question. Try a domain drill on this skill to keep practising.",
  offTopic: "I can only help with Claude certification topics. Ask me about this question or its skill.",
  logistics: `Exam fees are $99 for the Associate and $125 for the Developer exam. After a failed attempt you wait 14 days, then 30, then 90, with at most 4 attempts in 12 months, and a retake costs the full fee. Passing is 720 on a scale of 100 to 1,000. Details can change, so check the official FAQ: ${FAQ_URL} (as of ${AS_OF}).`,
};

const RX = {
  examDump:
    /(real|actual|live|leaked?)\s+(exam|test)\b|exam\s*dump|brain\s*dump|what\s+(did|do|will)\s+(people|candidates|others)\s+(see|get)|recalled?\s+questions|questions?\s+(from|on)\s+the\s+(real|actual)/i,
  keyRequest: /(answer\s*key|all\s+(the\s+)?answers|show\s+(me\s+)?the\s+answers?)\b.*\b(mock|exam|test|quiz|all)\b|ignore\s+(your|all|previous|prior)\s+(instructions|rules)/i,
  logistics: /\b(exam\s+fee|how\s+much\s+(is|does)\s+the\s+exam|retake|re-take|waiting\s+period|how\s+many\s+attempts|cost\s+of\s+the\s+exam|exam\s+price)\b/i,
  pii: /[\w.+-]+@[\w-]+\.[\w.]+|\b(employee|staff|badge)\s*(id|number|no\.?)\b|\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b|\+?\d[\d\s().-]{8,}\d/i,
};


export function looksLikeGibberish(s: string): boolean {
  const letters = (s.match(/\p{L}/gu) ?? []).length;
  if (s.length < 2 || letters / s.length < 0.4) return true;
  // A single long token with a long run of consonants ("asdkjhqwrtp") is not language
  return !/\s/.test(s) && s.length > 6 && /[^aeiouáéíóúàèìòùäöüаеиоуяюэ\W\d_]{6,}/i.test(s);
}


export interface Guard {
  kind: "canned" | "cap";
  text: string;
}

/** Deterministic pre-model checks. Returns a canned reply, or null when the model may answer. */
export function guardReply(message: string, userTurns: number): Guard | null {
  if (userTurns > TUTOR_MAX_TURNS) return { kind: "cap", text: REPLIES.cap };
  const msg = message.trim();
  if (!msg || looksLikeGibberish(msg)) return { kind: "canned", text: REPLIES.empty };
  if (RX.examDump.test(msg)) return { kind: "canned", text: REPLIES.examDump };
  if (RX.keyRequest.test(msg)) return { kind: "canned", text: REPLIES.keyRequest };
  if (RX.pii.test(msg)) return { kind: "canned", text: REPLIES.pii };
  if (RX.logistics.test(msg)) return { kind: "canned", text: REPLIES.logistics };
  return null;
}
