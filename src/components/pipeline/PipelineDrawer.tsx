/**
 * PipelineDrawer — right-side slide-in hosting the supervised pipeline.
 *
 * Gated by store.pipelineOpen. Header carries the title + close button, a phase
 * stepper (Brainstorm → Plan → Build → Review) reflects store.phase. The body
 * switches on the phase; the footer always renders <ResourceMonitor/> and an
 * <ApprovalDialog/> is mounted once (it self-gates on pendingApproval).
 */
import { Brain, Check, X } from 'lucide-react';
import { useStore } from '../../store';
import type { PipelinePhase } from '../../lib/pipeline/types';
import { Brainstorm } from './Brainstorm';
import { PIFViewer } from './PIFViewer';
import { TaskList } from './TaskList';
import { GuardianPanel } from './GuardianPanel';
import { ResourceMonitor } from './ResourceMonitor';
import { ApprovalDialog } from './ApprovalDialog';

type Step = {
  key: string;
  label: string;
  phases: PipelinePhase[];
};

const STEPS: Step[] = [
  { key: 'brainstorm', label: 'Brainstorm', phases: ['brainstorm'] },
  { key: 'plan', label: 'Plan', phases: ['plan-review'] },
  { key: 'build', label: 'Build', phases: ['building', 'iteration-review'] },
  { key: 'review', label: 'Review', phases: ['guardian-review'] },
];

function stepIndex(phase: PipelinePhase): number {
  for (let i = 0; i < STEPS.length; i++) {
    if (STEPS[i].phases.includes(phase)) return i;
  }
  if (phase === 'done') return STEPS.length; // past the last step
  return -1; // idle / error — nothing active
}

function PhaseStepper({ phase }: { phase: PipelinePhase }) {
  const active = stepIndex(phase);
  return (
    <div className="phase-stepper" aria-label="Pipeline progress">
      {STEPS.map((s, i) => {
        const done = active > i;
        const isActive = active === i;
        const cls = [
          'phase-step',
          isActive ? 'phase-step--active' : '',
          done ? 'phase-step--done' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <div className={cls} key={s.key}>
            <span className="phase-step__dot">
              {done ? <Check size={11} aria-hidden="true" /> : <span>{i + 1}</span>}
            </span>
            <span className="phase-step__label">{s.label}</span>
            {i < STEPS.length - 1 && <span className="phase-step__line" aria-hidden="true" />}
          </div>
        );
      })}
    </div>
  );
}

function Body({ phase }: { phase: PipelinePhase }) {
  switch (phase) {
    case 'brainstorm':
      return <Brainstorm />;
    case 'plan-review':
      return <PIFViewer />;
    case 'building':
    case 'iteration-review':
      return <TaskList />;
    case 'guardian-review':
      return <GuardianPanel />;
    case 'done':
      return (
        <div className="pipeline-drawer__done">
          <div className="pipeline-drawer__summary">
            <h4>Pipeline complete</h4>
            <p className="muted">
              All tasks have been processed. You can still approve, modify, or regenerate individual files.
            </p>
          </div>
          <TaskList />
        </div>
      );
    case 'idle':
    case 'error':
    default:
      return <Brainstorm />;
  }
}

export function PipelineDrawer() {
  const open = useStore((s) => s.pipelineOpen);
  const phase = useStore((s) => s.phase);
  const setPipelineOpen = useStore((s) => s.setPipelineOpen);

  return (
    <>
      <aside
        className={`pipeline-drawer${open ? ' pipeline-drawer--open' : ''}`}
        data-open={open ? 'true' : 'false'}
        aria-hidden={!open}
        aria-label="Supervised pipeline"
      >
        <header className="pipeline-drawer__head">
          <span className="pipeline-drawer__title">
            <Brain size={16} aria-hidden="true" />
            <span>Supervised Pipeline</span>
          </span>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setPipelineOpen(false)}
            aria-label="Close pipeline"
            title="Close"
          >
            <X size={16} />
          </button>
        </header>

        <div className="pipeline-drawer__stepper">
          <PhaseStepper phase={phase} />
        </div>

        <div className="pipeline-drawer__body">
          <Body phase={phase} />
        </div>

        <footer className="pipeline-drawer__footer">
          <ResourceMonitor />
        </footer>
      </aside>

      {open && (
        <div
          className="pipeline-drawer__scrim"
          aria-hidden="true"
          onClick={() => setPipelineOpen(false)}
        />
      )}

      {/* Mounts once; renders nothing unless an approval is pending. */}
      <ApprovalDialog />
    </>
  );
}

export default PipelineDrawer;
