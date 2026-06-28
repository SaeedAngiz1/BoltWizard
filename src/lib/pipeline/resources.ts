/**
 * Resource monitor — accumulates token usage + estimated cost per role, live.
 * Fed by chat.ts (which parses provider usage from the SSE stream, or estimates).
 * React components subscribe via useResources().
 */
import { useSyncExternalStore } from 'react';
import type { ProviderKind } from '../llm/providers';
import type { ResourceBreakdown, ResourceSnapshot, RoleKey } from './types';
import { estimateCost } from './costs';

const blank = (): ResourceBreakdown => ({ in: 0, out: 0, cost: 0, calls: 0 });

const empty = (): ResourceSnapshot => ({
  totalIn: 0,
  totalOut: 0,
  totalCost: 0,
  calls: 0,
  byRole: { referent: blank(), coder: blank(), guardian: blank(), supervisor: blank() },
});

let snap: ResourceSnapshot = empty();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function recordUsage(
  role: RoleKey,
  provider: ProviderKind,
  model: string,
  inTokens: number,
  outTokens: number,
): void {
  const cost = estimateCost(provider, model, inTokens, outTokens);
  const rb = { ...snap.byRole[role] };
  rb.in += inTokens;
  rb.out += outTokens;
  rb.cost += cost;
  rb.calls += 1;
  snap = {
    totalIn: snap.totalIn + inTokens,
    totalOut: snap.totalOut + outTokens,
    totalCost: snap.totalCost + cost,
    calls: snap.calls + 1,
    byRole: { ...snap.byRole, [role]: rb },
  };
  notify();
}

export function resetResources(): void {
  snap = empty();
  notify();
}

export function getSnapshot(): ResourceSnapshot {
  return snap;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useResources(): ResourceSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
