import type { BankQuestion } from "@/types/quiz";
import { modules } from "@/lib/quiz-data";
import { DEVELOPER_EXPLANATIONS } from "./explanations-developer";

/**
 * Maps the legacy module/section tags onto the official Developer sub-skills (guide v1.0).
 * Key: `${moduleId}|${section}`. Modules map 1:1 to domains by title.
 */
const SUB_SKILL: Record<string, string> = {};
const add = (moduleId: number, skill: string, sections: string[]) =>
  sections.forEach((s) => (SUB_SKILL[`${moduleId}|${s}`] = skill));

// 1 · Agents and Workflows
add(1, "Agent Architecture", ["Agent Design", "Subagent Delegation", "Human in the Loop", "Autonomy Patterns"]);
add(1, "Agent Construction with Claude", ["Tool Execution", "Stop Reasons", "Budget Controls", "Retry Limits"]);
add(1, "Agent Patterns and Frameworks", ["Memory Scope", "Parallel Tasks", "Error Recovery", "Agent Handoff"]);
// 2 · Applications and Integration
add(2, "Claude API Mechanics", ["API Security", "Rate Limits", "Streaming", "Batch API"]);
add(2, "Software Engineering Foundations", ["Error Codes", "Timeouts", "SDK vs REST", "Async Patterns", "Idempotency"]);
add(2, "Claude Application Design", ["Multi-turn State"]);
add(2, "Configuration Management", ["Configuration", "Prompt Versioning"]);
// 3 · Claude Code
add(3, "Claude Code Operation", [
  "Project Instructions", "Permission Modes", "Slash Commands", "Session Context", "Skills", "Hooks",
  "MCP Integration", "Git Workflow", "IDE Integration", "Headless / CI Mode", "Task Management", "Security",
]);
// 4 · Eval, Testing, and Debugging
add(4, "Debugging and Error Handling", [
  "Success Criteria", "Test Set Design", "LLM-as-Judge", "Regression Testing", "Tracing", "Debugging",
  "A/B Evaluation", "Human Evaluation", "Safety Evals", "Cost/Quality", "Tool Debugging", "Production Monitoring",
]);
// 5 · Model Selection and Optimization
add(5, "Model Selection and Tradeoffs", ["Model Tiers", "Adaptive Routing", "Latency Optimisation"]);
add(5, "Cost and Token Management", ["Prompt Caching", "Batch API", "Token Budgeting", "Cost Estimation", "Cache Economics"]);
add(5, "LLM Fundamentals", ["Context Management", "Extended Thinking", "Temperature"]);
add(5, "Technical Fundamentals", ["Output Limits"]);
// 6 · Prompt and Context Engineering
add(6, "Prompt Engineering", [
  "System Prompt", "Few-Shot Examples", "Chain of Thought", "XML Tags", "Role Prompting",
  "Instruction Order", "Negative Instructions", "Iterative Refinement",
]);
add(6, "Context Engineering", ["Context Management", "Long Documents"]);
add(6, "Output Handling", ["Output Formatting", "Prompt Testing"]);
// 7 · Security and Safety
add(7, "AI Application Security", [
  "Prompt Injection", "Trust Levels", "PII Handling", "Multi-tenant Isolation",
  "System Prompt Confidentiality", "Jailbreak Resistance",
]);
add(7, "Guardrails and Safe Deployment", ["Least Privilege", "Audit Logging", "Content Guardrails", "Safe Messaging"]);
add(7, "Claude Hooks", ["Approval Gates"]);
add(7, "Identity, Secrets, and Key Management", ["Credential Management"]);
// 8 · Tools and MCPs
add(8, "Tool Implementation", [
  "Tool Schema Design", "Tool Errors", "Parallel Tool Calls", "Tool Output Size", "Tool Versioning", "Tool Disambiguation",
]);
add(8, "Agentic Customization", ["Tool Selection"]);
add(8, "MCP Server Development", [
  "MCP Architecture", "Resources vs Tools", "MCP Authentication", "Building MCP Servers", "MCP Transports",
]);

export const DEVELOPER_BANK: BankQuestion[] = modules.flatMap((m) =>
  m.questions.map((q) => {
    const subSkill = SUB_SKILL[`${m.id}|${q.section}`];
    if (!subSkill) throw new Error(`No sub-skill mapping for module ${m.id} section "${q.section}"`);
    return {
      id: q.id,
      track: "developer" as const,
      domain: m.title,
      subSkill,
      difficulty: q.difficulty,
      question: q.question,
      options: q.options,
      answer: q.answer,
      explanation: DEVELOPER_EXPLANATIONS[q.id],
      guideVersion: "v1.0",
    };
  })
);
