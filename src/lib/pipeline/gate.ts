/**
 * Human approval gate. The orchestrator (pipeline.ts) is an async function; when
 * it reaches a checkpoint (plan approval, iteration approval, escalation) it
 * awaits a promise stored here. The UI resolves it via resolveCurrent().
 *
 * One-way dependency: gate → store (to surface the pending request for rendering).
 * The store never imports gate, avoiding a cycle.
 */
import type { ApprovalRequest } from './types';
import { useStore } from '../../store';

type Resolver = (approved: boolean) => void;

interface Pending {
  req: ApprovalRequest;
  resolve: Resolver;
}

let current: Pending | null = null;

/** Block until the UI resolves the request. Returns the user's decision. */
export function awaitApproval(req: ApprovalRequest): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    current = { req, resolve };
    useStore.getState().setPendingApproval(req);
  });
}

export function hasPendingApproval(): boolean {
  return current !== null;
}

export function currentApproval(): ApprovalRequest | null {
  return current?.req ?? null;
}

/** Called by the UI's Approve/Reject buttons. Resolves the blocked promise. */
export function resolveCurrent(approved: boolean): void {
  const p = current;
  current = null;
  useStore.getState().setPendingApproval(null);
  p?.resolve(approved);
}
