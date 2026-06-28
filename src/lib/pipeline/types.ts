/**
 * Presence / Eidolon-style supervised pipeline — shared types.
 *
 * Three named AI roles collaborate under human control:
 *   - referent:  brainstorms with the user and authors the PIF
 *   - coder:     writes code file-by-file in the sandbox
 *   - guardian:  reviews every iteration against the PIF (semantic + architectural)
 *   - supervisor: optional escalation model for tasks too complex for the coder
 */
import type { ProviderKind } from '../llm/providers';

export type RoleKey = 'referent' | 'coder' | 'guardian' | 'supervisor';

export type PipelinePhase =
  | 'idle'
  | 'brainstorm' // referent dialogue with the user
  | 'plan-review' // PIF generated, awaiting human approval
  | 'building' // coder iterating over files
  | 'iteration-review' // guardian annotated an iteration, awaiting human decision
  | 'guardian-review' // final whole-project guardian pass
  | 'done'
  | 'error';

export type TaskStatus =
  | 'pending'
  | 'generating'
  | 'testing'
  | 'fixing'
  | 'validated'
  | 'failed'
  | 'awaiting-approval'
  | 'approved'
  | 'rejected';

export interface PIFFile {
  path: string;
  purpose: string;
}

export interface PIF {
  goal: string;
  stack: string[];
  constraints: string[];
  files: PIFFile[];
  acceptanceCriteria: string[];
  tasks: { title: string; path: string; description: string }[];
}

export interface TaskLogEntry {
  ts: number;
  kind: 'generate' | 'test' | 'fix' | 'guardian' | 'info' | 'error';
  text: string;
}

export interface PIFTask {
  id: string;
  title: string;
  path: string;
  description: string;
  status: TaskStatus;
  iteration: number;
  maxIterations: number;
  log: TaskLogEntry[];
  guardianNotes?: string;
}

export interface GuardianFinding {
  severity: 'low' | 'med' | 'high';
  category: string; // e.g. "wrong-layer", "logic", "spec-deviation", "syntax"
  message: string;
  file?: string;
  recommendation?: string;
}

export interface NegativeConstraint {
  id: string;
  category: string;
  description: string;
  taskPath?: string;
  ts: number;
}

export interface ResourceBreakdown {
  in: number;
  out: number;
  cost: number;
  calls: number;
}

export interface ResourceSnapshot {
  totalIn: number;
  totalOut: number;
  totalCost: number;
  calls: number;
  byRole: Record<RoleKey, ResourceBreakdown>;
}

export interface ApprovalRequest {
  kind: 'plan' | 'iteration' | 'escalation';
  title: string;
  detail?: string;
  taskId?: string;
  guardianFindings?: GuardianFinding[];
  payload?: unknown;
}

export type { ProviderKind };
