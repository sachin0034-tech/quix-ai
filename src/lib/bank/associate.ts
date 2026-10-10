import type { BankQuestion, Difficulty, OptionLabel } from "@/types/quiz";

/**
 * Original Associate track items (60 original items), written against the CCAO-F exam guide
 * v1.0 objectives. Items are original; none are recalled from the live exam. Needs expert review
 * before public launch (see rollout plan: 200+ reviewed items per track).
 */

type Seed = [
  id: number,
  domain: string,
  subSkill: string,
  difficulty: Difficulty,
  question: string,
  options: [string, string, string, string],
  answer: string,
  explanation: string,
];

const D1 = "Prompting and Task Execution";
const D2 = "Output Evaluation and Validation";
const D3 = "Product and Model Selection";
const D4 = "Workflow Integration and Solution Design";
const D5 = "Configuration and Knowledge Management";
const D6 = "Governance, Risk, and Responsible Use";
const D7 = "Troubleshooting and Optimization";

const SEEDS: Seed[] = [
  // ── Prompting and Task Execution (4)
  [
    1001, D1, "Create effective prompts for business and technical tasks", "Easy",
    "A marketing coordinator types \"Write something about our new product.\" The first draft is generic. Which change would most improve the next result?",
    [
      "Add the audience, the goal, the tone, the key facts and the desired length to the prompt",
      "Repeat the same request three times and pick the best draft",
      "Ask Claude to be more creative without adding detail",
      "Switch to a different model before changing the prompt",
    ],
    "A",
    "Clear prompts state context, audience, purpose, constraints and format. Giving Claude the missing detail is the most direct fix. Re-running the same vague prompt, asking for creativity without direction or changing models leaves the underspecified request in place.",
  ],
  [
    1002, D1, "Apply task decomposition techniques to structure complex requests", "Medium",
    "An operations lead wants Claude to turn 40 pages of meeting notes into a risk register, a stakeholder email and a one-page summary. What is the best approach?",
    [
      "Ask for all three deliverables in a single sentence",
      "Break the work into steps: extract risks, build the register, then draft the email and summary from it",
      "Paste only the first five pages and hope the rest is not needed",
      "Ask Claude to guess which deliverable matters most and do only that one",
    ],
    "B",
    "Decomposing a complex request into ordered steps lets you check each intermediate result and reuse it for later deliverables. One compound sentence or partial input produces weaker, harder-to-verify output.",
  ],
  [
    1003, D1, "Iterate prompts to improve output quality", "Easy",
    "Claude's first draft of a client update is accurate but far too formal. What is the most effective next step?",
    [
      "Start a brand-new conversation and re-enter everything",
      "Accept the draft and edit it manually every time",
      "Reply with specific feedback, such as the tone to use and a sentence-length target, and ask for a revision",
      "Ask Claude whether it is sure the draft is correct",
    ],
    "C",
    "Iterating means giving targeted feedback on what to change and letting Claude revise. It keeps the useful context and improves the result faster than restarting or editing by hand.",
  ],
  [
    1004, D1, "Adapt prompting strategies based on task type (analysis, research, drafting, brainstorming)", "Medium",
    "A strategy analyst needs Claude to brainstorm 15 possible market-entry ideas, then later compare three of them rigorously. How should the prompting differ between the two tasks?",
    [
      "Use identical prompts for both because Claude adapts automatically",
      "Encourage breadth and variety when brainstorming, then give explicit criteria and a structure for the comparison",
      "Ask for only one idea in brainstorming and a long essay for the comparison",
      "Keep both prompts as short as possible",
    ],
    "B",
    "Different task types need different instructions. Brainstorming benefits from breadth and few constraints; analysis benefits from explicit criteria and a clear output structure.",
  ],

  // ── Output Evaluation and Validation (6)
  [
    1005, D2, "Apply fact-checking and validation techniques", "Medium",
    "Claude summarises a market report and states that a competitor's revenue grew 38% last year. The figure will go into a board deck. What should you do first?",
    [
      "Include it, since Claude sounded confident",
      "Ask Claude to rate its own confidence and use the figure if the rating is high",
      "Verify the number against the original report or another authoritative source before using it",
      "Round the number to 40% so it is safe",
    ],
    "C",
    "Specific figures can be fabricated or misread. Verify high-stakes facts against an authoritative source. Self-reported confidence is not a reliable signal of accuracy.",
  ],
  [
    1006, D2, "Identify hallucinations, inconsistencies, and biases in responses", "Medium",
    "Which of these are common warning signs that a Claude response may contain a hallucination? Select 2.",
    [
      "A precise citation, statistic or quote that you cannot trace to a real source",
      "A response that asks a clarifying question",
      "Confident detail about a very recent or obscure event Claude had no way to look up",
      "A response written in a different heading style than requested",
    ],
    "A,C",
    "Untraceable specifics and confident claims about things Claude could not have reliable information on are classic hallucination signals. Clarifying questions and formatting differences are not accuracy problems.",
  ],
  [
    1007, D2, "Determine when human review or additional verification is required", "Hard",
    "A team uses Claude to draft responses to customer complaints. Which situation most clearly requires a human to review before sending?",
    [
      "A thank-you note for a positive review",
      "A reply offering a refund exception and discussing a possible legal claim",
      "A reminder about store opening hours",
      "A short acknowledgement that a message was received",
    ],
    "B",
    "Human review is most important where the consequences are high: financial commitments, legal exposure or reputational risk. Low-stakes routine replies need lighter checks.",
  ],
  [
    1008, D2, "Evaluate Claude-generated outputs for accuracy and completeness", "Medium",
    "You asked Claude to summarise a contract's termination, payment and liability clauses. The summary covers termination and payment only. What does this show?",
    [
      "The summary is complete because it reads smoothly",
      "The output is incomplete against the request and should be corrected before use",
      "Liability clauses are never summarised by AI tools",
      "The contract probably has no liability clause",
    ],
    "B",
    "Evaluating output means checking it against what you asked for. A fluent summary that omits a requested section is incomplete, and you should ask Claude to cover the missing part and check the source.",
  ],
  [
    1009, D2, "Edit, adapt, refine, and compare outputs for the intended audience", "Easy",
    "Claude wrote a technical incident summary. You need to send it to non-technical executives. What is the best approach?",
    [
      "Forward it unchanged",
      "Ask Claude to rewrite it for executives in plain language, leading with business impact and next steps",
      "Delete all numbers from the summary",
      "Translate it into another language",
    ],
    "B",
    "Outputs should be adapted to the intended audience. Plain language, business impact and clear next steps serve executives, while unchanged technical detail does not.",
  ],
  [
    1010, D2, "Organize and curate information and select appropriate output formats (artifacts, inline, structured data)", "Medium",
    "A finance analyst wants Claude's output to be pasted into a spreadsheet with consistent columns. Which output request works best?",
    [
      "A narrative paragraph describing each item",
      "A table or CSV-style structure with the exact column names specified",
      "A poem summarising the data",
      "A bullet list with no consistent fields",
    ],
    "B",
    "When the output feeds another tool, ask for a structured format with the exact fields you need. Free prose or inconsistent lists have to be reformatted by hand.",
  ],

  // ── Product and Model Selection (4)
  [
    1011, D3, "Align model selection with task requirements (cost, speed, quality)", "Easy",
    "A support team needs thousands of short, routine reply drafts per day, where speed and cost matter most. Which approach fits best?",
    [
      "Use the most capable, highest-cost model for every reply",
      "Use a faster, lower-cost model suited to straightforward, high-volume tasks",
      "Avoid AI for any high-volume task",
      "Write each reply from scratch to guarantee quality",
    ],
    "B",
    "Match the model to the task. Faster, cheaper models handle simple, repetitive work well, and the most capable models are best reserved for complex reasoning.",
  ],
  [
    1012, D3, "Differentiate between Claude model types (Haiku, Sonnet, Opus)", "Medium",
    "Which statement best describes how the Claude model tiers are generally positioned?",
    [
      "Haiku is the largest and slowest; Opus is the smallest and cheapest",
      "Haiku is optimised for speed and cost, Sonnet balances capability and cost, and Opus is the most capable for complex work",
      "All tiers are identical and differ only in name",
      "The tiers differ only in which languages they support",
    ],
    "B",
    "Haiku, Sonnet and Opus trade off speed, cost and capability. Choosing a tier means picking the best balance for the task at hand.",
  ],
  [
    1013, D3, "Understand and manage context limitations and memory considerations (when to restart, summarize, or persist)", "Hard",
    "A long conversation with Claude has drifted and earlier instructions seem to be ignored. What is the most sensible action?",
    [
      "Keep adding more instructions at the end of the same chat",
      "Summarise the key decisions and instructions, then start a fresh conversation seeded with that summary",
      "Wait a few hours; Claude will remember better later",
      "Assume the model is broken and stop using it",
    ],
    "B",
    "Very long conversations can exceed useful context. Summarising what matters and restarting keeps the important information in focus. For recurring needs, persist it in a Project or instructions.",
  ],
  [
    1014, D3, "Select appropriate Claude product features (Projects, research mode, chat, artifacts)", "Medium",
    "A consultant needs to produce a polished, shareable interactive dashboard from a data summary and iterate on its layout. Which Claude capability is the best fit?",
    [
      "A plain one-line chat answer",
      "Artifacts, which render and iterate on a standalone piece of content such as a dashboard",
      "Deleting the conversation and starting over",
      "A system prompt alone, with no content",
    ],
    "B",
    "Artifacts are designed for self-contained, iterative outputs like documents, pages and dashboards. Matching the feature to the task is part of product selection.",
  ],

  // ── Workflow Integration and Solution Design (5)
  [
    1015, D4, "Apply Claude to analyze requirements and use cases", "Medium",
    "A project manager wants to introduce Claude into a proposal process. What should happen first?",
    [
      "Buy licences for everyone immediately",
      "Map the current steps, identify where time is lost and define what success looks like before deciding how Claude helps",
      "Tell the team to use Claude however they like with no guidance",
      "Replace the entire process in one go",
    ],
    "B",
    "Good solution design starts with understanding the requirement and the problem, then choosing where Claude adds value and how to measure it.",
  ],
  [
    1016, D4, "Integrate Claude into existing workflows to augment or redesign them", "Medium",
    "A team reviews weekly status reports by hand. Which use of Claude best augments the workflow while keeping accountability clear?",
    [
      "Claude drafts a consolidated summary and flags missing updates; a team member verifies and sends it",
      "Claude sends the final report to the client automatically with no review",
      "Claude replaces all team meetings",
      "Claude decides who gets promoted based on the reports",
    ],
    "A",
    "Augmenting a workflow means using Claude for the repetitive drafting and flagging while a person stays accountable for verification and delivery.",
  ],
  [
    1017, D4, "Communicate Claude's value and limitations to stakeholders", "Hard",
    "You are presenting a Claude pilot to senior stakeholders. Which message is the most credible?",
    [
      "Claude is always correct, so no checks are needed",
      "Claude can cut drafting time significantly in this process, with defined review steps for accuracy and sensitive content",
      "Claude will replace the whole team within a year",
      "Claude cannot be trusted with any business task",
    ],
    "B",
    "Credible communication states both the measurable benefit and the limitations, including the controls that manage them. Overstating or dismissing the technology erodes trust.",
  ],
  [
    1018, D4, "Leverage Claude for research, planning, and process optimization", "Medium",
    "Which tasks are good candidates for using Claude to support planning and research? Select 2.",
    [
      "Drafting an outline for a project plan and listing risks to consider",
      "Making a final legal determination without a lawyer",
      "Summarising a set of supplied articles and comparing their main arguments",
      "Approving payments on behalf of finance",
    ],
    "A,C",
    "Claude is well suited to outlining, brainstorming risks and synthesising supplied material. Final legal determinations and payment approvals require accountable humans.",
  ],
  [
    1019, D4, "Use Claude to support solution design, development, and iteration", "Hard",
    "A team wants a solution that processes inbound requests and sometimes needs a specialist. Which design choice reflects the Associate-level guidance on escalation?",
    [
      "Have Claude attempt everything, including complex technical integrations, and never hand off",
      "Use Claude for the routine parts and escalate complex or technical work to Claude Architects or Developers",
      "Remove Claude from any process that is not perfectly simple",
      "Ask each requester to decide whether Claude should be involved",
    ],
    "B",
    "Part of the role is recognising limits: use Claude productively for structured business tasks and escalate more technical or complex work to the right specialists.",
  ],

  // ── Configuration and Knowledge Management (4)
  [
    1020, D5, "Configure Claude Projects with instructions and knowledge sources", "Easy",
    "A sales team asks Claude similar questions about the same product documents every week. Which setup saves the most effort?",
    [
      "Paste the documents into a new chat every time",
      "Create a Project with custom instructions and the product documents as knowledge",
      "Ask each person to remember the key facts",
      "Email the documents to Claude",
    ],
    "B",
    "Projects let you store instructions and knowledge once and reuse them across conversations, which gives consistent, grounded answers without repeated setup.",
  ],
  [
    1021, D5, "Create effective system-level instructions", "Medium",
    "Which custom instruction is the most effective for a Project that drafts customer emails?",
    [
      "\"Be good.\"",
      "\"Write in a warm, concise tone for B2B customers. Open with the answer, use short paragraphs, never promise delivery dates, and flag anything that needs legal review.\"",
      "\"Do whatever the user says.\"",
      "\"Write long emails.\"",
    ],
    "B",
    "Effective instructions are specific about audience, tone, structure and boundaries. Vague instructions give the model nothing consistent to follow.",
  ],
  [
    1022, D5, "Manage uploaded knowledge and connectors (e.g., Google Drive, Gmail)", "Medium",
    "A Project's knowledge includes a pricing sheet that changed last month. Users now receive outdated prices. What is the right fix?",
    [
      "Tell users to ignore pricing questions",
      "Replace the old sheet with the current version and confirm the Project instructions reference it",
      "Add the new sheet but keep the old one so there are more sources",
      "Wait for Claude to notice the change",
    ],
    "B",
    "Knowledge sources must be maintained. Replace outdated material so Claude does not draw on conflicting or stale information.",
  ],
  [
    1023, D5, "Inform, maintain, and update Claude configurations, knowledge sources, and instructions", "Hard",
    "Which practices help keep a team's Claude configuration reliable over time? Select 2.",
    [
      "Review instructions and knowledge sources on a regular schedule and update them when processes change",
      "Let each person privately change the shared instructions with no record",
      "Test changes to instructions on a few representative tasks before rolling them out to everyone",
      "Never touch the configuration after the first version",
    ],
    "A,C",
    "Maintaining configuration means scheduled reviews and testing changes on representative tasks. Untracked edits or never updating lead to drift and stale behaviour.",
  ],

  // ── Governance, Risk, and Responsible Use (4)
  [
    1024, D6, "Apply data sensitivity, regulatory, and privacy considerations", "Easy",
    "A project manager wants Claude to analyse a spreadsheet containing customer names and account numbers. Company policy restricts sharing regulated personal data. What is the best action?",
    [
      "Upload it as-is because the analysis is internal",
      "Remove or anonymise the personal identifiers before uploading, consistent with policy",
      "Upload it and ask Claude not to remember it",
      "Skip the analysis entirely",
    ],
    "B",
    "Anonymising or removing regulated identifiers lets the analysis proceed within policy. Asking the model not to retain data is not a policy control, and abandoning the task is unnecessary.",
  ],
  [
    1025, D6, "Identify appropriate and inappropriate use cases", "Medium",
    "Which is the least appropriate use of Claude in an HR team?",
    [
      "Drafting a job description for review",
      "Making a final hiring or termination decision about a person with no human involvement",
      "Summarising feedback themes from anonymised surveys",
      "Suggesting interview questions for a role",
    ],
    "B",
    "High-impact decisions about people require accountable human judgement. Claude can assist with drafting and analysis but should not be the sole decision-maker.",
  ],
  [
    1026, D6, "Follow organizational AI policies and governance standards", "Medium",
    "Your organisation has an approved-tools list and a rule against pasting client confidential data into unapproved services. A colleague suggests using a personal account to move faster. What should you do?",
    [
      "Use the personal account because speed matters",
      "Follow the policy: use the approved setup, and ask the governance owner if you believe an exception is needed",
      "Use the personal account but delete the chat afterwards",
      "Ignore the policy because it is probably out of date",
    ],
    "B",
    "Following organisational AI policy means using approved tools and raising exceptions through the proper channel. Deleting a chat afterwards does not undo a policy breach.",
  ],
  [
    1027, D6, "Understand the ethical implications of AI usage", "Hard",
    "A team notices that Claude's drafted candidate summaries consistently describe one group more negatively. What is the most responsible response?",
    [
      "Publish the summaries because the model is objective",
      "Treat it as potential bias: stop relying on the output, review and adjust the prompts and process, and add human review",
      "Remove all mention of any group and carry on",
      "Assume it is a one-off with no need to investigate",
    ],
    "B",
    "Patterns of biased output are an ethical and risk issue. Pause reliance, investigate and mitigate with prompt and process changes plus human oversight.",
  ],

  // ── Troubleshooting and Optimization (3)
  [
    1028, D7, "Identify, diagnose, and resolve issues with underperforming prompts or poor outputs", "Medium",
    "Claude keeps returning generic answers to a nuanced request. Which diagnosis is most likely, and what is the fix?",
    [
      "The model is permanently broken; stop using it",
      "The prompt lacks context and constraints; add the background, the goal and examples of a good answer",
      "Questions should always be shorter",
      "Claude only answers generically on Mondays",
    ],
    "B",
    "Generic output often points to an underspecified prompt. Supplying context, constraints and an example of what good looks like usually fixes it.",
  ],
  [
    1029, D7, "Adjust approach based on feedback and results", "Medium",
    "After three rounds, Claude's revisions keep missing the same requirement. Which adjustment is most likely to help?",
    [
      "Repeat the same instruction louder",
      "Restate the requirement explicitly, say what was wrong with the last attempt, and give a short example of the expected result",
      "Ask for a longer answer",
      "Remove all other requirements",
    ],
    "B",
    "When a requirement is repeatedly missed, make it explicit, name the gap and show an example. Repeating the same wording gives Claude nothing new to act on.",
  ],
  [
    1030, D7, "Optimize workflows for efficiency and effectiveness", "Hard",
    "A team spends 30 minutes per report writing a fresh prompt each time. How can they optimise?",
    [
      "Accept the time cost as unavoidable",
      "Turn the best-performing prompt into a reusable template or Project instructions, and refine it from results",
      "Switch to a different tool each week",
      "Ask a different person to write the prompt each time",
    ],
    "B",
    "Reusable templates and Project instructions capture what works, making the workflow faster and more consistent, and they can be improved over time.",
  ],

  // ── Added to reach 60 items (a full Associate mock) ─────────────────────────
  // Prompting and Task Execution (+4)
  [
    1031, D1, "Create effective prompts for business and technical tasks", "Medium",
    "A recruiter wants Claude to screen candidate summaries. Which prompt is most likely to produce consistent, usable results?",
    [
      "\"Tell me which candidates are good.\"",
      "\"Using the criteria below, rate each summary 1-5 per criterion, give one sentence of evidence per rating, and return a table. Criteria: [list].\"",
      "\"Be a great recruiter and pick the best people.\"",
      "\"Summarise everything about these candidates in as many words as possible.\"",
    ],
    "B",
    "Consistent results come from explicit criteria, a defined scoring scheme and a fixed output format. Vague or open-ended prompts let the output vary from run to run.",
  ],
  [
    1032, D1, "Apply task decomposition techniques to structure complex requests", "Hard",
    "A finance analyst wants a quarterly variance commentary built from four data exports. Which approach gives the most reliable result?",
    [
      "Paste all four exports and ask for the finished commentary in one step",
      "First have Claude summarise each export, then identify the largest variances, then draft the commentary from those findings, checking each stage",
      "Ask Claude to guess the likely variances without the data",
      "Write the commentary yourself and ask Claude only to fix typos",
    ],
    "B",
    "Breaking the work into stages lets you validate intermediate results and keeps each step focused. A single giant request hides errors until the end.",
  ],
  [
    1033, D1, "Iterate prompts to improve output quality", "Medium",
    "Which actions are good ways to improve a prompt that gives inconsistent output? Select 2.",
    [
      "Add one or two examples of the output you want",
      "Remove all the context so there is less to confuse the model",
      "State the required format and length explicitly",
      "Make the request shorter and less specific",
    ],
    "A,C",
    "Examples and explicit format and length constraints reduce ambiguity. Removing context or being less specific makes outputs vary more.",
  ],
  [
    1034, D1, "Adapt prompting strategies based on task type (analysis, research, drafting, brainstorming)", "Medium",
    "A team wants Claude to draft a customer email and also to analyse survey data for trends. How should the prompts differ?",
    [
      "They should be identical, since Claude adapts on its own",
      "The drafting prompt should specify audience, tone and length; the analysis prompt should specify the data, the questions to answer and the output structure",
      "Neither needs any instructions beyond the task name",
      "Both should simply say \"be accurate\"",
    ],
    "B",
    "Different task types need different guidance. Drafting is shaped by audience and tone, while analysis is shaped by the data, the questions and the structure of the answer.",
  ],

  // Output Evaluation and Validation (+7)
  [
    1035, D2, "Identify hallucinations, inconsistencies, and biases in responses", "Medium",
    "Claude's summary of a court case includes a quote attributed to a named judge. You cannot find the quote in the case documents you supplied. What is the right conclusion?",
    [
      "The quote is probably accurate because it is specific",
      "Treat the quote as unverified, remove it or verify it against the source, and check other specifics in the summary",
      "The documents must be incomplete, so keep the quote",
      "Ask Claude to repeat the quote more confidently",
    ],
    "B",
    "A specific quote that cannot be traced to the supplied source is a likely hallucination. Verify or remove it, and check the other details too.",
  ],
  [
    1036, D2, "Apply fact-checking and validation techniques", "Hard",
    "Which checks are appropriate before sharing a Claude-generated market analysis with a client? Select 2.",
    [
      "Confirm key statistics against the cited or original sources",
      "Check that the writing style sounds confident",
      "Confirm that the conclusions follow from the data it presents",
      "Confirm that the analysis is long enough",
    ],
    "A,C",
    "Validation means checking facts against sources and checking that the reasoning supports the conclusions. Tone and length say nothing about accuracy.",
  ],
  [
    1037, D2, "Evaluate Claude-generated outputs for accuracy and completeness", "Easy",
    "You asked Claude for a comparison of three vendors across price, support and security. The response covers price and support only. What should you do?",
    [
      "Use it as is because two of three is good enough",
      "Ask Claude to add the missing security comparison and review the addition",
      "Assume security is not important",
      "Replace the response with a different topic",
    ],
    "B",
    "Check output against the request. When something is missing, ask for it and review the new content rather than assuming it is covered.",
  ],
  [
    1038, D2, "Determine when human review or additional verification is required", "Medium",
    "Which Claude output most clearly requires human expert review before use?",
    [
      "A draft agenda for a team meeting",
      "A summary of a medical test result that will be shared with a patient",
      "A list of ideas for a team-building event",
      "A reworded version of an internal newsletter",
    ],
    "B",
    "Outputs that affect health, legal or financial outcomes carry high stakes and need review by a qualified person. Low-stakes drafts need lighter checks.",
  ],
  [
    1039, D2, "Edit, adapt, refine, and compare outputs for the intended audience", "Medium",
    "Claude produced a detailed technical proposal. The audience is a busy executive who will read for two minutes. What is the best next step?",
    [
      "Send the full document so nothing is missed",
      "Ask Claude for a one-page executive summary leading with the decision needed, cost and risks, and keep the detail as an appendix",
      "Remove all numbers",
      "Translate it into another language",
    ],
    "B",
    "Adapting output means shaping it for the reader: lead with the decision and the key facts, and keep detail available but out of the way.",
  ],
  [
    1040, D2, "Organize and curate information and select appropriate output formats (artifacts, inline, structured data)", "Easy",
    "A project lead wants Claude to produce a polished, reusable one-page project brief that they can keep editing in the conversation. Which output choice fits best?",
    [
      "An artifact, which holds a standalone document that can be refined over several turns",
      "A single sentence of inline text",
      "A long unformatted paragraph",
      "A poem about the project",
    ],
    "A",
    "Artifacts are suited to standalone, iterable documents. Short inline replies are better for quick answers.",
  ],
  [
    1041, D2, "Identify hallucinations, inconsistencies, and biases in responses", "Hard",
    "Claude is asked to rank candidate job titles by seniority and consistently puts titles associated with one gender lower. What should the team do?",
    [
      "Accept the ranking because it is machine-generated",
      "Flag it as potential bias, avoid relying on it, adjust the instructions and criteria, and have a person review",
      "Delete the titles from the list",
      "Run it again until the ranking looks fine to you",
    ],
    "B",
    "Systematic skew is a bias signal. Stop relying on the output, tighten the criteria and add human review rather than cherry-picking results.",
  ],

  // Product and Model Selection (+3)
  [
    1042, D3, "Align model selection with task requirements (cost, speed, quality)", "Medium",
    "A legal team needs Claude to analyse a complex contract for subtle conflicts between clauses. Quality matters far more than speed. Which choice fits best?",
    [
      "The fastest, lowest-cost model, since all models are equivalent",
      "A more capable model suited to complex reasoning, accepting higher cost and latency",
      "No model, because contracts cannot be analysed",
      "Whichever model finishes first",
    ],
    "B",
    "When the task needs deep reasoning and accuracy, choose the more capable model and accept the cost. Save fast, cheap models for simple, high-volume work.",
  ],
  [
    1043, D3, "Select appropriate Claude product features (Projects, research mode, chat, artifacts)", "Medium",
    "A team wants every member's chats about one client to share the same background documents and instructions. Which feature fits best?",
    [
      "A Project with shared knowledge and instructions",
      "Pasting the same documents into every new chat",
      "A different personal setup per person",
      "Deleting old chats regularly",
    ],
    "A",
    "Projects keep shared instructions and knowledge in one place, so conversations start from the same grounded context.",
  ],
  [
    1044, D3, "Understand and manage context limitations and memory considerations (when to restart, summarize, or persist)", "Hard",
    "Which practices help when a long conversation approaches its context limit? Select 2.",
    [
      "Summarise the decisions and key facts so far and continue in a fresh conversation",
      "Keep adding messages until it stops working",
      "Move stable background material into a Project so it does not have to be repeated",
      "Delete the first half of the conversation without noting what it contained",
    ],
    "A,C",
    "Summarising and persisting stable context in a Project preserves what matters. Letting the conversation overflow or discarding it blindly loses information.",
  ],

  // Workflow Integration and Solution Design (+5)
  [
    1045, D4, "Apply Claude to analyze requirements and use cases", "Easy",
    "A manager asks where Claude could help in the customer-onboarding process. What is the best first step?",
    [
      "Pick a tool and start using it everywhere",
      "List the onboarding steps, mark the repetitive or text-heavy ones, and choose one to pilot",
      "Wait until competitors adopt it",
      "Ask Claude to redesign the whole company",
    ],
    "B",
    "Start from the real process, find where Claude adds value and pilot a small piece first.",
  ],
  [
    1046, D4, "Integrate Claude into existing workflows to augment or redesign them", "Medium",
    "A support team already uses a ticket queue. How should Claude be added with the least disruption?",
    [
      "Replace the queue with a Claude chat",
      "Use Claude to draft suggested replies and summarise long tickets inside the existing process, with agents approving each reply",
      "Let Claude answer all tickets automatically with no oversight",
      "Ask customers to use Claude directly",
    ],
    "B",
    "Augmenting an existing workflow, with a person approving output, adds value without removing accountability.",
  ],
  [
    1047, D4, "Communicate Claude's value and limitations to stakeholders", "Medium",
    "A stakeholder asks whether Claude can be trusted to produce final client reports unaided. What is the most accurate answer?",
    [
      "Yes, it is always correct",
      "It can speed up drafting a lot, but figures and claims must be verified and a person should approve what goes to clients",
      "No, it should never be used for reports",
      "Only if the report is very short",
    ],
    "B",
    "A balanced message states the benefit and the controls: Claude accelerates drafting while people verify and approve.",
  ],
  [
    1048, D4, "Leverage Claude for research, planning, and process optimization", "Hard",
    "Which uses of Claude fit a research-and-planning task well? Select 2.",
    [
      "Synthesising themes across a set of interview notes you provide",
      "Making final budget approvals",
      "Drafting a phased project plan and listing assumptions to check",
      "Signing contracts on the company's behalf",
    ],
    "A,C",
    "Claude is well suited to synthesis and drafting plans for people to review. Approvals and signatures need accountable humans.",
  ],
  [
    1049, D4, "Use Claude to support solution design, development, and iteration", "Medium",
    "A team has a repetitive weekly reporting task that always follows the same steps and input format. How should it design the solution?",
    [
      "Use a reusable prompt template or Project instructions so the task runs the same way each week, with a person reviewing the output",
      "Write a new prompt from scratch every week",
      "Ask a different person to improvise each time",
      "Avoid Claude because the task is repetitive",
    ],
    "A",
    "Repetitive, structured work benefits from a reusable template that makes results consistent and fast, with review kept in the loop.",
  ],

  // Configuration and Knowledge Management (+3)
  [
    1050, D5, "Manage uploaded knowledge and connectors (e.g., Google Drive, Gmail)", "Medium",
    "A team connects Claude to a shared drive. What should they check before enabling the connection?",
    [
      "Nothing; connectors are always safe",
      "Which folders will be accessible, whether they contain sensitive data, and who has permission to use the connection",
      "Only that the drive is large",
      "That the folder names are short",
    ],
    "B",
    "Connectors expose data, so check scope, sensitivity and permissions first, in line with organisational policy.",
  ],
  [
    1051, D5, "Create effective system-level instructions", "Hard",
    "Which Project instruction is most useful for a team that needs consistent answers about an internal HR policy?",
    [
      "\"Answer HR questions.\"",
      "\"Answer only from the attached HR policy. If the policy does not cover the question, say so and suggest contacting HR. Quote the relevant section.\"",
      "\"Be creative with policy questions.\"",
      "\"Always agree with the employee.\"",
    ],
    "B",
    "Good instructions ground answers in the supplied source, define behaviour when it is silent and require citations.",
  ],
  [
    1052, D5, "Inform, maintain, and update Claude configurations, knowledge sources, and instructions", "Medium",
    "Users report that a Project's answers contradict each other. Two versions of the same policy document are in its knowledge. What is the best fix?",
    [
      "Keep both so Claude has more information",
      "Remove the outdated version, keep the current one and note the effective date in the instructions",
      "Tell users to ignore contradictions",
      "Add a third version",
    ],
    "B",
    "Conflicting sources produce conflicting answers. Keep one authoritative, current version.",
  ],

  // Governance, Risk, and Responsible Use (+5)
  [
    1053, D6, "Apply data sensitivity, regulatory, and privacy considerations", "Medium",
    "An analyst wants Claude's help drafting a letter to a specific patient and has the patient's record open. What is the most appropriate approach?",
    [
      "Paste the full record, including identifiers, into the chat",
      "Follow the organisation's policy: use an approved setup and remove or anonymise identifiers unless the policy allows the data to be used",
      "Paste the record and ask Claude to forget it",
      "Use a personal account to avoid the policy",
    ],
    "B",
    "Sensitive personal data is governed by policy and regulation. Use approved tools and minimise or anonymise identifiers.",
  ],
  [
    1054, D6, "Identify appropriate and inappropriate use cases", "Easy",
    "Which is an appropriate use of Claude in a marketing team?",
    [
      "Drafting social posts and headline options that a person reviews before publishing",
      "Publishing posts automatically with no review",
      "Generating fake customer testimonials",
      "Impersonating a real customer",
    ],
    "A",
    "Drafting with human review is appropriate. Fabricating testimonials or impersonating people is deceptive and inappropriate.",
  ],
  [
    1055, D6, "Follow organizational AI policies and governance standards", "Hard",
    "A team lead discovers that a colleague has been pasting confidential client contracts into an unapproved AI tool. What is the best response?",
    [
      "Ignore it because no harm is visible",
      "Report it through the proper channel so the incident can be assessed, and move the work to the approved setup",
      "Ask the colleague to delete their chat history and say nothing",
      "Share more contracts to compare tools",
    ],
    "B",
    "Policy breaches involving confidential data should be reported so risk can be assessed. Quiet deletion does not undo the exposure.",
  ],
  [
    1056, D6, "Understand the ethical implications of AI usage", "Medium",
    "Which practices support responsible use of AI in a team? Select 2.",
    [
      "Be transparent with stakeholders about where AI assisted the work",
      "Never tell anyone AI was used",
      "Keep a person accountable for decisions that affect people",
      "Let the model make all final decisions",
    ],
    "A,C",
    "Responsible use means transparency and keeping accountable human oversight for consequential decisions.",
  ],
  [
    1057, D6, "Identify appropriate and inappropriate use cases", "Medium",
    "A user asks Claude to write a convincing message that pretends to be the company's CEO asking staff for gift cards. How should this be handled?",
    [
      "Write it; it is just a draft",
      "Decline: it would be used to deceive people, and it should be reported to the security team if it is a real request",
      "Write it but make it shorter",
      "Write it and add a disclaimer at the end",
    ],
    "B",
    "Impersonation to defraud is clearly inappropriate. Decline and escalate suspicious requests.",
  ],

  // Troubleshooting and Optimization (+3)
  [
    1058, D7, "Identify, diagnose, and resolve issues with underperforming prompts or poor outputs", "Hard",
    "Claude's summaries of long reports keep missing the key risks. Which diagnosis and fix are most sensible?",
    [
      "The model cannot summarise; stop using it",
      "The prompt does not say what matters; specify the audience and ask explicitly for risks, with a required section for them",
      "Make the report shorter by deleting the middle",
      "Ask Claude to try harder",
    ],
    "B",
    "When key content is missed, the instruction usually does not define what matters. Make the requirement explicit and structured.",
  ],
  [
    1059, D7, "Adjust approach based on feedback and results", "Easy",
    "A reviewer says Claude's drafts are too long. What is the best adjustment?",
    [
      "Ignore the feedback",
      "Add a length limit and an example of the desired length to the prompt, then compare the next draft",
      "Ask for a longer draft",
      "Switch to another tool",
    ],
    "B",
    "Turn feedback into explicit constraints and check the result against it.",
  ],
  [
    1060, D7, "Optimize workflows for efficiency and effectiveness", "Medium",
    "A team's Claude workflow works but takes many back-and-forth rounds. Which changes would most reduce the rounds? Select 2.",
    [
      "Put the context, constraints and desired format in the first prompt or Project instructions",
      "Remove all instructions to keep it simple",
      "Save the best-performing prompt as a template for reuse",
      "Ask a different person each time",
    ],
    "A,C",
    "Front-loading context and reusing proven templates cut the number of rounds needed.",
  ],
];

export const ASSOCIATE_BANK: BankQuestion[] = SEEDS.map(
  ([id, domain, subSkill, difficulty, question, opts, answer, explanation]) => ({
    id,
    track: "associate",
    domain,
    subSkill,
    difficulty,
    question,
    options: opts.map((text, i) => ({ label: (["A", "B", "C", "D"] as OptionLabel[])[i], text })),
    answer,
    explanation,
    guideVersion: "v1.0",
  })
);
