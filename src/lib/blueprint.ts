import type { ModeId, TrackId } from "@/types/quiz";

/**
 * Official blueprints, from the Associate and Developer exam guides (v1.0, July 2026).
 * Weights are percentages of the whole exam. The Developer guide weights every sub-skill. The
 * Associate guide weights only its 7 domains, so its sub-skills (the guide's task bullets) are
 * unweighted tags: nothing is invented, and Associate mocks are drawn at domain weights only.
 */

export interface DocLink {
  title: string;
  url: string;
}

export interface SubSkillDef {
  name: string;
  /** Share of the whole exam (%). null when the exam guide publishes no sub-skill weight. */
  weight: number | null;
}

export interface DomainDef {
  name: string;
  weight: number;
  subSkills: SubSkillDef[];
  docLinks: DocLink[];
  /** Module of the Agentic AI Institute course that covers this domain (editable) */
  courseModule: number;
  /** One-line objective given to the tutor and the study plan */
  objective: string;
}

export interface TrackDef {
  id: TrackId;
  name: string;
  short: string;
  code: string;
  items: number;
  minutes: number;
  fee: number;
  audience: string;
  domains: DomainDef[];
}

const P = "https://platform.claude.com/docs/en";
const C = "https://code.claude.com/docs/en";
const S = "https://support.claude.com/en";

const unweighted = (names: string[]): SubSkillDef[] => names.map((name) => ({ name, weight: null }));

const ASSOCIATE_DOMAINS: DomainDef[] = [
  {
    name: "Prompting and Task Execution",
    weight: 14,
    courseModule: 1,
    objective: "Write effective prompts, decompose complex tasks, iterate, and adapt the approach to the task type.",
    docLinks: [{ title: "Prompt engineering overview", url: `${P}/build-with-claude/prompt-engineering/overview` }],
    subSkills: unweighted(
      [
        "Create effective prompts for business and technical tasks",
        "Apply task decomposition techniques to structure complex requests",
        "Iterate prompts to improve output quality",
        "Adapt prompting strategies based on task type (analysis, research, drafting, brainstorming)",
      ]
    ),
  },
  {
    name: "Output Evaluation and Validation",
    weight: 21,
    courseModule: 2,
    objective: "Judge Claude outputs for accuracy, spot hallucinations and bias, verify, and know when human review is required.",
    docLinks: [
      { title: "Reduce hallucinations", url: `${P}/test-and-evaluate/strengthen-guardrails/reduce-hallucinations` },
    ],
    subSkills: unweighted(
      [
        "Evaluate Claude-generated outputs for accuracy and completeness",
        "Identify hallucinations, inconsistencies, and biases in responses",
        "Apply fact-checking and validation techniques",
        "Determine when human review or additional verification is required",
        "Edit, adapt, refine, and compare outputs for the intended audience",
        "Organize and curate information and select appropriate output formats (artifacts, inline, structured data)",
      ]
    ),
  },
  {
    name: "Product and Model Selection",
    weight: 12,
    courseModule: 3,
    objective: "Pick the right Claude product feature and model tier, and manage context limits and memory.",
    docLinks: [
      { title: "Models overview", url: `${P}/about-claude/models/overview` },
      { title: "Claude help center", url: `${S}/` },
    ],
    subSkills: unweighted(
      [
        "Select appropriate Claude product features (Projects, research mode, chat, artifacts)",
        "Differentiate between Claude model types (Haiku, Sonnet, Opus)",
        "Align model selection with task requirements (cost, speed, quality)",
        "Understand and manage context limitations and memory considerations (when to restart, summarize, or persist)",
      ]
    ),
  },
  {
    name: "Workflow Integration and Solution Design",
    weight: 16,
    courseModule: 4,
    objective: "Use Claude to analyse requirements, plan, design solutions, and fit into existing workflows.",
    docLinks: [{ title: "Use cases", url: `${P}/about-claude/use-case-guides/overview` }],
    subSkills: unweighted(
      [
        "Apply Claude to analyze requirements and use cases",
        "Leverage Claude for research, planning, and process optimization",
        "Use Claude to support solution design, development, and iteration",
        "Integrate Claude into existing workflows to augment or redesign them",
        "Communicate Claude's value and limitations to stakeholders",
      ]
    ),
  },
  {
    name: "Configuration and Knowledge Management",
    weight: 12,
    courseModule: 5,
    objective: "Configure Projects, instructions, knowledge sources and connectors, and keep them current.",
    docLinks: [{ title: "Projects in Claude", url: `${S}/articles/9517075-what-are-projects` }],
    subSkills: unweighted(
      [
        "Configure Claude Projects with instructions and knowledge sources",
        "Manage uploaded knowledge and connectors (e.g., Google Drive, Gmail)",
        "Create effective system-level instructions",
        "Inform, maintain, and update Claude configurations, knowledge sources, and instructions",
      ]
    ),
  },
  {
    name: "Governance, Risk, and Responsible Use",
    weight: 15,
    courseModule: 6,
    objective: "Recognise appropriate use cases, handle sensitive data, follow AI policy and consider ethics.",
    docLinks: [{ title: "Privacy and safety", url: `${S}/collections/4078534-privacy-and-legal` }],
    subSkills: unweighted(
      [
        "Identify appropriate and inappropriate use cases",
        "Apply data sensitivity, regulatory, and privacy considerations",
        "Follow organizational AI policies and governance standards",
        "Understand the ethical implications of AI usage",
      ]
    ),
  },
  {
    name: "Troubleshooting and Optimization",
    weight: 10,
    courseModule: 7,
    objective: "Diagnose weak prompts or outputs, adjust from feedback, and optimise workflows.",
    docLinks: [{ title: "Prompting tips", url: `${P}/build-with-claude/prompt-engineering/overview` }],
    subSkills: unweighted(
      ["Identify, diagnose, and resolve issues with underperforming prompts or poor outputs", "Adjust approach based on feedback and results", "Optimize workflows for efficiency and effectiveness"]
    ),
  },
];

const dev = (
  name: string,
  weight: number,
  courseModule: number,
  objective: string,
  docLinks: DocLink[],
  subSkills: [string, number][]
): DomainDef => ({
  name,
  weight,
  courseModule,
  objective,
  docLinks,
  subSkills: subSkills.map(([n, w]) => ({ name: n, weight: w })),
});

const DEVELOPER_DOMAINS: DomainDef[] = [
  dev(
    "Applications and Integration",
    33.1,
    2,
    "Build Claude applications: requirements, API mechanics, engineering foundations, application design and configuration.",
    [
      { title: "Messages API", url: `${P}/api/messages` },
      { title: "Batch processing", url: `${P}/build-with-claude/batch-processing` },
      { title: "Streaming", url: `${P}/build-with-claude/streaming` },
    ],
    [
      ["Understanding Requirements", 3.4],
      ["Systems Life Cycle", 2.8],
      ["Claude API Mechanics", 6.8],
      ["Software Engineering Foundations", 7.4],
      ["Claude Application Design", 8.6],
      ["Configuration Management", 4.1],
    ]
  ),
  dev(
    "Model Selection and Optimization",
    16.8,
    5,
    "Understand LLM fundamentals, pick models, and manage cost and tokens.",
    [
      { title: "Models overview", url: `${P}/about-claude/models/overview` },
      { title: "Prompt caching", url: `${P}/build-with-claude/prompt-caching` },
      { title: "Extended thinking", url: `${P}/build-with-claude/extended-thinking` },
    ],
    [
      ["LLM Fundamentals", 5.2],
      ["Technical Fundamentals", 6.1],
      ["Model Selection and Tradeoffs", 2.7],
      ["Cost and Token Management", 2.8],
    ]
  ),
  dev(
    "Agents and Workflows",
    14.7,
    1,
    "Choose between workflows and agents, construct agents with Claude, and apply agent patterns.",
    [
      { title: "Agent SDK", url: `${P}/agent-sdk/overview` },
      { title: "Tool use overview", url: `${P}/agents-and-tools/tool-use/overview` },
    ],
    [
      ["Agent Architecture", 4.5],
      ["Agent Construction with Claude", 5.3],
      ["Agent Patterns and Frameworks", 4.9],
    ]
  ),
  dev(
    "Prompt and Context Engineering",
    11.0,
    3,
    "Manage context, write prompts, and handle Claude output defensively.",
    [
      { title: "Prompt engineering overview", url: `${P}/build-with-claude/prompt-engineering/overview` },
      { title: "Structured outputs", url: `${P}/build-with-claude/structured-outputs` },
    ],
    [
      ["Context Engineering", 3.8],
      ["Prompt Engineering", 4.6],
      ["Output Handling", 2.6],
    ]
  ),
  dev(
    "Tools and MCPs",
    10.6,
    4,
    "Implement tools, build MCP servers, and choose between tools, Skills and MCP.",
    [
      { title: "Tool use overview", url: `${P}/agents-and-tools/tool-use/overview` },
      { title: "MCP in Claude Code", url: `${C}/mcp` },
    ],
    [
      ["Tool Implementation", 4.4],
      ["MCP Server Development", 2.1],
      ["Agentic Customization", 4.1],
    ]
  ),
  dev(
    "Security and Safety",
    8.1,
    6,
    "Secure Claude applications: injection, guardrails, hooks, secrets and identity.",
    [
      { title: "Mitigate jailbreaks and prompt injections", url: `${P}/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks` },
      { title: "Hooks", url: `${C}/hooks` },
    ],
    [
      ["AI Application Security", 3.2],
      ["Guardrails and Safe Deployment", 2.3],
      ["Claude Hooks", 1.0],
      ["Identity, Secrets, and Key Management", 1.6],
    ]
  ),
  dev(
    "Claude Code",
    3.1,
    7,
    "Operate Claude Code: rules, skills, commands, agents, memory and settings.",
    [
      { title: "Claude Code overview", url: `${C}/overview` },
      { title: "Memory and CLAUDE.md", url: `${C}/memory` },
    ],
    [["Claude Code Operation", 3.1]]
  ),
  dev(
    "Eval, Testing, and Debugging",
    2.6,
    8,
    "Debug Claude applications: error types, recovery, tracing and isolating failures.",
    [{ title: "Define success and build evals", url: `${P}/test-and-evaluate/develop-tests` }],
    [["Debugging and Error Handling", 2.6]]
  ),
];

export const TRACKS: Record<TrackId, TrackDef> = {
  associate: {
    id: "associate",
    name: "Claude Certified Associate",
    short: "Associate",
    code: "CCAO-F",
    items: 60,
    minutes: 120,
    fee: 99,
    audience: "Consultants, PMs and analysts who use Claude daily but don't code.",
    domains: ASSOCIATE_DOMAINS,
  },
  developer: {
    id: "developer",
    name: "Claude Certified Developer",
    short: "Developer",
    code: "CCDV-F",
    items: 53,
    minutes: 120,
    fee: 125,
    audience: "Engineers with 1–5 years of experience building on the Claude API.",
    domains: DEVELOPER_DOMAINS,
  },
};

export const TRACK_IDS: TrackId[] = ["associate", "developer"];

export function isTrack(v: string): v is TrackId {
  return v === "associate" || v === "developer";
}

export function domainDef(track: TrackId, domain: string): DomainDef | undefined {
  return TRACKS[track].domains.find((d) => d.name === domain);
}

export interface ModeDef {
  id: ModeId;
  title: string;
  purpose: string;
  /** Number of questions, or null when it depends on the track / history */
  questions: (track: TrackId) => number | null;
  minutes: ((track: TrackId) => number) | null;
  /** Next item is chosen at runtime from the learner's weakest sub-skill */
  adaptive: boolean;
}

export const MODES: Record<ModeId, ModeDef> = {
  diagnostic: {
    id: "diagnostic",
    title: "Readiness diagnostic",
    purpose: "First stop. Seeds your readiness score across every domain.",
    questions: () => 20,
    minutes: () => 40,
    adaptive: false,
  },
  sprint: {
    id: "sprint",
    title: "Quick sprint",
    purpose: "10 questions that target your weakest sub-skills. A daily habit.",
    questions: () => 10,
    minutes: () => 20,
    adaptive: true,
  },
  drill: {
    id: "drill",
    title: "Domain drill",
    purpose: "20 questions from one domain to fix a weak area.",
    questions: () => 20,
    minutes: () => 40,
    adaptive: true,
  },
  full: {
    id: "full",
    title: "Full mock exam",
    purpose: "Exam rehearsal: the real item count and time, drawn at the official weights.",
    questions: (t) => TRACKS[t].items,
    minutes: (t) => TRACKS[t].minutes,
    adaptive: false,
  },
  review: {
    id: "review",
    title: "Review mistakes",
    purpose: "Every question you've previously missed. Untimed spaced repetition.",
    questions: () => null,
    minutes: null,
    adaptive: false,
  },
};

export const MODE_IDS: ModeId[] = ["diagnostic", "sprint", "drill", "full", "review"];

/** Share of the exam (0..1) a domain's sub-skills sum to; used to weight readiness. */
export function weightFraction(track: TrackId, domain: string): number {
  const total = TRACKS[track].domains.reduce((n, d) => n + d.weight, 0);
  return (domainDef(track, domain)?.weight ?? 0) / total;
}
