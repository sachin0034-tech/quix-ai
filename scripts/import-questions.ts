/**
 * Validates a JSON file of new questions against the blueprint and merges it into
 * src/lib/bank/extra.json (loaded by the bank alongside the built-in items).
 *
 * Usage: npm run bank:import -- path/to/questions.json [--dry-run]
 *
 * Item format (every field required unless noted):
 *   { "id": 2001, "track": "associate" | "developer", "domain": "<official domain>",
 *     "subSkill": "<official sub-skill>", "difficulty": "Easy" | "Medium" | "Hard",
 *     "question": "...", "options": [{"label":"A","text":"..."}, ... 4 items],
 *     "answer": "B" or "A,C", "explanation": "...", "guideVersion": "v1.0" }
 * Items must be written fresh against the exam-guide objectives; never reproduce real exam content.
 */
import fs from "node:fs";
import path from "node:path";
import { CODE_BANK as BANK } from "../src/lib/bank/code-bank";
import { TRACKS } from "../src/lib/blueprint";
import type { BankQuestion } from "../src/types/quiz";

const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error("Usage: npm run bank:import -- questions.json [--dry-run]");
  process.exit(1);
}
const incoming = JSON.parse(fs.readFileSync(file, "utf8")) as BankQuestion[];
const errors: string[] = [];
const seen = new Set(BANK.map((q) => q.id));

for (const q of incoming) {
  const where = `item ${q.id}`;
  if (seen.has(q.id)) errors.push(`${where}: id already exists`);
  seen.add(q.id);
  const track = TRACKS[q.track];
  if (!track) { errors.push(`${where}: unknown track "${q.track}"`); continue; }
  const domain = track.domains.find((d) => d.name === q.domain);
  if (!domain) errors.push(`${where}: unknown domain "${q.domain}" for ${q.track}`);
  else if (!domain.subSkills.some((s) => s.name === q.subSkill)) errors.push(`${where}: unknown sub-skill "${q.subSkill}" in ${q.domain}`);
  if (!["Easy", "Medium", "Hard"].includes(q.difficulty)) errors.push(`${where}: bad difficulty`);
  if (!q.question?.trim()) errors.push(`${where}: empty question`);
  if (q.options?.length !== 4 || q.options.some((o, i) => o.label !== "ABCD"[i] || !o.text?.trim())) errors.push(`${where}: need 4 options labelled A-D`);
  if (!/^[ABCD](,[ABCD])*$/.test(q.answer ?? "")) errors.push(`${where}: answer must look like "B" or "A,C"`);
  if (!q.explanation?.trim()) errors.push(`${where}: explanation required (shown after every answer)`);
  if (/\b(option|answer)\s+[ABCD]\b/i.test(q.explanation ?? "")) errors.push(`${where}: explanation refers to option letters, but options are shuffled`);
  if (!q.guideVersion) errors.push(`${where}: guideVersion required`);
}

if (errors.length) {
  console.error(`${errors.length} problem(s):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

const target = path.resolve(__dirname, "../src/lib/bank/extra.json");
const existing = JSON.parse(fs.readFileSync(target, "utf8")) as BankQuestion[];
if (flags.includes("--dry-run")) {
  console.log(`OK: ${incoming.length} item(s) valid. Dry run, nothing written.`);
} else {
  fs.writeFileSync(target, JSON.stringify([...existing, ...incoming], null, 2) + "\n");
  console.log(`Added ${incoming.length} item(s) to ${path.relative(process.cwd(), target)} (${existing.length + incoming.length} imported in total).`);
}
