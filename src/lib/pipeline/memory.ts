/**
 * Negative constraint memory (structured, not retraining).
 *
 * When the Guardian (or user) flags an error, it is recorded here as a negative
 * constraint. Subsequent coder prompts are seeded with the accumulated list so
 * the same category of mistake does not recur. Persists to localStorage.
 */
import type { NegativeConstraint } from './types';

const KEY = 'boltglm.negatives';
let cache: NegativeConstraint[] | null = null;

function load(): NegativeConstraint[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) || '[]') as NegativeConstraint[];
  } catch {
    cache = [];
  }
  return cache;
}

function persist(): void {
  if (cache) localStorage.setItem(KEY, JSON.stringify(cache));
}

export function addNegativeConstraint(c: Omit<NegativeConstraint, 'id' | 'ts'>): NegativeConstraint {
  const full: NegativeConstraint = {
    ...c,
    id: `nc-${Date.now().toString(36)}`,
    ts: Date.now(),
  };
  const list = load();
  list.push(full);
  cache = list;
  persist();
  return full;
}

export function getNegativeConstraints(taskPath?: string): NegativeConstraint[] {
  const list = load();
  return taskPath ? list.filter((c) => !c.taskPath || c.taskPath === taskPath) : list;
}

/** Format the constraints for injection into a coder prompt. Empty string if none. */
export function formatNegativeConstraints(taskPath?: string): string {
  const list = getNegativeConstraints(taskPath);
  if (!list.length) return '';
  const body = list.map((c, i) => `${i + 1}. (${c.category}) ${c.description}`).join('\n');
  return `\n\n[NEGATIVE CONSTRAINTS — do NOT repeat these verified mistakes]\n${body}`;
}

export function clearNegativeConstraints(): void {
  cache = [];
  persist();
}

export function negativeCount(): number {
  return load().length;
}
