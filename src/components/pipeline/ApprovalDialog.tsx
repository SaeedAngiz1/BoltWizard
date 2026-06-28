/**
 * ApprovalDialog — modal gate for human checkpoints.
 *
 * The orchestrator blocks on awaitApproval(); this component reads the pending
 * request from the store and resolves it via resolveCurrent(). Renders nothing
 * when there is no pending request. Esc rejects (Esc also rejects when an
 * escalation is pending — "Keep local").
 */
import { useEffect, useRef } from 'react';
import { AlertTriangle, Check, ShieldCheck, X } from 'lucide-react';
import { useStore } from '../../store';
import { resolveCurrent } from '../../lib/pipeline/gate';
import type { ApprovalRequest, GuardianFinding } from '../../lib/pipeline/types';

const SEV_CLASS: Record<GuardianFinding['severity'], string> = {
  high: 'guardian-finding guardian-finding--high',
  med: 'guardian-finding guardian-finding--med',
  low: 'guardian-finding guardian-finding--low',
};

function FindingsList({ findings }: { findings: GuardianFinding[] }) {
  if (!findings || findings.length === 0) return null;
  return (
    <ul className="approval-dialog__findings">
      {findings.map((f, i) => (
        <li className={SEV_CLASS[f.severity]} key={i}>
          <span className="guardian-finding__sev">{f.severity}</span>
          <div className="guardian-finding__body">
            <div className="guardian-finding__msg">
              <span className="guardian-finding__cat">{f.category}</span>
              {f.message}
            </div>
            {f.file && <div className="guardian-finding__file mono">{f.file}</div>}
            {f.recommendation && (
              <div className="guardian-finding__rec muted">{f.recommendation}</div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function labelsFor(kind: ApprovalRequest['kind']): { approve: string; reject: string } {
  if (kind === 'plan') return { approve: 'Approve & Build', reject: 'Reject plan' };
  if (kind === 'escalation') return { approve: 'Escalate', reject: 'Keep local' };
  return { approve: 'Approve', reject: 'Reject' };
}

export function ApprovalDialog() {
  const req = useStore((s) => s.pendingApproval);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Esc always rejects.
  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        resolveCurrent(false);
      }
    };
    window.addEventListener('keydown', onKey);
    requestAnimationFrame(() => dialogRef.current?.focus());
    return () => window.removeEventListener('keydown', onKey);
  }, [req]);

  if (!req) return null;

  const lab = labelsFor(req.kind);
  const isEscalation = req.kind === 'escalation';

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={() => resolveCurrent(false)}
    >
      <div
        className="modal approval-dialog"
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={req.title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h3 className="approval-dialog__title">
            {isEscalation ? (
              <AlertTriangle size={18} aria-hidden="true" />
            ) : (
              <ShieldCheck size={18} aria-hidden="true" />
            )}
            <span>{req.title}</span>
          </h3>
        </div>

        {req.detail && <p className="approval-dialog__detail muted">{req.detail}</p>}

        <FindingsList findings={req.guardianFindings ?? []} />

        <div className="approval-dialog__note faint">
          {isEscalation
            ? 'Escalate this task to the stronger supervisor model?'
            : 'Approval is required before proceeding.'}
        </div>

        <div className="approval-dialog__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => resolveCurrent(false)}
          >
            <X size={15} aria-hidden="true" />
            {lab.reject}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => resolveCurrent(true)}
            autoFocus
          >
            <Check size={15} aria-hidden="true" />
            {lab.approve}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ApprovalDialog;
