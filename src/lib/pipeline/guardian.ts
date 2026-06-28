/**
 * Guardian agent — reviews each file iteration against the PIF, and performs a
 * final holistic project review. Reports findings as structured GuardianFinding[]
 * and records medium/high issues as negative constraints so the coder never
 * repeats them. Accumulates findings into the store.
 */
import { chatJSON } from './chat';
import { systemGuardianPrompt, systemGuardianProjectPrompt } from './analysis';
import * as wc from '../webcontainer';
import { addNegativeConstraint, getNegativeConstraints } from './memory';
import { useStore } from '../../store';
import type { PIFTask, GuardianFinding } from './types';

function parseFindings(raw: unknown): GuardianFinding[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((f) => (f ?? {}) as Record<string, unknown>)
    .map((f) => ({
      severity: (f.severity === 'high' || f.severity === 'med' || f.severity === 'low'
        ? f.severity
        : 'low') as GuardianFinding['severity'],
      category: typeof f.category === 'string' ? f.category : 'general',
      message: typeof f.message === 'string' ? f.message : '',
      file: typeof f.file === 'string' ? f.file : undefined,
      recommendation:
        typeof f.recommendation === 'string' && f.recommendation ? f.recommendation : undefined,
    }))
    .filter((f) => f.message);
}

/** Review a single file iteration. Returns the NEW findings for this pass. */
export async function reviewFile(task: PIFTask): Promise<GuardianFinding[]> {
  const { pif } = useStore.getState();
  if (!pif) return [];

  let content = '';
  try {
    content = await wc.readFile(task.path);
  } catch {
    content = ''; // file may not exist yet on the first broken attempt
  }

  const raw = await chatJSON<unknown>('guardian', [
    { role: 'system', content: systemGuardianPrompt(pif, task, content) },
    { role: 'user', content: `Review the file at ${task.path}.` },
  ]);
  const findings = parseFindings(raw);

  // Record med/high findings as negative constraints so the coder self-corrects.
  for (const f of findings) {
    if (f.severity === 'med' || f.severity === 'high') {
      addNegativeConstraint({
        category: f.category,
        description: f.message + (f.recommendation ? ` (Fix: ${f.recommendation})` : ''),
        taskPath: task.path,
      });
    }
  }

  // Merge into the accumulated findings in the store.
  const { findings: prior } = useStore.getState();
  const merged = [...prior, ...findings];
  useStore.getState().setFindings(merged);
  useStore.getState().setNegatives(getNegativeConstraints());

  return findings;
}

/** Final holistic review across every file in the PIF. Returns all findings. */
export async function reviewProject(): Promise<GuardianFinding[]> {
  const { pif, findings } = useStore.getState();
  if (!pif) return findings;

  const files: { path: string; content: string }[] = [];
  for (const f of pif.files) {
    try {
      const content = await wc.readFile(f.path);
      files.push({ path: f.path, content });
    } catch {
      files.push({ path: f.path, content: '[file not found]' });
    }
  }

  const raw = await chatJSON<unknown>('guardian', [
    { role: 'system', content: systemGuardianProjectPrompt(pif, files) },
    { role: 'user', content: 'Perform the final holistic review.' },
  ]);
  const fresh = parseFindings(raw);

  for (const f of fresh) {
    if (f.severity === 'med' || f.severity === 'high') {
      addNegativeConstraint({
        category: f.category,
        description: f.message + (f.recommendation ? ` (Fix: ${f.recommendation})` : ''),
      });
    }
  }

  const merged = [...findings, ...fresh];
  useStore.getState().setFindings(merged);
  useStore.getState().setNegatives(getNegativeConstraints());
  return merged;
}
