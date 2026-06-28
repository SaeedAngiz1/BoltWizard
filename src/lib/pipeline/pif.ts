/**
 * PIF authoring (referent). Builds the Project Instruction File as strict JSON
 * from the brainstorm conversation, coerces the shape to the PIF contract, and
 * returns it. Does NOT touch store state — pipeline.generatePlan owns that.
 */
import { chatJSON } from './chat';
import { systemPIFPrompt } from './analysis';
import { turnsFromStoreMessages } from './analysis';
import type { ChatMessage } from '../llm/client';
import type { PIF } from './types';
import { useStore } from '../../store';

function str(x: unknown, fallback = ''): string {
  return typeof x === 'string' ? x : fallback;
}
function strArr(x: unknown): string[] {
  return Array.isArray(x) ? x.map((v) => str(v)).filter(Boolean) : [];
}

/** Coerce an arbitrary parsed object into a valid PIF, filling defaults. */
export function coercePIF(raw: unknown): PIF {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const files = Array.isArray(obj.files)
    ? obj.files
        .map((f) => (f ?? {}) as Record<string, unknown>)
        .map((f) => ({ path: str(f.path), purpose: str(f.purpose) }))
        .filter((f) => f.path)
    : [];
  const tasksRaw = Array.isArray(obj.tasks)
    ? obj.tasks
        .map((t) => (t ?? {}) as Record<string, unknown>)
        .map((t) => ({
          title: str(t.title, str(t.path)),
          path: str(t.path),
          description: str(t.description),
        }))
        .filter((t) => t.path)
    : [];

  // Ensure every file has at least one task and vice-versa.
  const taskPaths = new Set(tasksRaw.map((t) => t.path));
  for (const f of files) {
    if (!taskPaths.has(f.path)) {
      tasksRaw.push({ title: f.path, path: f.path, description: f.purpose });
    }
  }

  return {
    goal: str(obj.goal, 'Untitled project'),
    stack: strArr(obj.stack),
    constraints: strArr(obj.constraints),
    files,
    acceptanceCriteria: strArr(obj.acceptanceCriteria).length
      ? strArr(obj.acceptanceCriteria)
      : ['Project builds and runs without errors.'],
    tasks: tasksRaw,
  };
}

/**
 * Ask the referent to produce the PIF from the current brainstorm conversation.
 * Throws if the model fails to return parseable JSON (caller handles).
 */
export async function buildPIF(): Promise<PIF> {
  const { messages } = useStore.getState();
  const system = systemPIFPrompt();
  const convo = turnsFromStoreMessages(messages.filter((m) => m.role !== 'system'));
  const turns: ChatMessage[] = [
    { role: 'system', content: system },
    ...convo,
    {
      role: 'user',
      content:
        'Author the Project Instruction File now as strict JSON. Remember: one task per file, ordered by dependency.',
    },
  ];
  const raw = await chatJSON<unknown>('referent', turns);
  const pif = coercePIF(raw);
  if (!pif.files.length) {
    throw new Error('Referent returned an empty PIF (no files). Refine the goal and try again.');
  }
  return pif;
}
