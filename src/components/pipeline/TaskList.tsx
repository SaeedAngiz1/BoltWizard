/**
 * TaskList — file-by-file build surface driven by the coder + guardian.
 *
 * Each PIFTask renders as a row with a status badge, clickable path (opens the
 * tab), iteration counter, expandable guardian notes, and a compact action bar:
 * View / Download / Run-or-Retry / Modify / Approve / Regenerate. Actions are
 * gated by store.busy and the task's own status.
 */
import { useState } from 'react';
import {
  Check,
  ChevronRight,
  Download,
  Eye,
  ListChecks,
  Play,
  Pencil,
  RefreshCw,
} from 'lucide-react';
import { useStore } from '../../store';
import {
  runFileTask,
  regenerateTask,
  modifyTask,
  approveTask,
} from '../../lib/pipeline/pipeline';
import { readFile } from '../../lib/webcontainer';
import type { PIFTask, TaskStatus } from '../../lib/pipeline/types';

function badgeClass(status: TaskStatus): string {
  switch (status) {
    case 'generating':
    case 'testing':
    case 'fixing':
      return 'badge badge--run';
    case 'validated':
    case 'approved':
      return 'badge badge--ok';
    case 'failed':
    case 'rejected':
      return 'badge badge--err';
    case 'awaiting-approval':
      return 'badge';
    default:
      return 'badge';
  }
}

function badgeLabel(status: TaskStatus): string {
  switch (status) {
    case 'awaiting-approval':
      return 'awaiting approval';
    default:
      return status;
  }
}

function downloadText(path: string, content: string): void {
  const name = path.split('/').pop() || 'file.txt';
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function TaskRow({ task }: { task: PIFTask }) {
  const busy = useStore((s) => s.busy);
  const openTab = useStore((s) => s.openTab);
  const pushToast = useStore((s) => s.pushToast);
  const [notesOpen, setNotesOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const running = task.status === 'generating' || task.status === 'testing' || task.status === 'fixing';
  const locked = busy || running;
  const awaiting = task.status === 'awaiting-approval';
  const canApprove = awaiting && !busy;

  const doDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const content = await readFile(task.path);
      downloadText(task.path, content);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      pushToast('error', `Could not read ${task.path}: ${msg}`);
    } finally {
      setDownloading(false);
    }
  };

  const doModify = () => {
    if (locked) return;
    const note = window.prompt(`Modify ${task.title} — describe the change:`);
    if (note && note.trim()) void modifyTask(task.id, note.trim());
  };

  const runOrRetry =
    task.status === 'pending' || task.status === 'failed' || task.status === 'rejected';

  return (
    <div className="task-row">
      <div className="task-row__main">
        <div className="task-row__head">
          <span className={badgeClass(task.status)}>{badgeLabel(task.status)}</span>
          <button
            type="button"
            className="task-row__path mono"
            onClick={() => openTab(task.path)}
            title={`Open ${task.path}`}
          >
            {task.path}
          </button>
          <span className="task-row__iter faint" title="iteration / max">
            {task.iteration}/{task.maxIterations}
          </span>
          {task.guardianNotes && (
            <button
              type="button"
              className="icon-btn btn--sm task-row__notes-toggle"
              aria-label="Toggle guardian notes"
              title="Guardian notes"
              aria-expanded={notesOpen}
              onClick={() => setNotesOpen((v) => !v)}
            >
              <ChevronRight
                size={14}
                aria-hidden="true"
                style={{ transform: notesOpen ? 'rotate(90deg)' : 'none', transition: 'transform var(--dur) var(--ease)' }}
              />
            </button>
          )}
        </div>
        <div className="task-row__title">{task.title}</div>
        {task.description && <div className="task-row__desc muted">{task.description}</div>}

        {notesOpen && task.guardianNotes && (
          <div className="task-row__notes">
            <span className="task-row__noteslabel">Guardian</span>
            <p className="muted">{task.guardianNotes}</p>
          </div>
        )}
      </div>

      <div className="task-row__actions">
        <button
          type="button"
          className="icon-btn btn--sm"
          onClick={() => openTab(task.path)}
          title="View"
          aria-label={`View ${task.path}`}
        >
          <Eye size={14} />
        </button>
        <button
          type="button"
          className="icon-btn btn--sm"
          onClick={doDownload}
          disabled={locked || downloading}
          title="Download"
          aria-label={`Download ${task.path}`}
        >
          <Download size={14} />
        </button>

        {runOrRetry ? (
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => void runFileTask(task.id)}
            disabled={locked}
            title={task.status === 'pending' ? 'Run' : 'Retry'}
          >
            <Play size={13} />
            {task.status === 'pending' ? 'Run' : 'Retry'}
          </button>
        ) : null}

        <button
          type="button"
          className="icon-btn btn--sm"
          onClick={() => void regenerateTask(task.id)}
          disabled={locked}
          title="Regenerate"
          aria-label={`Regenerate ${task.title}`}
        >
          <RefreshCw size={14} />
        </button>
        <button
          type="button"
          className="icon-btn btn--sm"
          onClick={doModify}
          disabled={locked}
          title="Modify"
          aria-label={`Modify ${task.title}`}
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          className="btn btn--sm task-row__approve"
          onClick={() => void approveTask(task.id)}
          disabled={!canApprove}
          title={canApprove ? 'Approve' : 'Nothing to approve'}
          aria-label={`Approve ${task.title}`}
        >
          <Check size={13} />
          Approve
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  const phase = useStore((s) => s.phase);
  return (
    <div className="task-list__empty">
      <div className="task-list__icon">
        <ListChecks size={26} />
      </div>
      <h4>{phase === 'done' ? 'Build complete' : 'No tasks yet'}</h4>
      <p className="muted">
        {phase === 'done'
          ? 'All tasks have been processed. Review the Guardian findings or start a new pipeline.'
          : 'Approve a plan to populate the build queue.'}
      </p>
    </div>
  );
}

export function TaskList() {
  const tasks = useStore((s) => s.tasks);
  const phase = useStore((s) => s.phase);

  if (tasks.length === 0) return <EmptyState />;

  return (
    <div className="task-list" data-phase={phase}>
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} />
      ))}
    </div>
  );
}

export default TaskList;
