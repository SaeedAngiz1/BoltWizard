/**
 * Coder agent — generates, tests, and iterates a single file until it passes the
 * Guardian (or the human, or maxIterations). Bounded loop, live store updates.
 *
 *   (a) generate  → coder (or supervisor on escalation) writes the full file
 *   (b) test     → `node --check` for .js/.mjs/.cjs, else skip
 *   (c) guardian → reviewFile(); med/high findings pause for human approval,
 *                  negatives are seeded into the next attempt. Escalation at
 *                  iteration >= 2 OR a high finding switches the role to supervisor.
 */
import { chat } from './chat';
import { reviewFile } from './guardian';
import { maybeEscalate } from './escalation';
import { awaitApproval } from './gate';
import { systemCoderPrompt, summarizeFindings, hasBlockingFinding } from './analysis';
import { parseActions } from '../llm/tools';
import { safePath } from '../safePath';
import type { ChatMessage } from '../llm/client';
import type { RoleKey, PIFTask } from './types';
import * as wc from '../webcontainer';
import { useStore } from '../../store';

/** Extract the file content from coder output: prefer a boltAction file block,
 * else fall back to the first fenced code block, else the whole text. */
function extractFileContent(text: string, fallbackPath: string): string {
  const actions = parseActions(text);
  const fileAction = actions.find((a) => a.kind === 'file');
  if (fileAction && fileAction.kind === 'file' && fileAction.content.trim()) {
    return fileAction.content;
  }
  const fence = text.match(/```(?:[a-zA-Z0-9]+)?\s*\n([\s\S]*?)```/);
  if (fence && fence[1].trim()) return fence[1];
  void fallbackPath;
  return text.trim();
}

function dirOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i === -1 ? '.' : path.slice(0, i);
}

const CHECKABLE = /\.(mjs|cjs|js)$/;

/** Run `node --check` for JS files; everything else is skipped (static files). */
async function runStaticCheck(task: PIFTask): Promise<{ exit: number; output: string }> {
  // Confine the model-supplied path to the project root (see safePath).
  const path = safePath(task.path) ?? task.path;
  let output = '';
  if (!CHECKABLE.test(path)) {
    output = 'no static check (non-JS file)';
    useStore.getState().appendTaskLog(task.id, { ts: Date.now(), kind: 'test', text: output });
    return { exit: 0, output };
  }
  const exit = await wc.run('node', ['--check', path], {
    onData: (chunk) => {
      output += chunk;
    },
  });
  useStore.getState().appendTaskLog(task.id, {
    ts: Date.now(),
    kind: 'test',
    text: exit === 0 ? `node --check OK` : `node --check FAILED (${exit}):\n${output}`,
  });
  return { exit, output };
}

interface GenerateOpts {
  role?: RoleKey; // override role (supervisor) after escalation
  extraInstruction?: string; // injected by modifyTask
}

/** One generate pass: build the prompt, stream into a buffer, write the file. */
async function generate(task: PIFTask, opts: GenerateOpts = {}): Promise<string> {
  const { pif } = useStore.getState();
  if (!pif) throw new Error('No PIF loaded');

  // Confine the model-supplied path to the project root; reject escapes.
  const path = safePath(task.path);
  if (!path) throw new Error(`Unsafe file path rejected: "${task.path}"`);

  useStore.getState().setTaskStatus(task.id, 'generating');

  const messages: ChatMessage[] = [
    { role: 'system', content: systemCoderPrompt(pif, task) },
  ];

  // Seed existing file content if present (iteration context).
  try {
    const existing = await wc.readFile(path);
    if (existing.trim()) {
      messages.push({
        role: 'user',
        content: `Current contents of ${path}:\n\`\`\`\n${existing}\n\`\`\`\nRewrite the FULL file with the necessary fixes.`,
      });
    }
  } catch {
    /* file does not exist yet — nothing to seed */
  }

  if (opts.extraInstruction) {
    messages.push({
      role: 'user',
      content: `Additional instruction from the operator:\n${opts.extraInstruction}`,
    });
  }

  messages.push({
    role: 'user',
    content: `Implement ${task.path} now. Emit the complete file in a single <boltAction type="file" path="${task.path}"> block.`,
  });

  let buffer = '';
  const role: RoleKey = opts.role ?? 'coder';
  const full = await chat(role, messages, (delta) => {
    buffer += delta;
  });

  const content = extractFileContent(full, path);
  await wc.mkdirp(dirOf(path));
  await wc.writeFile(path, content);
  useStore.getState().openTab(path);
  useStore.getState().appendTaskLog(task.id, {
    ts: Date.now(),
    kind: 'generate',
    text: `Generated ${path} (${content.length} chars) via ${role}`,
  });
  return content;
}

/** The bounded generate → test → guardian loop for one task. */
export async function runFileTask(taskId: string): Promise<void> {
  const { tasks, maxIterations } = useStore.getState();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;

  let current: PIFTask = { ...task, maxIterations };
  let useSupervisor = false;
  let extraInstruction: string | undefined;

  useStore.getState().upsertTask(current);

  // Cap iterations at the task's configured max (defaults to store value).
  const cap = Math.max(1, current.maxIterations || maxIterations);

  for (let i = current.iteration; i < cap; i++) {
    current = { ...current, status: 'generating', iteration: i + 1 };
    useStore.getState().upsertTask(current);

    // (a) generate
    await generate(current, {
      role: useSupervisor ? 'supervisor' : 'coder',
      extraInstruction,
    });
    extraInstruction = undefined; // consumed

    // (b) test
    current = { ...useStore.getState().tasks.find((t) => t.id === taskId)! };
    useStore.getState().setTaskStatus(current.id, 'testing');
    const check = await runStaticCheck(current);

    // (c) guardian
    current = { ...useStore.getState().tasks.find((t) => t.id === taskId)! };
    useStore.getState().setTaskStatus(current.id, 'fixing');
    const findings = await reviewFile(current);

    // No blocking findings (and check passed) → validated.
    if (!hasBlockingFinding(findings) && check.exit === 0) {
      useStore.getState().appendTaskLog(current.id, {
        ts: Date.now(),
        kind: 'guardian',
        text: 'Guardian: file sound. Validated.',
      });
      useStore.getState().setTaskStatus(current.id, 'validated', 'Passed guardian review.');
      useStore.getState().openTab(current.path);
      return;
    }

    const summary = summarizeFindings(findings);
    useStore.getState().appendTaskLog(current.id, {
      ts: Date.now(),
      kind: 'guardian',
      text: findings.length ? `Guardian findings:\n${summary}` : `Static check failed (exit ${check.exit}).`,
    });

    // Escalation check (iteration >= 2 OR a high finding).
    const escalated = await maybeEscalate(current, findings);
    if (escalated) {
      useSupervisor = true;
      useStore.getState().appendTaskLog(current.id, {
        ts: Date.now(),
        kind: 'info',
        text: 'Escalated to supervisor model for the next attempt.',
      });
    }

    // Pause for human iteration approval.
    useStore.getState().setTaskStatus(current.id, 'awaiting-approval', summary);
    const approved = await awaitApproval({
      kind: 'iteration',
      taskId: current.id,
      title: `Review ${current.path}`,
      detail: summary,
      guardianFindings: findings,
    });

    if (approved) {
      // Human accepts the current iteration → validated.
      useStore.getState().setTaskStatus(current.id, 'validated', summary);
      useStore.getState().openTab(current.path);
      return;
    }

    // Rejected / modify → loop again; the new negatives + findings are already
    // seeded into the generate prompt via formatNegativeConstraints(task.path).
    useStore.getState().appendTaskLog(current.id, {
      ts: Date.now(),
      kind: 'fix',
      text: 'Human requested changes. Regenerating with guardian feedback.',
    });
  }

  // Out of iterations.
  useStore.getState().setTaskStatus(taskId, 'failed', 'Exceeded max iterations without passing.');
  useStore.getState().appendTaskLog(taskId, {
    ts: Date.now(),
    kind: 'error',
    text: `Stopped after ${cap} iterations. Waiting for human guidance.`,
  });
  useStore.getState().pushToast('error', `Task ${task.path} failed after ${cap} iterations.`);
}

/** Force a fresh generate from scratch (reset iteration counter). */
export async function regenerateTask(taskId: string): Promise<void> {
  const { tasks, maxIterations } = useStore.getState();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;
  const reset: PIFTask = {
    ...task,
    iteration: 0,
    status: 'pending',
    maxIterations: task.maxIterations || maxIterations,
  };
  useStore.getState().upsertTask(reset);
  useStore.getState().appendTaskLog(taskId, {
    ts: Date.now(),
    kind: 'info',
    text: 'Regeneration requested.',
  });
  await runFileTask(taskId);
}

/** Inject an operator note and regenerate once. */
export async function modifyTask(taskId: string, note: string): Promise<void> {
  const { tasks } = useStore.getState();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;
  useStore.getState().appendTaskLog(taskId, {
    ts: Date.now(),
    kind: 'info',
    text: `Operator note: ${note}`,
  });

  const { pif } = useStore.getState();
  if (!pif) return;

  // One-shot regenerate using the note as an extra instruction.
  useStore.getState().setTaskStatus(taskId, 'generating');
  await generate(task, { extraInstruction: note });
  const check = await runStaticCheck(task);
  const findings = await reviewFile(task);
  const summary = summarizeFindings(findings);
  if (!hasBlockingFinding(findings) && check.exit === 0) {
    useStore.getState().setTaskStatus(taskId, 'validated', summary);
    useStore.getState().openTab(task.path);
  } else {
    useStore.getState().setTaskStatus(taskId, 'awaiting-approval', summary);
  }
}

/** Manually mark a task validated, skipping the guardian entirely. */
export async function approveTask(taskId: string): Promise<void> {
  const { tasks } = useStore.getState();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;
  useStore.getState().setTaskStatus(taskId, 'approved', 'Manually approved by operator.');
  useStore.getState().openTab(task.path);
  useStore.getState().appendTaskLog(taskId, {
    ts: Date.now(),
    kind: 'info',
    text: 'Task manually approved (guardian skipped).',
  });
}
