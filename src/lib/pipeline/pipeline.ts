/**
 * Supervised multi-agent pipeline orchestrator (Presence/Eidolon style).
 *
 * This is the ONLY module the UI imports. It wires the referent (brainstorm +
 * PIF), coder (file-by-file generation), and guardian (per-file + final review)
 * roles together under human approval gates.
 *
 * Phase flow:
 *   idle → brainstorm → plan-review → building → guardian-review → done
 *                                       (iteration-review gates per file)
 *
 * Every long-running function is async and updates the store as it progresses so
 * the UI reflects live state. Loops are bounded by maxIterations.
 */
import { chat } from './chat';
import { buildPIF } from './pif';
import {
  runFileTask as runFileTaskRaw,
  regenerateTask as regenerateTaskRaw,
  modifyTask as modifyTaskRaw,
  approveTask as approveTaskRaw,
} from './coder';
import { reviewProject } from './guardian';
import { awaitApproval } from './gate';
import { systemReferentPrompt, turnsFromStoreMessages } from './analysis';
import { resetResources } from './resources';
import { clearNegativeConstraints, getNegativeConstraints } from './memory';
import type { ChatMessage } from '../llm/client';
import type { PIFTask } from './types';
import { useStore } from '../../store';

/** Open the panel and begin a brainstorm with the referent about `idea`. */
export async function startBrainstorm(idea: string): Promise<void> {
  const store = useStore.getState();
  store.setPipelineOpen(true);
  store.setPhase('brainstorm');
  store.addMessage('user', idea);

  const assistantId = store.addMessage('assistant', '');
  const messages: ChatMessage[] = [
    { role: 'system', content: systemReferentPrompt() },
    { role: 'user', content: idea },
  ];
  await chat('referent', messages, (delta) => {
    useStore.getState().appendToMessage(assistantId, delta);
  });
}

/** Continue the brainstorm: stream another referent reply. */
export async function continueBrainstorm(text: string): Promise<void> {
  const store = useStore.getState();
  store.addMessage('user', text);
  const assistantId = store.addMessage('assistant', '');

  const convo = turnsFromStoreMessages(
    useStore.getState().messages.filter((m) => m.role !== 'system'),
  );
  const messages: ChatMessage[] = [
    { role: 'system', content: systemReferentPrompt() },
    ...convo,
  ];
  await chat('referent', messages, (delta) => {
    useStore.getState().appendToMessage(assistantId, delta);
  });
}

/**
 * Referent builds the PIF → set phase to plan-review → set pif → await human
 * approval. If approved, run the pipeline; otherwise drop back to brainstorm.
 */
export async function generatePlan(): Promise<void> {
  const store = useStore.getState();
  store.setPhase('plan-review');

  let pif;
  try {
    pif = await buildPIF();
  } catch (e) {
    store.setPhase('error');
    store.pushToast('error', `PIF generation failed: ${(e as Error).message}`);
    store.setPhase('brainstorm');
    return;
  }

  store.setPif(pif);

  const fileSummary = pif.files.map((f) => `• ${f.path}`).join('\n');
  const approved = await awaitApproval({
    kind: 'plan',
    title: 'Approve Project Instruction File?',
    detail: `Goal: ${pif.goal}\n\nFiles:\n${fileSummary}`,
    payload: pif,
  });

  if (approved) {
    await runPipeline();
  } else {
    store.setPhase('brainstorm');
    store.pushToast('info', 'Plan rejected. Refine the goal and regenerate.');
  }
}

/** Build the task list from the PIF and run each file task in order. */
export async function runPipeline(): Promise<void> {
  const store = useStore.getState();
  const { pif } = store;
  if (!pif) {
    store.pushToast('error', 'No plan to run. Generate a PIF first.');
    return;
  }

  // Build PIFTask[] from the PIF.
  const max = useStore.getState().maxIterations;
  const tasks: PIFTask[] = pif.tasks.map((t, i) => ({
    id: `task-${i + 1}-${t.path.replace(/[^\w.-]+/g, '_')}`,
    title: t.title,
    path: t.path,
    description: t.description,
    status: 'pending',
    iteration: 0,
    maxIterations: max,
    log: [],
  }));
  store.setTasks(tasks);
  store.setPhase('building');

  try {
    for (const task of tasks) {
      // Re-read the freshest task object before running (status may have been
      // mutated externally between runs).
      const live = useStore.getState().tasks.find((t) => t.id === task.id) ?? task;
      if (live.status === 'validated' || live.status === 'approved') continue;
      await runFileTaskRaw(live.id);
    }

    // Final holistic guardian review.
    store.setPhase('guardian-review');
    await runGuardianReview();
    useStore.getState().setPhase('done');
    useStore.getState().pushToast('success', 'Pipeline complete.');
  } catch (e) {
    useStore.getState().setPhase('error');
    useStore.getState().pushToast('error', `Pipeline error: ${(e as Error).message}`);
  }
}

/** Run a single file task (exposed for per-task UI controls). */
export async function runFileTask(taskId: string): Promise<void> {
  await runFileTaskRaw(taskId);
}

/** Force-regenerate a task from scratch. */
export async function regenerateTask(taskId: string): Promise<void> {
  await regenerateTaskRaw(taskId);
}

/** Inject an operator note and re-run a task once. */
export async function modifyTask(taskId: string, note: string): Promise<void> {
  await modifyTaskRaw(taskId, note);
}

/** Manually approve a task, skipping the guardian. */
export async function approveTask(taskId: string): Promise<void> {
  await approveTaskRaw(taskId);
}

/** Run the final holistic guardian review over every PIF file. */
export async function runGuardianReview(): Promise<void> {
  useStore.getState().setPhase('guardian-review');
  const findings = await reviewProject();
  if (findings.some((f) => f.severity === 'med' || f.severity === 'high')) {
    useStore.getState().pushToast(
      'info',
      `Guardian flagged ${findings.length} issue(s) in the final review.`,
    );
  }
}

/** Tear the pipeline back to a clean state. */
export async function resetAll(): Promise<void> {
  useStore.getState().resetPipeline();
  resetResources();
  clearNegativeConstraints();
  useStore.getState().setNegatives(getNegativeConstraints());
}
