/**
 * Coverage report: practice questions per domain and sub-skill against the official weights, and
 * whether the bank can support 3 non-overlapping full mocks (the PRD launch gate: 200+ per track).
 * Usage: npm run bank:coverage
 */
import { CODE_BANK as BANK } from "../src/lib/bank/code-bank";
import { TRACKS } from "../src/lib/blueprint";

const LAUNCH_TARGET = 200;

for (const t of Object.values(TRACKS)) {
  const items = BANK.filter((q) => q.track === t.id);
  console.log(`\n${t.name} (${t.code}): ${items.length} items, full mock needs ${t.items}, launch target ${LAUNCH_TARGET}`);
  for (const d of t.domains) {
    const inDomain = items.filter((q) => q.domain === d.name);
    const wantAtLaunch = Math.ceil((LAUNCH_TARGET * d.weight) / 100);
    const flag = inDomain.length >= wantAtLaunch ? "ok " : "LOW";
    console.log(`  ${flag} ${d.name} (${d.weight}%): ${inDomain.length} / ${wantAtLaunch}`);
    for (const s of d.subSkills) {
      const n = inDomain.filter((q) => q.subSkill === s.name).length;
      console.log(`        ${n === 0 ? "none" : String(n).padStart(4)}  ${s.name} (${s.weight}%)`);
    }
  }
  const noExp = items.filter((q) => !q.explanation).length;
  const multi = items.filter((q) => q.answer.includes(",")).length;
  console.log(`  without explanation: ${noExp}; multiple-response: ${multi} (${Math.round((multi / Math.max(1, items.length)) * 100)}%)`);
}
