/**
 * PIFViewer — renders the Project Instruction File and the plan-approval gate.
 *
 * Shows goal / stack / constraints / files / acceptance criteria / tasks, with
 * Approve / Reject (resolved via the gate) and an "Edit in editor" action that
 * writes pif.json into the VFS and opens it as a tab.
 */
import { Check, FileCode, ShieldAlert, X } from 'lucide-react';
import { useStore } from '../../store';
import { resolveCurrent } from '../../lib/pipeline/gate';
import { writeFile } from '../../lib/webcontainer';
import type { PIF } from '../../lib/pipeline/types';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="pif-section">
      <h4 className="pif-section__title">{title}</h4>
      {children}
    </section>
  );
}

function PIFBody({ pif }: { pif: PIF }) {
  return (
    <>
      <Section title="Goal">
        <p className="pif-section__goal">{pif.goal}</p>
      </Section>

      {pif.stack.length > 0 && (
        <Section title="Stack">
          <div className="pif-chips">
            {pif.stack.map((s, i) => (
              <span className="pif-chip" key={i}>{s}</span>
            ))}
          </div>
        </Section>
      )}

      {pif.constraints.length > 0 && (
        <Section title="Constraints">
          <ul className="pif-section__list">
            {pif.constraints.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </Section>
      )}

      {pif.files.length > 0 && (
        <Section title="Files">
          <div className="pif-files">
            <table className="pif-files__table">
              <thead>
                <tr>
                  <th>Path</th>
                  <th>Purpose</th>
                </tr>
              </thead>
              <tbody>
                {pif.files.map((f, i) => (
                  <tr key={i}>
                    <td className="mono pif-files__path">{f.path}</td>
                    <td className="muted">{f.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {pif.acceptanceCriteria.length > 0 && (
        <Section title="Acceptance criteria">
          <ul className="pif-section__checklist">
            {pif.acceptanceCriteria.map((c, i) => (
              <li key={i}>
                <Check size={13} aria-hidden="true" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {pif.tasks.length > 0 && (
        <Section title="Tasks">
          <ol className="pif-section__tasks">
            {pif.tasks.map((t, i) => (
              <li key={i}>
                <span className="pif-section__tasktitle">{t.title}</span>
                <span className="mono faint pif-section__taskpath">{t.path}</span>
                {t.description && <span className="muted pif-section__taskdesc">{t.description}</span>}
              </li>
            ))}
          </ol>
        </Section>
      )}
    </>
  );
}

export function PIFViewer() {
  const pif = useStore((s) => s.pif);
  const pending = useStore((s) => s.pendingApproval);
  const pushToast = useStore((s) => s.pushToast);
  const openTab = useStore((s) => s.openTab);
  const busy = useStore((s) => s.busy);

  if (!pif) {
    return (
      <div className="pif-viewer pif-viewer--empty">
        <p className="muted">No plan yet. Brainstorm with the referent, then generate a PIF.</p>
      </div>
    );
  }

  // The orchestrator awaits approval at plan-review; the buttons are live only
  // while a plan-approval request is actually pending in the store.
  const waiting = pending?.kind === 'plan';

  const editInEditor = async () => {
    try {
      await writeFile('pif.json', JSON.stringify(pif, null, 2));
      openTab('pif.json');
      pushToast('success', 'pif.json opened in the editor.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      pushToast('error', `Could not write pif.json: ${msg}`);
    }
  };

  return (
    <div className="pif-viewer">
      <div className="pane__head">
        <span className="pane__title">
          <FileCode size={13} />
          Project plan (PIF)
        </span>
      </div>

      <div className="pif-viewer__body">
        <PIFBody pif={pif} />

        <div className="pif-viewer__note">
          <ShieldAlert size={13} aria-hidden="true" />
          <span>Approval is required before coding begins.</span>
        </div>
      </div>

      <div className="pif-viewer__actions">
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={editInEditor}
          disabled={busy}
        >
          <FileCode size={13} aria-hidden="true" />
          Edit in editor
        </button>
        <div className="pif-viewer__spacer" />
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => resolveCurrent(false)}
          disabled={busy || !waiting}
          title={waiting ? 'Reject and return to brainstorm' : 'No pending approval'}
        >
          <X size={14} aria-hidden="true" />
          Reject
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => resolveCurrent(true)}
          disabled={busy || !waiting}
          title={waiting ? 'Approve and start building' : 'No pending approval'}
        >
          <Check size={14} aria-hidden="true" />
          Approve &amp; Build
        </button>
      </div>
    </div>
  );
}

export default PIFViewer;
