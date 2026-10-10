/**
 * Generates the SQL that loads the built-in Associate + Developer set into the database:
 *   supabase/seed/questions.sql                       full reset: deletes every module and question, then loads everything
 *   supabase/migrations/0001_cert_readiness.sql       standard migration for a database that already has the questions (no deletes)
 *
 * Module title = exam domain, quiz_sub_skills = its weighted sub-skills, section = a question's sub-skill.
 * Usage: npm run bank:sql
 */
import fs from "node:fs";
import path from "node:path";
import { CODE_BANK } from "../src/lib/bank/code-bank";
import { TRACKS, TRACK_IDS } from "../src/lib/blueprint";

const q = (s: string) => `$q$${s}$q$`; // dollar-quoted: no escaping needed
const root = path.resolve(__dirname, "..");

const PART1 = `-- ── Part 1: schema ───────────────────────────────────────────────────────────

-- Domains (quiz_modules): which exam they belong to, their weight, and the data the study plan and tutor use
alter table quiz_modules
  add column if not exists track         text check (track in ('associate', 'developer')),
  add column if not exists weight        numeric(5,2),
  add column if not exists objective     text,
  add column if not exists course_module integer,
  add column if not exists doc_links     jsonb not null default '[]'::jsonb;

-- Every answer shows a written explanation
alter table quiz_questions add column if not exists explanation text;

-- Weighted sub-skills of a domain. weight is null where the exam guide publishes none (all Associate sub-skills)
create table if not exists quiz_sub_skills (
  id           serial primary key,
  module_id    integer not null references quiz_modules(id) on delete cascade,
  name         text not null,
  weight       numeric(5,2),
  order_index  integer not null default 0,
  unique (module_id, name)
);
alter table quiz_sub_skills alter column weight drop not null;
alter table quiz_sub_skills alter column weight drop default;

-- Leads: name, exam date and marketing consent captured by the email modal
create table if not exists quiz_leads (
  id          serial primary key,
  email       text not null unique,
  created_at  timestamptz not null default now()
);
alter table quiz_leads
  add column if not exists name               text,
  add column if not exists exam_date          date,
  add column if not exists marketing_consent  boolean not null default false,
  add column if not exists track              text,
  add column if not exists source             text;

-- Finished attempts (feeds the admin Responses page and the advisor's /report/<id> link)
create table if not exists quiz_attempts (
  id          uuid primary key,
  email       text,
  name        text,
  exam_date   date,
  track       text not null,
  mode        text not null,
  correct     integer not null,
  total       integer not null,
  readiness   integer,
  result      jsonb not null,
  plan        jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists quiz_attempts_email_idx on quiz_attempts (email);

-- "Report this question" from learners; upheld items should be taken down within 48 hours
create table if not exists reported_questions (
  id           bigserial primary key,
  question_id  integer not null,
  track        text not null,
  reason       text,
  email        text,
  status       text not null default 'open', -- open | upheld | dismissed
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

-- Product analytics events
create table if not exists analytics_events (
  id          bigserial primary key,
  event       text not null,
  props       jsonb not null default '{}'::jsonb,
  session_id  text,
  email       text,
  created_at  timestamptz not null default now()
);
create index if not exists analytics_events_event_idx on analytics_events (event, created_at);

-- Review mistakes: questions a learner got wrong. learner_key is their email once known, else the anonymous
-- session id. resolved_at is set when they later answer the question correctly.
create table if not exists learner_missed (
  learner_key     text not null,
  question_id     integer not null,
  track           text not null,
  missed_count    integer not null default 1,
  last_missed_at  timestamptz not null default now(),
  resolved_at     timestamptz,
  primary key (learner_key, question_id)
);
create index if not exists learner_missed_open_idx on learner_missed (learner_key, track) where resolved_at is null;

-- Free 1:1 review calls (filled by the scheduling tool's webhook, updated by the advisor)
create table if not exists call_bookings (
  id           bigserial primary key,
  invitee_uri  text unique,
  email        text not null,
  name         text,
  start_time   timestamptz,
  track        text,
  readiness    integer,
  report_url   text,
  status       text not null default 'booked', -- booked | attended | no_show | canceled
  outcome      text,
  offer_made   boolean,
  created_at   timestamptz not null default now()
);

-- All reads and writes go through the server with the service-role key, which bypasses row-level security.
-- Enabling it keeps the public anon key from reading leads, answers or attempts.
alter table if exists quiz_modules         enable row level security;
alter table if exists quiz_questions       enable row level security;
alter table if exists quiz_results         enable row level security;
alter table quiz_sub_skills                enable row level security;
alter table quiz_leads                     enable row level security;
alter table quiz_attempts                  enable row level security;
alter table reported_questions             enable row level security;
alter table analytics_events               enable row level security;
alter table call_bookings                  enable row level security;
alter table learner_missed                 enable row level security;

`;

/** Associate sub-skill names used before they were aligned to the exam guide's wording (for renaming existing rows). */
const LEGACY_ASSOCIATE_SUBSKILLS: Record<string, string> = {
  "Create effective prompts": "Create effective prompts for business and technical tasks",
  "Task decomposition": "Apply task decomposition techniques to structure complex requests",
  "Iterate prompts": "Iterate prompts to improve output quality",
  "Adapt prompting by task type": "Adapt prompting strategies based on task type (analysis, research, drafting, brainstorming)",
  "Evaluate accuracy and completeness": "Evaluate Claude-generated outputs for accuracy and completeness",
  "Identify hallucinations and bias": "Identify hallucinations, inconsistencies, and biases in responses",
  "Fact-checking and validation": "Apply fact-checking and validation techniques",
  "Human review decisions": "Determine when human review or additional verification is required",
  "Edit and adapt for the audience": "Edit, adapt, refine, and compare outputs for the intended audience",
  "Curate and choose output formats": "Organize and curate information and select appropriate output formats (artifacts, inline, structured data)",
  "Select product features": "Select appropriate Claude product features (Projects, research mode, chat, artifacts)",
  "Differentiate Haiku, Sonnet and Opus": "Differentiate between Claude model types (Haiku, Sonnet, Opus)",
  "Align model with cost, speed and quality": "Align model selection with task requirements (cost, speed, quality)",
  "Context limits and memory": "Understand and manage context limitations and memory considerations (when to restart, summarize, or persist)",
  "Analyse requirements and use cases": "Apply Claude to analyze requirements and use cases",
  "Research, planning and process optimisation": "Leverage Claude for research, planning, and process optimization",
  "Support solution design": "Use Claude to support solution design, development, and iteration",
  "Integrate into existing workflows": "Integrate Claude into existing workflows to augment or redesign them",
  "Communicate value and limitations": "Communicate Claude's value and limitations to stakeholders",
  "Configure Projects": "Configure Claude Projects with instructions and knowledge sources",
  "Manage knowledge and connectors": "Manage uploaded knowledge and connectors (e.g., Google Drive, Gmail)",
  "System-level instructions": "Create effective system-level instructions",
  "Maintain configurations": "Inform, maintain, and update Claude configurations, knowledge sources, and instructions",
  "Appropriate and inappropriate use": "Identify appropriate and inappropriate use cases",
  "Data sensitivity and privacy": "Apply data sensitivity, regulatory, and privacy considerations",
  "Organisational AI policy": "Follow organizational AI policies and governance standards",
  "Ethical implications": "Understand the ethical implications of AI usage",
  "Diagnose poor outputs": "Identify, diagnose, and resolve issues with underperforming prompts or poor outputs",
  "Adjust from feedback": "Adjust approach based on feedback and results",
  "Optimise workflows": "Optimize workflows for efficiency and effectiveness"
};

interface Dom { track: string; name: string; weight: number; objective: string; courseModule: number; docLinks: { title: string; url: string }[]; subs: { name: string; weight: number | null }[]; order: number; desc: string }
const doms: Dom[] = [];
let order = 0;
for (const t of TRACK_IDS) {
  for (const d of TRACKS[t].domains) {
    order++;
    doms.push({ track: t, name: d.name, weight: d.weight, objective: d.objective, courseModule: d.courseModule, docLinks: d.docLinks, subs: d.subSkills, order, desc: `${TRACKS[t].short} (${TRACKS[t].code}) · ${d.weight}% of the exam. ${d.objective}` });
  }
}
const json = (v: unknown) => q(JSON.stringify(v));

const subRows = doms.flatMap((d) => d.subs.map((s, i) => `  (${q(d.name)}, ${q(s.name)}, ${s.weight === null ? "null::numeric" : s.weight}, ${i + 1})`));
const subInsert = `insert into quiz_sub_skills (module_id, name, weight, order_index)
select m.id, v.name, v.weight, v.ord
from (values
${subRows.join(",\n")}
) as v (module_title, name, weight, ord)
join quiz_modules m on m.title = v.module_title
on conflict (module_id, name) do nothing;`;

// ── 1. Full reset + load ───────────────────────────────────────────────────
const questionRows: string[] = [];
for (const t of TRACK_IDS) {
  CODE_BANK.filter((x) => x.track === t).forEach((it, i) => {
    const o = it.options.map((x) => q(x.text));
    questionRows.push(`  (${q(it.domain)}, ${q(it.subSkill)}, ${q(it.difficulty)}, ${q(it.question)}, ${o.join(", ")}, ${q(it.answer)}, ${q(it.explanation ?? "")}, ${i + 1})`);
  });
}
const assoc = CODE_BANK.filter((x) => x.track === "associate").length;
const dev = CODE_BANK.filter((x) => x.track === "developer").length;

const reset = `-- Claude Cert Readiness: replace the question bank and load the exam blueprint.
-- Generated by scripts/generate-seed-sql.ts. Run once in the Supabase SQL editor.
--
-- Includes the same schema as migrations/0001_cert_readiness.sql, then replaces the content.
-- WARNING: this DELETES every row in quiz_modules, quiz_sub_skills and quiz_questions (including the old
-- "AI Product Thinking" questions) and restarts their ids at 1. quiz_results / quiz_leads / quiz_attempts are untouched.
-- Anything you edited in the admin since the last seed is lost.

begin;

${PART1}
truncate table quiz_questions, quiz_sub_skills, quiz_modules restart identity cascade;
-- Question ids restart at 1, so saved review lists would point at different questions
truncate table learner_missed;

-- Domains
insert into quiz_modules (title, description, locked, order_index, track, weight, objective, course_module, doc_links) values
${doms.map((d) => `  (${q(d.name)}, ${q(d.desc)}, false, ${d.order}, ${q(d.track)}, ${d.weight}, ${q(d.objective)}, ${d.courseModule}, ${json(d.docLinks)}::jsonb)`).join(",\n")};

-- Sub-skills
${subInsert}

-- Questions (module resolved by domain title; sub-skill goes in "section"; multi-answer keys look like 'A,C')
with q (module_title, section, difficulty, question, option_a, option_b, option_c, option_d, answer, explanation, ord) as (values
${questionRows.join(",\n")}
)
insert into quiz_questions (module_id, section, difficulty, question, option_a, option_b, option_c, option_d, answer, explanation, order_index)
select m.id, q.section, q.difficulty, q.question, q.option_a, q.option_b, q.option_c, q.option_d, q.answer, nullif(q.explanation, ''), q.ord
from q
join quiz_modules m on m.title = q.module_title
order by m.order_index, q.ord;

-- Sanity check: expect ${assoc} associate + ${dev} developer questions
select m.track, m.title, m.weight, count(qq.id) as questions
from quiz_modules m left join quiz_questions qq on qq.module_id = m.id
group by m.id order by m.order_index;

commit;
`;

// ── 2. Migration for a database that already has the questions ─────────────
// Standard, re-runnable migration: schema first, then one data step per concern.
const assocTitles = doms.filter((d) => d.track === "associate").map((d) => q(d.name)).join(", ");

const domainValues = doms
  .map((d) => `  (${q(d.name)}, ${q(d.track)}, ${d.weight}::numeric, ${q(d.objective)}, ${d.courseModule}, ${json(d.docLinks)}::jsonb)`)
  .join(",\n");

const renameValues = Object.entries(LEGACY_ASSOCIATE_SUBSKILLS)
  .map(([old, next]) => `  (${q(old)}, ${q(next)})`)
  .join(",\n");

const migration = `-- Claude Cert Readiness: one migration for the whole feature set. Safe to re-run; deletes nothing.
-- Run it once in the Supabase SQL editor. It assumes the quiz_modules / quiz_questions tables already exist
-- and have the questions loaded (the app reads them). If you want to start from an empty bank instead, run
-- supabase/seed/questions.sql, which already includes everything below.
--
-- Part 1 changes the schema. Part 2 fills the new columns for the domains already in the database.

begin;

${PART1}
-- ── Part 2: data for the domains already in the database (matched by title) ─────────────────────────

-- 2a. Associate sub-skill names now use the exam guide's own task wording
with rename (old_name, new_name) as (values
${renameValues}
)
update quiz_questions qq
set section = r.new_name
from rename r, quiz_modules m
where m.id = qq.module_id and m.title in (${assocTitles}) and qq.section = r.old_name;

-- 2b. Track, weight, objective, course module and doc links. Only fills what is still empty.
update quiz_modules m
set track         = coalesce(m.track, v.track),
    weight        = coalesce(m.weight, v.weight),
    objective     = coalesce(m.objective, v.objective),
    course_module = coalesce(m.course_module, v.course_module),
    doc_links     = case when m.doc_links = '[]'::jsonb then v.doc_links else m.doc_links end
from (values
${domainValues}
) as v (title, track, weight, objective, course_module, doc_links)
where m.title = v.title;

-- 2c. Sub-skills with their official weights (blank for Associate). Existing rows are left alone.
${subInsert}

commit;
`;

fs.mkdirSync(path.join(root, "supabase/seed"), { recursive: true });
fs.mkdirSync(path.join(root, "supabase/migrations"), { recursive: true });
fs.writeFileSync(path.join(root, "supabase/seed/questions.sql"), reset);
fs.writeFileSync(path.join(root, "supabase/migrations/0001_cert_readiness.sql"), migration);
console.log(`Wrote supabase/seed/questions.sql (${questionRows.length} questions, ${doms.length} domains, ${subRows.length} sub-skills)`);
console.log("Wrote supabase/migrations/0001_cert_readiness.sql");
