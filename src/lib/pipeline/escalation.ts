/**
 * Escalation gate. When the coder is struggling (iteration >= 2, or any
 * high-severity guardian finding) the orchestrator asks the human whether to
 * retry the file with the stronger supervisor model. Blocks on the approval UI.
 */
import { awaitApproval } from './gate';
import { summarizeFindings, hasHighFinding } from './analysis';
import type { PIFTask, GuardianFinding } from './types';

/** Decide whether to escalate and, if so, ask the human. Returns approval. */
export async function maybeEscalate(
  task: PIFTask,
  findings: GuardianFinding[],
): Promise<boolean> {
  const shouldEscalate = task.iteration >= 2 || hasHighFinding(findings);
  if (!shouldEscalate) return false;

  const detail = findings.length
    ? `${summarizeFindings(findings)}\n\nThe coder has struggled on ${task.path}. Approve to retry with the supervisor model.`
    : `The coder has reached iteration ${task.iteration} on ${task.path} without passing. Approve to retry with the supervisor model.`;

  return awaitApproval({
    kind: 'escalation',
    taskId: task.id,
    title: `Escalate ${task.path} to supervisor model?`,
    detail,
    guardianFindings: findings,
  });
}
