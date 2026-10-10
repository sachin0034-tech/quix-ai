import { describe, expect, it } from "vitest";
import { buildFromRows, displayKeys, presentOptions, rowsToBank } from "@/lib/bank";
import { CODE_BANK as BANK, codeQuestion as getQuestion, codeTrackBank as trackBank } from "@/lib/bank/code-bank";
import { TRACKS } from "@/lib/blueprint";
import { allocate, buildDiagnostic, buildFullMock, chooseNext, shuffle } from "@/lib/sampling";
import { computeResult, estimateReadiness, isReady } from "@/lib/scoring";
import { isCorrectAnswer, parseAnswer } from "@/lib/answers";
import { mulberry32 } from "@/lib/bank";
import type { OptionLabel } from "@/types/quiz";

const rng = () => mulberry32(42);

describe("blueprint", () => {
  it("domain weights sum to 100", () => {
    for (const t of Object.values(TRACKS)) {
      expect(t.domains.reduce((n, d) => n + d.weight, 0)).toBeCloseTo(100, 0);
    }
  });
  it("developer sub-skill weights equal their domain weights", () => {
    for (const d of TRACKS.developer.domains) {
      expect(d.subSkills.reduce((n, s) => n + (s.weight as number), 0)).toBeCloseTo(d.weight, 1);
    }
  });
  it("associate sub-skills carry no weight: the guide publishes none", () => {
    for (const d of TRACKS.associate.domains) expect(d.subSkills.every((s) => s.weight === null)).toBe(true);
  });
});

describe("bank", () => {
  it("every item uses a real domain and sub-skill with 4 options and a valid key", () => {
    const ids = new Set<number>();
    for (const q of BANK) {
      expect(ids.has(q.id), `dup id ${q.id}`).toBe(false);
      ids.add(q.id);
      const d = TRACKS[q.track].domains.find((x) => x.name === q.domain);
      expect(d, `domain ${q.domain}`).toBeTruthy();
      expect(d!.subSkills.some((s) => s.name === q.subSkill), `${q.id} ${q.subSkill}`).toBe(true);
      expect(q.options).toHaveLength(4);
      expect(parseAnswer(q.answer).length).toBeGreaterThan(0);
      expect(q.explanation, `explanation ${q.id}`).toBeTruthy();
    }
  });
  it("shuffled options keep the correct text as the key", () => {
    for (const q of BANK) {
      const opts = presentOptions(q, "seed-1");
      const keys = displayKeys(q, "seed-1");
      const keyTexts = keys.map((k) => opts.find((o) => o.label === k)!.text).sort();
      const origTexts = parseAnswer(q.answer).map((k) => q.options.find((o) => o.label === k)!.text).sort();
      expect(keyTexts).toEqual(origTexts);
    }
  });
});

describe("allocation", () => {
  it("allocates exactly n at the weights", () => {
    const a = allocate([{ key: "a", weight: 70, cap: 99 }, { key: "b", weight: 30, cap: 99 }], 10);
    expect(a.get("a")).toBe(7);
    expect(a.get("b")).toBe(3);
  });
  it("honours caps and minimums", () => {
    const a = allocate([{ key: "a", weight: 99, cap: 2 }, { key: "b", weight: 1, cap: 9, min: 1 }], 6);
    expect(a.get("a")).toBe(2);
    expect(a.get("b")).toBe(4);
  });
});

describe("sampling", () => {
  it("developer full mock has 53 unique items from the real bank", () => {
    const mock = buildFullMock("developer", TRACKS.developer.domains, trackBank("developer"), rng());
    expect(mock).toHaveLength(53);
    expect(new Set(mock.map((q) => q.id)).size).toBe(53);
  });
  it("a full mock is drawn at the official domain weights when the bank is deep enough", () => {
    const base = trackBank("developer")[0];
    let id = 1;
    const deep = TRACKS.developer.domains.flatMap((d) =>
      d.subSkills.flatMap((s) =>
        Array.from({ length: 12 }, () => ({ ...base, id: id++, domain: d.name, subSkill: s.name }))
      )
    );
    const mock = buildFullMock("developer", TRACKS.developer.domains, deep, rng());
    expect(mock).toHaveLength(53);
    for (const d of TRACKS.developer.domains) {
      const got = mock.filter((q) => q.domain === d.name).length;
      expect(Math.abs(got - (53 * d.weight) / 100)).toBeLessThanOrEqual(1.6);
    }
  });
  it("associate mocks are drawn at the published domain weights, with no invented sub-skill weights", () => {
    const base = trackBank("associate")[0];
    let id = 1;
    const deep = TRACKS.associate.domains.flatMap((d) => Array.from({ length: 40 }, () => ({ ...base, id: id++, domain: d.name, subSkill: d.subSkills[id % d.subSkills.length].name })));
    const mock = buildFullMock("associate", TRACKS.associate.domains, deep, rng());
    expect(mock).toHaveLength(60);
    for (const d of TRACKS.associate.domains) {
      expect(Math.abs(mock.filter((q) => q.domain === d.name).length - (60 * d.weight) / 100)).toBeLessThanOrEqual(1);
    }
  });
  it("associate full mock has the full 60 items, unique", () => {
    const mock = buildFullMock("associate", TRACKS.associate.domains, trackBank("associate"), rng());
    expect(mock).toHaveLength(60);
    expect(new Set(mock.map((q) => q.id)).size).toBe(60);
  });
  it("diagnostic has 20 items covering every domain", () => {
    for (const t of ["associate", "developer"] as const) {
      const d = buildDiagnostic(TRACKS[t].domains, trackBank(t), rng());
      expect(d).toHaveLength(20);
      for (const dom of TRACKS[t].domains) expect(d.some((q) => q.domain === dom.name)).toBe(true);
    }
  });
});

describe("adaptive", () => {
  const pool = trackBank("developer");
  const caching = pool.filter((q) => q.subSkill === "Cost and Token Management");
  const llmf = pool.filter((q) => q.subSkill === "LLM Fundamentals");
  it("targets the weakest sub-skill (example 13)", () => {
    const answered = [
      ...caching.slice(0, 3).map((q) => ({ id: q.id, correct: false })),
      ...llmf.slice(0, 3).map((q) => ({ id: q.id, correct: true })),
    ];
    const next = chooseNext(
      { domains: TRACKS.developer.domains, pool, domain: "Model Selection and Optimization", askedIds: answered.map((a) => a.id), answered, history: {}, seen: {}, now: Date.now() },
      rng()
    )!;
    expect(next.subSkill).toBe("Cost and Token Management");
  });
  it("never repeats an item within 7 days, falling back to the next-weakest sub-skill (example 14)", () => {
    const now = Date.now();
    const seen: Record<number, number> = {};
    for (const q of caching) seen[q.id] = now - 1000; // every caching item seen just now
    const next = chooseNext(
      { domains: TRACKS.developer.domains, pool, domain: "Model Selection and Optimization", askedIds: [], answered: [], history: { "Model Selection and Optimization|Cost and Token Management": { correct: 0, total: 5 } }, seen, now },
      rng()
    )!;
    expect(next.subSkill).not.toBe("Cost and Token Management");
    expect(seen[next.id]).toBeUndefined();
  });
  it("returns null when the pool is exhausted", () => {
    expect(chooseNext({ domains: TRACKS.developer.domains, pool, askedIds: pool.map((q) => q.id), answered: [], history: {}, seen: {}, now: 0 }, rng())).toBeNull();
  });
});

describe("scoring", () => {
  it("all-or-nothing for multi-response", () => {
    expect(isCorrectAnswer(["A"], "A,C")).toBe(false);
    expect(isCorrectAnswer(["C", "A"], "A,C")).toBe(true);
    expect(isCorrectAnswer(["A", "B", "C"], "A,C")).toBe(false);
  });
  it("readiness is monotonic, 100..1000, and hits 720 near 69%", () => {
    const at = (p: number) => estimateReadiness([{ weight: 1, pct: p }])!;
    expect(at(0)).toBe(100);
    expect(at(1)).toBe(1000);
    for (let p = 0; p < 1; p += 0.05) expect(at(p + 0.05)).toBeGreaterThanOrEqual(at(p));
    expect(at(0.689)).toBeGreaterThanOrEqual(719);
    expect(at(0.69)).toBeGreaterThanOrEqual(720);
    expect(at(0.68)).toBeLessThan(720);
  });
  it("weights domains and ignores domains not asked", () => {
    const r = estimateReadiness([{ weight: 80, pct: 1 }, { weight: 20, pct: 0 }, { weight: 50, pct: null }])!;
    expect(r).toBe(Math.round(100 + 900 * 0.8));
  });
  it("ready needs 800+ on two full mocks in a row", () => {
    expect(isReady([850])).toBe(false);
    expect(isReady([700, 810, 790])).toBe(false);
    expect(isReady([700, 810, 800])).toBe(true);
  });
  it("computeResult marks unanswered as wrong, ranks lift and flags pace", () => {
    const pool = trackBank("developer").slice(0, 12);
    const keysFor = (q: (typeof pool)[number]) => displayKeys(q, "s");
    const answers = pool.slice(0, 6).map((q) => ({ id: q.id, picks: keysFor(q) as OptionLabel[], ms: 200_000 }));
    const res = computeResult({
      track: "developer", domains: TRACKS.developer.domains, mode: "full", asked: pool, answers, keysFor,
      optionsFor: (q) => presentOptions(q, "s"), explain: (q) => q.explanation ?? "", totalSeconds: 1000,
    });
    expect(res.correct).toBe(6);
    expect(res.unansweredCount).toBe(6);
    expect(res.missed).toHaveLength(6);
    expect(res.readiness).not.toBeNull();
    expect(res.patterns.some((p) => p.includes("left unanswered"))).toBe(true);
    expect(res.patterns.some((p) => p.includes("seconds per question"))).toBe(true);
    for (let i = 1; i < res.lifts.length; i++) expect(res.lifts[i - 1].lift).toBeGreaterThanOrEqual(res.lifts[i].lift);
  });
  it("getQuestion and shuffle helpers behave", () => {
    expect(getQuestion(101)?.track).toBe("developer");
    expect(shuffle([1, 2, 3, 4], rng())).toHaveLength(4);
  });
});

describe("database rows", () => {
  const mods = [{ id: 7, title: "Output Evaluation and Validation" }, { id: 8, title: "AI Product Thinking" }];
  const row = (over = {}) => ({ id: 1, module_id: 7, section: "Fact-checking and validation", difficulty: "Easy", question: "Q?", option_a: "a", option_b: "b", option_c: "c", option_d: "d", answer: "B", ...over });
  it("maps the module title to track and domain, and section to sub-skill", () => {
    const [q] = rowsToBank(mods, [row({ explanation: " why " })]);
    expect(q).toMatchObject({ track: "associate", domain: "Output Evaluation and Validation", subSkill: "Fact-checking and validation", explanation: "why" });
  });
  it("skips unrecognised modules, blank options and keyless rows", () => {
    expect(rowsToBank(mods, [row({ module_id: 8 }), row({ option_c: "" }), row({ answer: "" })])).toHaveLength(0);
  });
  it("accepts multi-answer keys", () => {
    expect(rowsToBank(mods, [row({ answer: "A,C" })])[0].answer).toBe("A,C");
  });
});

describe("blueprint from the database", () => {
  const q = (id: number, module_id: number, section: string) => ({ id, module_id, section, difficulty: "Easy", question: "Q?", option_a: "a", option_b: "b", option_c: "c", option_d: "d", answer: "A" });
  it("uses track, weight, objective, course module and sub-skills stored in the database", () => {
    const { domains, bank } = buildFromRows(
      [{ id: 1, title: "My new domain", track: "developer", weight: "12.5", objective: "Do the thing", course_module: 9, doc_links: [{ title: "Docs", url: "https://x.test" }], order_index: 1 }],
      [{ module_id: 1, name: "Alpha", weight: "7.5", order_index: 1 }, { module_id: 1, name: "Beta", weight: 5, order_index: 2 }],
      [q(1, 1, "Alpha")]
    );
    expect(domains.developer).toHaveLength(1);
    expect(domains.developer[0]).toMatchObject({ name: "My new domain", weight: 12.5, courseModule: 9, objective: "Do the thing" });
    expect(domains.developer[0].subSkills.map((s) => [s.name, s.weight])).toEqual([["Alpha", 7.5], ["Beta", 5]]);
    expect(bank[0]).toMatchObject({ track: "developer", domain: "My new domain", subSkill: "Alpha" });
  });
  it("falls back to the default for a known domain whose new columns are not filled in yet", () => {
    const { domains } = buildFromRows([{ id: 1, title: "Claude Code" }], [], []);
    expect(domains.developer[0]).toMatchObject({ name: "Claude Code", weight: 3.1 });
    expect(domains.developer[0].subSkills.length).toBeGreaterThan(0);
  });
  it("a section nobody defined as a sub-skill still joins its domain so it can be drawn", () => {
    const { domains } = buildFromRows([{ id: 1, title: "X", track: "associate", weight: 10 }], [{ module_id: 1, name: "A", weight: 10 }], [q(1, 1, "Brand new")]);
    expect(domains.associate[0].subSkills.map((s) => s.name)).toEqual(["A", "Brand new"]);
  });
  it("ignores domains with no track or weight", () => {
    const { domains, bank } = buildFromRows([{ id: 1, title: "AI Product Thinking" }], [], [q(1, 1, "x")]);
    expect(domains.associate).toHaveLength(0);
    expect(bank).toHaveLength(0);
  });
});
