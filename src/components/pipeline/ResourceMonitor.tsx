/**
 * ResourceMonitor — live token / cost / call tally for the pipeline.
 *
 * Subscribes to the resource store via useResources() and renders a compact
 * footer with totals plus a per-role breakdown. Local models report $0.00,
 * shown as a "local" badge instead of a cost line.
 */
import { Coins, Cpu, DollarSign, RotateCcw } from 'lucide-react';
import { useResources, resetResources } from '../../lib/pipeline/resources';
import { ROLE_LABELS } from '../../lib/pipeline/roles';
import type { ResourceBreakdown, RoleKey } from '../../lib/pipeline/types';

const ROLE_ORDER: RoleKey[] = ['referent', 'coder', 'guardian', 'supervisor'];

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtCost(n: number): string {
  if (n <= 0) return '$0.00';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}

export function ResourceMonitor() {
  const r = useResources();
  const totalTokens = r.totalIn + r.totalOut;
  const isLocal = r.totalCost <= 0;
  const maxRoleTokens = Math.max(
    1,
    ...ROLE_ORDER.map((k) => {
      const b: ResourceBreakdown = r.byRole[k];
      return b.in + b.out;
    }),
  );

  return (
    <div className="resource-monitor">
      <div className="resource-monitor__head">
        <span className="resource-monitor__title">
          <Cpu size={13} />
          <span>Resources</span>
        </span>
        {isLocal ? (
          <span className="badge badge--ok resource-monitor__local">local · $0.00</span>
        ) : (
          <span className="resource-monitor__cost">
            <DollarSign size={13} />
            <span>{fmtCost(r.totalCost)}</span>
          </span>
        )}
        <button
          type="button"
          className="icon-btn btn--sm"
          onClick={() => resetResources()}
          aria-label="Reset resource counters"
          title="Reset resource counters"
          disabled={r.calls === 0}
        >
          <RotateCcw size={13} />
        </button>
      </div>

      <div className="resource-monitor__totals">
        <div className="resource-stat">
          <Coins size={13} />
          <span className="resource-stat__num">{fmtTokens(totalTokens)}</span>
          <span className="resource-stat__label">tokens</span>
        </div>
        <div className="resource-stat">
          <span className="resource-stat__num">{r.calls}</span>
          <span className="resource-stat__label">calls</span>
        </div>
      </div>

      <div className="resource-monitor__roles">
        {ROLE_ORDER.map((k) => {
          const b: ResourceBreakdown = r.byRole[k];
          const roleTokens = b.in + b.out;
          const width = pct(roleTokens, maxRoleTokens);
          return (
            <div className="resource-row" key={k}>
              <div className="resource-row__label">
                <span className="resource-row__name truncate">{ROLE_LABELS[k].split(' — ')[0]}</span>
                <span className="resource-row__val mono">
                  {fmtTokens(roleTokens)}
                  {!isLocal && b.cost > 0 ? ` · ${fmtCost(b.cost)}` : ''}
                </span>
              </div>
              <div className="resource-bar" aria-hidden="true">
                <span className="resource-bar__fill" style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ResourceMonitor;
