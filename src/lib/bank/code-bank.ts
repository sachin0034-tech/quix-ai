import type { BankQuestion, TrackId } from "@/types/quiz";
import { ASSOCIATE_BANK } from "./associate";
import { DEVELOPER_BANK } from "./developer";
import extra from "./extra.json";

/**
 * The built-in question set. It is the source for the seed SQL (scripts/generate-seed-sql.ts) and
 * the fallback when the database is not configured or holds no recognised questions.
 */
export const CODE_BANK: BankQuestion[] = [...DEVELOPER_BANK, ...ASSOCIATE_BANK, ...(extra as BankQuestion[])];

export const codeTrackBank = (track: TrackId) => CODE_BANK.filter((q) => q.track === track);
export const codeQuestion = (id: number) => CODE_BANK.find((q) => q.id === id);
