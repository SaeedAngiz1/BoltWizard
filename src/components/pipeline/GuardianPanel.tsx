/**
 * GuardianPanel — final whole-project review surface.
 *
 * Lists every GuardianFinding as a severity-chipped row, plus a per-task notes
 * section. Provides a "Run final review" action that drives runGuardianReview().
 * Friendly empty state when nothing has been flagged.
 */
import { ChevronRight, ListChecks, ShieldCheck, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../../store';
import { runGuardianReview } from '../../lib/pipeline/pipeline';
import type { GuardianFinding, PIFTask } from '../../lib/pipeline/types';

const SEV_CLASS: Record<GuardianFinding['severity'], string> = {
  high: 'guardian-finding guardian-finding--high',
  med: 'guardian-finding guardian-finding--med',
  low: 'guardian-finding guardian-finding--low',
};

function FindingRow({ f }: { f: GuardianFinding }) {
  return (
    <li className={SEV_CLASS[f.severity]}>
      <span className="guardian-finding__sev">{f.severity}</span>
      <div className="guardian-finding__body">
        <div className="guardian-finding__msg">
          <span className="guardian-finding__cat">{f.category}</span>
          {f.message}
        </div>
        {f.file && <div className="guardian-finding__file mono">{f.file}</div>}
        {f.recommendation && (
          <div className="guardian-finding__rec muted">→ {f.recommendation}</div>
        )}
      </div>
    </li>
  );
}

function TaskNotes({ task }: { task: PIFTask }) {
  const [open, setOpen] = useState(false);
  if (!task.guardianNotes) return null;
  return (
    <div className="guardian-panel__tasknote">
      <button
        type="button"
        className="btn btn--ghost btn--sm guardian-panel__tasktoggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <ChevronRight
          size={14}
          aria-hidden="true"
          style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform var(--dur) var(--ease)' }}
        />
        <span className="mono truncate">{task.path}</span>
      </button>
      {open && <p className="guardian-panel__taskbody muted">{task.guardianNotes}</p>}
    </div>
  );
}

export function GuardianPanel() {
  const findings = useStore((s) => s.findings);
  const tasks = useStore((s) => s.tasks);
  const busy = useStore((s) => s.busy);

  const notedTasks = tasks.filter((t) => t.guardianNotes);

  return (
    <div className="guardian-panel">
      <div className="pane__head">
        <span className="pane__title">
          <ShieldCheck size={13} />
          Guardian review
        </span>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={() => void runGuardianReview()}
          disabled={busy || tasks.length === 0}
        >
          <Sparkles size={13} aria-hidden="true" />
          Run final review
        </button>
      </div>

      <div className="guardian-panel__body">
        {findings.length === 0 ? (
          <div className="guardian-panel__empty">
            <div className="guardian-panel__icon">
              <ListChecks size={26} />
            </div>
            <h4>No issues flagged</h4>
            <p className="muted">
              {tasks.length === 0
                ? 'Generate and build a plan first, then run a final review here.'
                : 'Everything looks good. Run a final review to have the Guardian audit the whole project.'}
            </p>
          </div>
        ) : (
          <ul className="guardian-panel__findings">
            {findings.map((f, i) => (
              <FindingRow key={i} f={f} />
            ))}
          </ul>
        )}

        {notedTasks.length > 0 && (
          <div className="guardian-panel__notes">
            <h5 className="guardian-panel__sectiontitle">Per-task notes</h5>
            {notedTasks.map((t) => (
              <TaskNotes key={t.id} task={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default GuardianPanel;
