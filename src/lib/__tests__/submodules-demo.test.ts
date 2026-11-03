import { describe, expect, it } from "vitest";
import { buildFromRows, buildModuleQuizzes, displayKeys, mulberry32, presentOptions, trackModules } from "@/lib/bank";
import { CODE_BANK } from "@/lib/bank/code-bank";
import { DEMO_SIZE, MODES, MODE_IDS, MODULE_SIZE, TRACKS } from "@/lib/blueprint";
import { buildDemo, buildModulePractice } from "@/lib/sampling";
import { computeResult } from "@/lib/scoring";
import { moveId, pickDefaultSection, sameIdSet, validateDemoOrder, validatePosition, validateQuestionFields, validateSubmodule } from "@/lib/admin-validate";
import { NEW_QUESTIONS, bankMemberships } from "../../../scripts/module-quiz-data";
import { ACCELERATOR_MOVES, COURSE_ORDER, DEMO_PICKS, DESCRIPTIONS, EXTRA_SUBMODULES, LESSONS, LESSON_MAP, SECTION_OVERRIDES, SUBMODULES, courseUrl } from "../../../scripts/submodule-seed-data";

// Two domains in the shape the database returns them. Titles match the built-in blueprint so no defaults are invented.
const MODULES = [
  { id: 1, title: "Prompting and Task Execution", track: "associate", weight: 14, order_index: 1 },
  { id: 2, title: "Tools and MCPs", track: "developer", weight: 10.6, order_index: 2 },
];
const SUBS = [{ module_id: 1, name: "Create effective prompts for business and technical tasks", weight: null, order_index: 1 }];
const Q = (id: number, module_id: number, extra: Record<string, unknown> = {}) => ({
  id, module_id, section: "Create effective prompts for business and technical tasks", difficulty: "Easy", question: `Question ${id}`,
  option_a: "a", option_b: "b", option_c: "c", option_d: "d", answer: "A", ...extra,
});
const SUBMODULES_ROWS = [
  { id: 20, module_id: 2, title: "Claude Code, MCP & Integration", order_index: 2 },
  { id: 10, module_id: 2, title: "Production-Grade Prompting, Agents & Tool Use", description: "Prompts and tools", order_index: 1 },
];
const TOPIC_ROWS = [
  { id: 2, submodule_id: 10, course_title: "Production-Grade Prompting, Agents & Tool Use", lesson_title: "Tool schemas", url: "https://example.com/b", order_index: 2 },
  { id: 1, submodule_id: 10, course_title: "Production-Grade Prompting, Agents & Tool Use", url: "https://example.com/a", order_index: 1 },
  { id: 3, submodule_id: 10, course_title: "No link yet", url: "", order_index: 3 },
  { id: 4, submodule_id: 10, course_title: "Not a web link", url: "javascript:alert(1)", order_index: 4 },
];

describe("submodules and Skill Jar links in the bank loader", () => {
  const built = buildFromRows(
    MODULES as never,
    SUBS as never,
    [Q(1, 2, { submodule_id: 10 }), Q(2, 2, { submodule_id: 20 }), Q(3, 2), Q(4, 1), Q(5, 2, { submodule_id: 10, topic_id: 2 }), Q(6, 2, { submodule_id: 20, topic_id: 2 })] as never,
    SUBMODULES_ROWS as never,
    TOPIC_ROWS as never
  );
  const tools = built.domains.developer.find((d) => d.name === "Tools and MCPs")!;

  it("lists a domain's submodules in their stored order, with the course-level link of each", () => {
    expect(tools.submodules?.map((s) => s.name)).toEqual(["Production-Grade Prompting, Agents & Tool Use", "Claude Code, MCP & Integration"]);
    expect(tools.submodules?.[0].topics).toEqual([{ title: "Production-Grade Prompting, Agents & Tool Use", url: "https://example.com/a", course: "Production-Grade Prompting, Agents & Tool Use" }]);
  });
  it("drops topics with no URL or a non-web URL, so nothing unsafe can reach a learner's link", () => {
    const urls = tools.submodules?.flatMap((s) => s.topics.map((t) => t.url));
    expect(urls).toEqual(["https://example.com/a"]);
    const all = built.bank.flatMap((q) => q.resources ?? []).map((r) => r.url);
    expect(all.every((u) => u.startsWith("https://"))).toBe(true);
  });
  it("gives a question the course link of its submodule, and none when it has no submodule or its submodule has no links", () => {
    const byId = new Map(built.bank.map((q) => [q.id, q]));
    expect(byId.get(1)?.submoduleId).toBe(10);
    expect(byId.get(1)?.resources).toEqual([{ title: "Production-Grade Prompting, Agents & Tool Use", url: "https://example.com/a", course: "Production-Grade Prompting, Agents & Tool Use" }]);
    expect(byId.get(2)?.resources).toEqual([]);
    expect(byId.get(3)?.resources).toEqual([]);
    expect(byId.get(3)?.submoduleId).toBeNull();
  });
  it("shows a question that points at a lesson that lesson, named first with its course in brackets", () => {
    const q5 = built.bank.find((q) => q.id === 5)!;
    expect(q5.topicId).toBe(2);
    expect(q5.lessonName).toBe("Tool schemas");
    expect(built.bank.find((q) => q.id === 1)?.lessonName).toBeNull();
    expect(q5.resources).toEqual([{ title: "Tool schemas (Production-Grade Prompting, Agents & Tool Use)", url: "https://example.com/b", course: "Production-Grade Prompting, Agents & Tool Use", lesson: "Tool schemas" }]);
  });
  it("ignores a lesson that belongs to a different submodule, and falls back to the course link", () => {
    const q6 = built.bank.find((q) => q.id === 6)!;
    expect(q6.resources).toEqual([]); // its own submodule (20) has no course-level link either
  });
  it("leaves domains without submodules empty", () => {
    expect(built.domains.associate[0].submodules).toEqual([]);
  });
  it("does not change sub-skills or scoring inputs: the same rows without submodules give the same domains and questions", () => {
    const plain = buildFromRows(MODULES as never, SUBS as never, [Q(1, 2), Q(2, 2), Q(3, 2), Q(4, 1), Q(5, 2), Q(6, 2)] as never);
    const strip = (b: typeof built) => ({
      domains: JSON.parse(JSON.stringify(b.domains, (k, v) => (k === "submodules" ? undefined : v))),
      bank: b.bank.map(({ id, domain, subSkill, difficulty, answer }) => ({ id, domain, subSkill, difficulty, answer })),
    });
    expect(strip(built)).toEqual(strip(plain));
  });
  it("only accepts demo positions 1 to 5", () => {
    const b = buildFromRows(MODULES as never, SUBS as never, [Q(1, 1, { demo_order: 0 }), Q(2, 1, { demo_order: 3 }), Q(3, 1, { demo_order: 6 }), Q(4, 1, { demo_order: null })] as never);
    expect(b.bank.map((q) => q.demoOrder)).toEqual([null, 3, null, null]);
  });
});

describe("demo quiz", () => {
  const mk = (id: number, domain: string, demoOrder: number | null) => ({ ...CODE_BANK[0], id, domain, demoOrder });

  it("is the domain's marked questions in their fixed order, never more than the demo size", () => {
    const pool = [mk(1, "A", 3), mk(2, "A", 1), mk(3, "A", null), mk(4, "B", 1), mk(5, "A", 2), mk(6, "A", 5), mk(7, "A", 4), mk(8, "A", 4)];
    const demo = buildDemo(pool, "A");
    expect(demo.map((q) => q.id)).toEqual([2, 5, 1, 7, 8].slice(0, DEMO_SIZE));
    expect(demo).toHaveLength(DEMO_SIZE);
  });
  it("is empty when nothing is marked, so the site hides the button", () => {
    expect(buildDemo([mk(1, "A", null)], "A")).toEqual([]);
  });
  it("is its own mode: untimed, not adaptive, 5 questions, and not one of the five practice cards", () => {
    expect(MODES.demo.questions("associate")).toBe(DEMO_SIZE);
    expect(MODES.demo.minutes).toBeNull();
    expect(MODES.demo.adaptive).toBe(false);
    expect(MODE_IDS).not.toContain("demo");
    expect(MODE_IDS).toHaveLength(5);
  });
  it("gives no readiness estimate, and carries Skill Jar links on missed questions", () => {
    const withLink = CODE_BANK.filter((q) => q.track === "associate").slice(0, 3).map((q) => ({ ...q, resources: [{ title: "Course", url: "https://example.com/c" }] }));
    const res = computeResult({
      track: "associate", domains: TRACKS.associate.domains, mode: "demo", asked: withLink, answers: [],
      keysFor: (q) => displayKeys(q, "s"), optionsFor: (q) => presentOptions(q, "s"), explain: (q) => q.explanation ?? "",
      resourcesFor: (q) => q.resources ?? [], totalSeconds: 60,
    });
    expect(res.readiness).toBeNull();
    expect(res.mode).toBe("demo");
    expect(res.missed.every((m) => m.resources?.[0]?.url === "https://example.com/c")).toBe(true);
  });
});

describe("seed data for submodules and demos", () => {
  it("has a 5-question demo for every domain, drawn from the right domain of the built-in bank", () => {
    const names = (t: "associate" | "developer") => TRACKS[t].domains.map((d) => d.name).sort();
    for (const t of ["associate", "developer"] as const) {
      expect(DEMO_PICKS.filter((p) => p.track === t).map((p) => p.domain).sort()).toEqual(names(t));
    }
    const seen = new Set<number>();
    for (const p of DEMO_PICKS) {
      expect(p.ids, p.domain).toHaveLength(DEMO_SIZE);
      for (const id of p.ids) {
        const b = CODE_BANK.find((x) => x.id === id);
        expect(b, `question ${id}`).toBeTruthy();
        expect([b?.track, b?.domain], `question ${id}`).toEqual([p.track, p.domain]);
        expect(b?.explanation, `explanation ${id}`).toBeTruthy();
        expect(seen.has(id), `duplicate ${id}`).toBe(false);
        seen.add(id);
      }
    }
    expect(seen.size).toBe(75);
  });
  it("gives every domain at least one submodule, each a real Skill Jar course link, with unique names per domain", () => {
    for (const t of ["associate", "developer"] as const) {
      for (const d of TRACKS[t].domains) {
        const subs = SUBMODULES.filter((s) => s.track === t && s.domain === d.name);
        expect(subs.length, `${t}/${d.name}`).toBeGreaterThanOrEqual(1);
        expect(new Set(subs.map((s) => s.title)).size).toBe(subs.length);
      }
    }
    for (const s of SUBMODULES) {
      expect(TRACKS[s.track].domains.some((d) => d.name === s.domain), s.domain).toBe(true);
      expect(courseUrl(s)).toMatch(/^https:\/\/anthropic-partners\.skilljar\.com\/path\/claude-certified-(associate|developer)-foundations\/[a-z0-9-]+$/);
    }
    expect(SUBMODULES).toHaveLength(17);
  });
  it("only reassigns real sub-skills to real submodules of that domain", () => {
    for (const o of SECTION_OVERRIDES) {
      const dom = TRACKS[o.track].domains.find((d) => d.name === o.domain)!;
      for (const sec of o.sections) expect(dom.subSkills.some((s) => s.name === sec), sec).toBe(true);
      expect(SUBMODULES.some((s) => s.track === o.track && s.domain === o.domain && s.title === o.submodule), o.submodule).toBe(true);
    }
  });
});

describe("admin validation for submodules, demo positions and reordering", () => {
  const topic = { courseTitle: "Course", lessonTitle: "", url: "https://example.com/x" };

  it("needs a name, and every topic needs a course and a full http(s) link", () => {
    expect(validateSubmodule({ title: " ", topics: [] })).toMatch(/name is required/);
    expect(validateSubmodule({ title: "A", topics: [] })).toBeNull();
    expect(validateSubmodule({ title: "A", topics: [topic] })).toBeNull();
    expect(validateSubmodule({ title: "A", topics: [{ ...topic, courseTitle: "" }] })).toMatch(/topic 1 needs a course/);
    expect(validateSubmodule({ title: "A", topics: [topic, { ...topic, url: "skilljar.com/x" }] })).toMatch(/topic 2 needs a full/);
    expect(validateSubmodule({ title: "A", topics: [{ ...topic, url: "javascript:alert(1)" }] })).toMatch(/full http/);
  });
  it("applies the same question rules in the question editor and the module quiz page", () => {
    const ok = { section: "S", difficulty: "Medium", question: "Q?", options: ["a", "b", "c", "d"], answer: "B", explanation: "Because the option is the safer choice." };
    expect(validateQuestionFields(ok)).toBeNull();
    expect(validateQuestionFields({ ...ok, answer: "A,C" })).toBeNull();
    expect(validateQuestionFields({ ...ok, section: " " })).toMatch(/Sub-skill/);
    expect(validateQuestionFields({ ...ok, question: "" })).toMatch(/Question text/);
    expect(validateQuestionFields({ ...ok, options: ["a", "b", "c", ""] })).toMatch(/four options/);
    expect(validateQuestionFields({ ...ok, answer: "" })).toMatch(/correct answer/);
    expect(validateQuestionFields({ ...ok, answer: "E" })).toMatch(/correct answer/);
    expect(validateQuestionFields({ ...ok, difficulty: "Impossible" })).toMatch(/difficulty/);
    expect(validateQuestionFields({ ...ok, explanation: "Answer B is right because it is safer." })).toMatch(/option letters/);
  });
  it("gives a module-quiz-only question the domain's first sub-skill, else the domain name, when none is chosen", () => {
    expect(pickDefaultSection(["Prompt Engineering", "Context Engineering"], "Prompt and Context Engineering")).toBe("Prompt Engineering");
    expect(pickDefaultSection(["  ", "Second"], "Domain")).toBe("Second");
    expect(pickDefaultSection([], "  Domain Name ")).toBe("Domain Name");
  });
  it("accepts demo positions 1 to 5 or none", () => {
    expect(validateDemoOrder(null)).toBeNull();
    expect(validateDemoOrder(undefined)).toBeNull();
    for (const n of [1, 2, 3, 4, 5]) expect(validateDemoOrder(n)).toBeNull();
    for (const n of [0, 6, -1, 2.5, Number.NaN]) expect(validateDemoOrder(n), String(n)).not.toBeNull();
  });
  it("moves an id one place and refuses to move past either end", () => {
    expect(moveId([1, 2, 3], 2, "up")).toEqual([2, 1, 3]);
    expect(moveId([1, 2, 3], 2, "down")).toEqual([1, 3, 2]);
    expect(moveId([1, 2, 3], 1, "up")).toBeNull();
    expect(moveId([1, 2, 3], 3, "down")).toBeNull();
    expect(moveId([1, 2, 3], 9, "up")).toBeNull();
  });
  it("accepts a reorder request only when it lists exactly the existing ids once each", () => {
    expect(sameIdSet([1, 2, 3], [3, 1, 2])).toBe(true);
    expect(sameIdSet([1, 2, 3], [1, 2])).toBe(false);
    expect(sameIdSet([1, 2, 3], [1, 2, 2])).toBe(false);
    expect(sameIdSet([1, 2, 3], [1, 2, 4])).toBe(false);
  });
});

describe("practice by module", () => {
  const mk = (id: number, extra: Record<string, unknown> = {}) => ({ ...CODE_BANK[0], id, track: "developer", submoduleName: "Mod", ...extra }) as never as import("@/types/quiz").BankQuestion;
  const lesson = (name: string, questions: import("@/types/quiz").BankQuestion[]) => ({ name, link: { title: `${name} (Mod)`, url: "https://example.com/mod" }, questions });
  const quiz = (lessons: ReturnType<typeof lesson>[], extras: import("@/types/quiz").BankQuestion[] = []): import("@/types/quiz").ModuleQuiz => ({ name: "Mod", description: "", position: null, lessons, extras });
  const qs = (from: number, count: number) => Array.from({ length: count }, (_, i) => mk(from + i));

  it("takes the module name and list position from the database rows", () => {
    const built = buildFromRows(
      MODULES as never, SUBS as never, [Q(1, 2, { submodule_id: 10 }), Q(2, 2)] as never,
      [{ id: 10, module_id: 2, title: "  Claude Code, MCP & Integration ", order_index: 1, course_position: 3 }] as never, []
    );
    expect(built.domains.developer[0].submodules?.[0]).toMatchObject({ name: "Claude Code, MCP & Integration", position: 3 });
    expect(built.bank.map((q) => q.submoduleName)).toEqual(["Claude Code, MCP & Integration", null]);
  });

  describe("module quizzes built from lessons and their members", () => {
    // Two domains teach the same course, so each has its own submodule row and its own copy of each lesson
    const submodules = [
      { id: 10, module_id: 1, title: "Course A", order_index: 1, course_position: 2, description: "" },
      { id: 11, module_id: 2, title: "Course A", order_index: 1, course_position: 2, description: "About A" },
      { id: 12, module_id: 2, title: "Course B", order_index: 2, course_position: 1 },
      { id: 13, module_id: 1, title: "Empty", order_index: 3 },
    ];
    const topics = [
      { id: 100, submodule_id: 10, course_title: "Course A", lesson_title: "Lesson 1", url: "https://example.com/a", order_index: 2 },
      { id: 101, submodule_id: 10, course_title: "Course A", lesson_title: "Lesson 2", url: "https://example.com/a", order_index: 3 },
      { id: 110, submodule_id: 11, course_title: "Course A", lesson_title: "Lesson 1", url: "https://example.com/a", order_index: 2 },
      { id: 120, submodule_id: 12, course_title: "Course B", lesson_title: "Only", url: "https://example.com/b", order_index: 2 },
      { id: 121, submodule_id: 12, course_title: "Course B", lesson_title: "No link", url: "", order_index: 3 },
    ];
    const bank = [mk(1, { submoduleName: "Course A" }), mk(2, { submoduleName: "Course A" }), mk(3, { submoduleName: "Course A" }), mk(4, { submoduleName: "Course A" }), mk(5, { submoduleName: "Course B" }), mk(6, { track: "associate", submoduleName: "Course A" })];
    const members = [
      { id: 1, topic_id: 100, question_id: 1 }, { id: 2, topic_id: 110, question_id: 2 }, // the same lesson under two domains
      { id: 3, topic_id: 101, question_id: 3 }, { id: 4, topic_id: 101, question_id: 1 }, // 1 is already in Lesson 1: first membership wins
      { id: 5, topic_id: 100, question_id: 6 }, // a question of another track is ignored
      { id: 6, topic_id: 120, question_id: 5 },
    ];
    const mods = buildModuleQuizzes({ submodules: submodules as never, topics: topics as never, members: members as never, trackOf: (id) => (id === 1 || id === 2 ? "developer" : undefined), bank });
    const a = mods.developer.find((m) => m.name === "Course A")!;

    it("groups a lesson's members across domains by the lesson's name, in lesson order", () => {
      expect(a.lessons.map((l) => l.name)).toEqual(["Lesson 1", "Lesson 2"]);
      expect(a.lessons[0].questions.map((q) => q.id)).toEqual([1, 2]);
      expect(a.lessons[1].questions.map((q) => q.id)).toEqual([3]);
    });
    it("names each lesson's link after the lesson with the course in brackets, and takes position and description from its rows", () => {
      expect(a.lessons[0].link).toEqual({ title: "Lesson 1 (Course A)", url: "https://example.com/a", course: "Course A", lesson: "Lesson 1" });
      expect(a.position).toBe(2);
      expect(a.description).toBe("About A");
    });
    it("puts a question in at most one lesson of a course, and ignores members of another track", () => {
      const all = a.lessons.flatMap((l) => l.questions.map((q) => q.id));
      expect(new Set(all).size).toBe(all.length);
      expect(all).not.toContain(6);
    });
    it("leaves the course's unassigned questions as extras, and drops lessons without a usable link", () => {
      expect(a.extras.map((q) => q.id)).toEqual([4]);
      const b = mods.developer.find((m) => m.name === "Course B")!;
      expect(b.lessons.map((l) => l.name)).toEqual(["Only"]);
    });
    it("lists modules by position then name, with the size of their pool, and leaves out empty ones", () => {
      expect(trackModules(mods.developer)).toEqual([
        { name: "Course B", description: "", count: 1 },
        { name: "Course A", description: "About A", count: 4 },
      ]);
      expect(mods.developer.map((m) => m.name)).toContain("Empty");
      expect(trackModules(mods.developer).map((m) => m.name)).not.toContain("Empty");
    });
  });

  describe("a session spreads across lessons", () => {
    const lessons = (picked: import("@/types/quiz").BankQuestion[], mod: import("@/types/quiz").ModuleQuiz) =>
      picked.map((q) => mod.lessons.find((l) => l.questions.includes(q))?.name ?? "extra");

    it("takes one question from every lesson before a second from any, so 3 lessons in a 5-session give 2+2+1", () => {
      const mod = quiz([lesson("A", qs(1, 10)), lesson("B", qs(20, 2)), lesson("C", qs(30, 1))]);
      for (let seed = 1; seed <= 20; seed++) {
        const counts = lessons(buildModulePractice(mod, mulberry32(seed), 5), mod).reduce<Record<string, number>>((m, l) => ({ ...m, [l]: (m[l] ?? 0) + 1 }), {});
        expect(counts, `seed ${seed}`).toEqual({ A: 2, B: 2, C: 1 });
      }
    });
    it("with more lessons than room, shows 5 different lessons once each, and rotates which between sessions", () => {
      const mod = quiz(["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8"].map((l, i) => lesson(l, qs(i * 10 + 1, 3))));
      const seen = new Set<string>();
      for (let seed = 1; seed <= 40; seed++) {
        const got = lessons(buildModulePractice(mod, mulberry32(seed), 5), mod);
        expect(new Set(got).size, `seed ${seed}`).toBe(5);
        got.forEach((l) => seen.add(l));
      }
      expect(seen.size).toBe(8);
    });
    it("uses a course's lesson-less questions only after the lessons run out", () => {
      const poor = quiz([lesson("A", qs(1, 1)), lesson("B", qs(5, 1))], qs(50, 4));
      const got = lessons(buildModulePractice(poor, mulberry32(3), 5), poor);
      expect(got.filter((l) => l === "A")).toHaveLength(1);
      expect(got.filter((l) => l === "B")).toHaveLength(1);
      expect(got.filter((l) => l === "extra")).toHaveLength(3);
      const rich = quiz([lesson("A", qs(1, 4)), lesson("B", qs(5, 4))], qs(50, 1));
      expect(lessons(buildModulePractice(rich, mulberry32(3), 5), rich)).not.toContain("extra");
    });
    it("draws only from the lessons that have questions, and works for a course with no lessons at all", () => {
      const withEmpty = quiz([lesson("Empty", []), lesson("A", qs(1, 3))]);
      expect(buildModulePractice(withEmpty, mulberry32(1))).toHaveLength(3);
      const noLessons = quiz([], qs(1, 17));
      const got = buildModulePractice(noLessons, mulberry32(1));
      expect(got).toHaveLength(MODULE_SIZE);
      expect(new Set(got.map((q) => q.id)).size).toBe(MODULE_SIZE);
    });
    it("is repeatable for a seed, returns fewer when the module is small, and never repeats a question", () => {
      const mod = quiz([lesson("A", qs(1, 3)), lesson("B", qs(10, 3))]);
      const a = buildModulePractice(mod, mulberry32(9), 5);
      expect(buildModulePractice(mod, mulberry32(9), 5).map((q) => q.id)).toEqual(a.map((q) => q.id));
      expect(a).toHaveLength(5);
      expect(new Set(a.map((q) => q.id)).size).toBe(5);
      expect(buildModulePractice(quiz([lesson("A", qs(1, 2))]), mulberry32(9), 5)).toHaveLength(2);
    });
    it("a module quiz is 15 questions, spread over every lesson, with no repeats", () => {
      expect(MODULE_SIZE).toBe(15);
      const mod = quiz([lesson("A", qs(1, 8)), lesson("B", qs(20, 8)), lesson("C", qs(40, 8))]);
      for (let seed = 1; seed <= 20; seed++) {
        const got = buildModulePractice(mod, mulberry32(seed));
        expect(got, `seed ${seed}`).toHaveLength(15);
        expect(new Set(got.map((q) => q.id)).size).toBe(15);
        expect(new Set(lessons(got, mod)).size).toBe(3);
      }
    });
    it("gives a smaller module only what it holds, never padding the quiz", () => {
      const small = quiz([lesson("A", qs(1, 4)), lesson("B", qs(20, 3))]);
      expect(buildModulePractice(small, mulberry32(2))).toHaveLength(7);
    });
    it("gives a different random set of 15 each session, with no one choosing them", () => {
      const mod = quiz([lesson("A", qs(1, 8)), lesson("B", qs(20, 8)), lesson("C", qs(40, 8))]);
      const sets = new Set<string>();
      for (let seed = 1; seed <= 30; seed++) sets.add(buildModulePractice(mod, mulberry32(seed)).map((q) => q.id).sort((x, y) => x - y).join(","));
      expect(sets.size).toBeGreaterThan(20);
    });
    it("prefers questions the learner has not seen, so a returning learner gets new ones first", () => {
      const mod = quiz([lesson("A", qs(1, 4)), lesson("B", qs(20, 4)), lesson("C", qs(40, 4))]);
      const seen: Record<number, number> = {};
      const all = new Set<number>();
      for (let session = 1; session <= 2; session++) {
        const got = buildModulePractice(mod, mulberry32(session), 5, seen);
        got.forEach((q) => { expect(all.has(q.id), `session ${session}`).toBe(false); all.add(q.id); seen[q.id] = session; });
      }
      expect(all.size).toBe(10); // 12 questions in the pool, so two sessions never repeat one
    });
    it("repeats the longest-ago questions only once the pool is used up, and still covers every lesson", () => {
      const mod = quiz([lesson("A", qs(1, 2)), lesson("B", qs(20, 2))]);
      const seen = { 1: 100, 2: 200, 20: 300, 21: 50 }; // everything seen: oldest first
      const got = buildModulePractice(mod, mulberry32(4), 2, seen).map((q) => q.id).sort((x, y) => x - y);
      expect(got).toEqual([1, 21]); // the oldest question of each lesson
    });
    it("counts a question that sits in two lessons only once", () => {
      const shared = mk(1);
      const mod = quiz([lesson("A", [shared, mk(2)]), lesson("B", [shared])]);
      const got = buildModulePractice(mod, mulberry32(4));
      expect(new Set(got.map((q) => q.id)).size).toBe(got.length);
    });
  });

  it("is its own mode: untimed, not adaptive, and not one of the five overall cards", () => {
    expect(MODES.module.questions("developer")).toBe(MODULE_SIZE);
    expect(MODES.module.minutes).toBeNull();
    expect(MODES.module.adaptive).toBe(false);
    expect(MODE_IDS).not.toContain("module");
  });
  it("keeps the seeded module order complete: every submodule title has exactly one position in its track", () => {
    for (const t of ["associate", "developer"] as const) {
      const titles = [...new Set(SUBMODULES.filter((x) => x.track === t).map((x) => x.title))];
      expect([...COURSE_ORDER[t]].sort()).toEqual([...titles].sort());
      expect(new Set(COURSE_ORDER[t]).size).toBe(COURSE_ORDER[t].length);
    }
  });
  it("has a short description for every module name", () => {
    const titles = new Set(SUBMODULES.map((x) => x.title));
    expect(Object.keys(DESCRIPTIONS).sort()).toEqual([...titles].sort());
    for (const [t, d] of Object.entries(DESCRIPTIONS)) {
      expect(d.length, t).toBeGreaterThan(20);
      expect(d.length, t).toBeLessThanOrEqual(120);
    }
  });
  it("validates the module list position", () => {
    expect(validatePosition(null)).toBeNull();
    expect(validatePosition(undefined)).toBeNull();
    expect(validatePosition(1)).toBeNull();
    for (const n of [0, -2, 1.5, 1000, Number.NaN]) expect(validatePosition(n), String(n)).not.toBeNull();
  });
});

describe("lesson mapping seed data", () => {
  // The course a question starts in: its domain's first course, a listed sub-skill's override, or a lesson-based move
  const courseOf = (id: number): string => {
    const b = CODE_BANK.find((x) => x.id === id)!;
    if (ACCELERATOR_MOVES.some((m) => m.ids.includes(id))) return "Accelerators & IP Contribution";
    const override = SECTION_OVERRIDES.find((o) => o.track === b.track && o.domain === b.domain && o.sections.includes(b.subSkill));
    if (override) return override.submodule;
    return SUBMODULES.find((x) => x.track === b.track && x.domain === b.domain)!.title;
  };

  it("maps each question to at most one lesson, and only to a real lesson of the question's own course", () => {
    const seen = new Set<number>();
    for (const a of LESSON_MAP) {
      expect(LESSONS[a.course], a.course).toBeTruthy();
      expect(LESSONS[a.course], `${a.course} › ${a.lesson}`).toContain(a.lesson);
      for (const id of a.ids) {
        expect(CODE_BANK.some((b) => b.id === id), `question ${id} exists`).toBe(true);
        expect(seen.has(id), `question ${id} is in two lessons`).toBe(false);
        seen.add(id);
        expect(courseOf(id), `question ${id} is in ${courseOf(id)}, not ${a.course}`).toBe(a.course);
      }
    }
    expect(seen.size).toBe(149);
  });
  it("maps every Associate question and every Claude Code question, leaving only a few API questions on the course link", () => {
    const mapped = new Set(LESSON_MAP.flatMap((a) => a.ids));
    expect(CODE_BANK.filter((b) => b.track === "associate" && !mapped.has(b.id))).toEqual([]);
    const unmapped = CODE_BANK.filter((b) => b.track === "developer" && !mapped.has(b.id));
    expect(new Set(unmapped.map((b) => courseOf(b.id)))).toEqual(new Set(["Production-Grade Prompting, Agents & Tool Use"]));
    expect(unmapped.map((b) => b.id).sort((a, b) => a - b)).toEqual([201, 202, 205, 206, 207, 209, 212]);
  });
  it("gives every lesson of the Claude Code course at least two questions", () => {
    for (const lesson of LESSONS["Claude Code, MCP & Integration"]) {
      const ids = LESSON_MAP.filter((a) => a.course === "Claude Code, MCP & Integration" && a.lesson === lesson).flatMap((a) => a.ids);
      expect(ids.length, lesson).toBeGreaterThanOrEqual(2);
    }
  });
  it("gives Accelerators & IP Contribution exactly 5 questions, so its module session is a full 5", () => {
    const n = CODE_BANK.filter((b) => courseOf(b.id) === "Accelerators & IP Contribution").length;
    expect(n).toBe(5);
    for (const e of EXTRA_SUBMODULES) expect(SUBMODULES.some((x) => x.domain === e.domain && x.title === e.title)).toBe(false);
  });
  it("keeps every listed lesson distinct within its course", () => {
    for (const [course, lessons] of Object.entries(LESSONS)) expect(new Set(lessons).size, course).toBe(lessons.length);
    expect(Object.keys(LESSONS).filter((c) => !SUBMODULES.some((x) => x.title === c))).toEqual([]);
  });
});

describe("module quiz seed content", () => {
  const courseRowsIn = (domain: string, course: string) =>
    [...SUBMODULES, ...EXTRA_SUBMODULES].some((x) => x.domain === domain && x.title === course);

  it("gives every written question four distinct options, a valid key, and an explanation that does not mention option letters", () => {
    for (const n of NEW_QUESTIONS) {
      const label = n.question.slice(0, 50);
      expect(n.options.every((o) => o.trim().length > 0), label).toBe(true);
      expect(new Set(n.options).size, label).toBe(4);
      expect(["A", "B", "C", "D"], label).toContain(n.answer);
      expect(n.explanation.length, label).toBeGreaterThan(60);
      expect(/\b(option|answer)\s+[ABCD]\b/i.test(n.explanation), label).toBe(false);
    }
  });
  it("files each written question under an existing sub-skill of its domain, so no sub-skill or weight is created", () => {
    for (const n of NEW_QUESTIONS) {
      const dom = TRACKS[n.track].domains.find((d) => d.name === n.domain);
      expect(dom, n.domain).toBeTruthy();
      expect(dom!.subSkills.some((s) => s.name === n.section), `${n.domain} › ${n.section}`).toBe(true);
    }
  });
  it("puts each written question in a lesson of a course that has a submodule row under the question's domain", () => {
    for (const n of NEW_QUESTIONS) {
      expect(LESSONS[n.course], n.course).toContain(n.lesson);
      expect(courseRowsIn(n.domain, n.course), `${n.course} under ${n.domain}`).toBe(true);
    }
  });
  it("does not repeat a question that is already in the bank, or one written twice", () => {
    const texts = NEW_QUESTIONS.map((n) => n.question);
    expect(new Set(texts).size).toBe(texts.length);
    for (const t of texts) expect(CODE_BANK.some((b) => b.question === t), t.slice(0, 40)).toBe(false);
  });
  it("keeps a question in at most one lesson of each course", () => {
    const seen = new Set<string>();
    for (const m of bankMemberships()) {
      const key = `${m.id}|${m.course}`;
      expect(seen.has(key), `question ${m.id} twice in ${m.course}`).toBe(false);
      seen.add(key);
    }
  });
  it("covers every lesson whose lesson list is known: each has at least one question", () => {
    const covered = new Set<string>([...bankMemberships().map((m) => `${m.course}|${m.lesson}`), ...NEW_QUESTIONS.map((n) => `${n.course}|${n.lesson}`)]);
    const missing: string[] = [];
    for (const [course, lessons] of Object.entries(LESSONS)) for (const l of lessons) if (!covered.has(`${course}|${l}`)) missing.push(`${course} › ${l}`);
    expect(missing).toEqual([]);
  });
});
