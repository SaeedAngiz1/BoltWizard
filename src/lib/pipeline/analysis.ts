/**
 * Shared prompt + message helpers for the supervised pipeline.
 *
 * Keeps the per-role prompt builders in one place so pif.ts, coder.ts and
 * guardian.ts read as plain orchestration. Pure functions — no store access.
 */
import type { ChatMessage } from '../llm/client';
import type { PIF, PIFTask, GuardianFinding } from './types';
import { formatNegativeConstraints } from './memory';

/** Render the PIF as a compact reference block for downstream roles. */
export function renderPIF(pif: PIF): string {
  const files = pif.files.map((f) => `- ${f.path} — ${f.purpose}`).join('\n');
  const tasks = pif.tasks.map((t) => `- ${t.title} (${t.path}): ${t.description}`).join('\n');
  const acc = pif.acceptanceCriteria.map((a) => `- ${a}`).join('\n');
  const constraints = pif.constraints.map((c) => `- ${c}`).join('\n');
  return [
    `GOAL: ${pif.goal}`,
    `STACK: ${pif.stack.join(', ')}`,
    constraints ? `CONSTRAINTS:\n${constraints}` : '',
    `FILES:\n${files}`,
    acc ? `ACCEPTANCE CRITERIA:\n${acc}` : '',
    `TASKS:\n${tasks}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** Convert the chat history (ChatEntry[]) into ChatMessage[] for a role call. */
export function turnsFromStoreMessages(
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
): ChatMessage[] {
  return messages
    .filter((m) => m.role !== 'system' || m.content)
    .map((m) => ({ role: m.role, content: m.content }));
}

/** Referent system prompt for the brainstorm phase — asks questions, no code. */
export function systemReferentPrompt(): string {
  return `You are the Referent, the senior product/architecture partner in a supervised multi-agent pipeline. Your job is to think WITH the user before any code is written.

Behaviour:
- Ask 2-4 sharp, specific clarifying questions per turn (scope, audience, data, edge cases).
- Propose a concrete architecture + stack and explain WHY in one or two lines.
- Surface non-obvious constraints, risks, and the smallest viable milestone set.
- Do NOT write code. Do NOT emit boltAction blocks. You are planning only.
- When the idea is clear enough to build, say exactly: "READY: I can generate the plan." and stop.
Be concise, opinionated, and human. No filler.`;
}

/** Referent system prompt for PIF authoring — strict JSON only. */
export function systemPIFPrompt(): string {
  return `You are the Referent producing the Project Instruction File (PIF) for the Coder and Guardian agents to follow. Output STRICT JSON ONLY — no prose, no fences.

JSON shape:
{
  "goal": "one sentence description of what is being built",
  "stack": ["vite", "react", "typescript", ...],
  "constraints": ["must ...", "must not ..."],
  "files": [{ "path": "src/App.tsx", "purpose": "..." }],
  "acceptanceCriteria": ["observable test of done-ness"],
  "tasks": [{ "title": "...", "path": "src/App.tsx", "description": "what to implement in this single file" }]
}

Rules:
- One task per file; tasks must cover every file in "files".
- Tasks are ordered so dependencies come first (config → entry → components → features).
- Descriptions are specific enough that a coder can implement the file from them alone.
- Keep the project minimal but complete.`;
}

/** Coder system prompt for generating one file. */
export function systemCoderPrompt(pif: PIF, task: PIFTask): string {
  const existingNote = `Existing file content (if any) is provided below as context — preserve what is correct, fix what is broken.`;
  return `You are the Coder in a supervised pipeline. You implement ONE file per invocation against the Project Instruction File.

PROJECT INSTRUCTION FILE:
${renderPIF(pif)}

YOUR TASK:
- File: ${task.path}
- Title: ${task.title}
- Description: ${task.description}

Rules:
- Emit the COMPLETE file contents inside a single action block:
  <boltAction type="file" path="${task.path}">
  ...full file...
  </boltAction>
- Never emit diffs or "..." placeholders — always the full file.
- Write production-quality, typed code matching the stack.
- ${existingNote}
If NEGATIVE CONSTRAINTS are listed, they are verified mistakes — do not repeat them.${formatNegativeConstraints(
    task.path,
  )}`;
}

/** Guardian system prompt for reviewing one file. */
export function systemGuardianPrompt(pif: PIF, task: PIFTask, content: string): string {
  return `You are the Guardian in a supervised pipeline. You review a single file against the Project Instruction File for CONCEPTUAL and ARCHITECTURAL correctness — not just syntax.

PROJECT INSTRUCTION FILE:
${renderPIF(pif)}

FILE UNDER REVIEW: ${task.path} (${task.title})
TASK DESCRIPTION: ${task.description}

FILE CONTENTS:
\`\`\`
${content}
\`\`\`

Report issues such as: wrong architectural layer, deviation from the spec/PIF, logic errors, missing acceptance-criteria coverage, unsafe patterns, or files that won't compile/run. Ignore cosmetic style unless it breaks correctness.

Respond with STRICT JSON ONLY: an array of findings. Empty array [] if the file is sound.
Each finding: { "severity": "low" | "med" | "high", "category": "string", "message": "string", "file": "${task.path}", "recommendation": "string" }`;
}

/** Guardian system prompt for the final whole-project review. */
export function systemGuardianProjectPrompt(pif: PIF, files: { path: string; content: string }[]): string {
  const dump = files
    .map((f) => `=== ${f.path} ===\n\`\`\`\n${f.content.slice(0, 8000)}\n\`\`\``)
    .join('\n\n');
  return `You are the Guardian performing a final holistic review of the completed project against the Project Instruction File.

PROJECT INSTRUCTION FILE:
${renderPIF(pif)}

PROJECT FILES:
${dump}

Look for cross-file integration issues, spec deviations, missing acceptance-criteria coverage, and anything that would prevent the project from running. Respond with STRICT JSON ONLY: an array of findings (same shape). Empty array [] if the project is sound.`;
}

/** Summarize a list of findings into a short human-readable note. */
export function summarizeFindings(findings: GuardianFinding[]): string {
  if (!findings.length) return 'No issues found.';
  return findings
    .map((f) => `[${f.severity.toUpperCase()}] ${f.category}: ${f.message}${f.recommendation ? ` → ${f.recommendation}` : ''}`)
    .join('\n');
}

/** True if any finding is medium or high severity. */
export function hasBlockingFinding(findings: GuardianFinding[]): boolean {
  return findings.some((f) => f.severity === 'med' || f.severity === 'high');
}

/** True if any finding is high severity. */
export function hasHighFinding(findings: GuardianFinding[]): boolean {
  return findings.some((f) => f.severity === 'high');
}
