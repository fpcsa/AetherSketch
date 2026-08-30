import {
  ArrowRight,
  Braces,
  Check,
  GitCompareArrows,
  Minus,
  Pencil,
  Plus,
  X,
} from 'lucide-react';
import { useMemo } from 'react';

import {
  compareArchitectures,
  type ArchitectureComparison,
  type ArchitectureDiffItem,
} from '../../architecture/comparison';
import type { Architecture } from '../../architecture/model';
import { useArchitectureStore } from '../../stores/architecture-store';
import { useWorkspaceUiStore } from '../../stores/workspace-ui-store';
import { useWebMcpStore } from '../../webmcp';
import { usePanelFocus } from '../layout/use-panel-focus';
import { formatScore } from '../analysis/score-format';

function signed(value: number, currency = false): string {
  const prefix = value > 0 ? '+' : value < 0 ? '−' : '';
  const absolute = Math.abs(value).toLocaleString('en-US');
  return currency ? `${prefix}$${absolute}` : `${prefix}${absolute}`;
}

function MetricDelta({
  label,
  before,
  after,
  delta,
  currency = false,
}: {
  label: string;
  before: number | null;
  after: number | null;
  delta: number | null;
  currency?: boolean;
}) {
  const format = (value: number | null) =>
    currency && value !== null
      ? `$${value.toLocaleString('en-US')}`
      : formatScore(value);
  const improvement = delta !== null && (currency ? delta <= 0 : delta >= 0);

  return (
    <div className="border-r border-slate-800/80 px-3 py-3 last:border-r-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">
        {label}
      </p>
      <p className="mt-1 text-[11px] text-slate-500">Before → After</p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-lg font-semibold tabular-nums text-slate-100">
        <span>{format(before)}</span>
        <ArrowRight className="size-3 text-slate-700" aria-hidden="true" />
        <span>{format(after)}</span>
      </div>
      <p
        className={`mt-1 text-[11px] font-semibold tabular-nums ${
          delta === null || delta === 0
            ? 'text-slate-600'
            : improvement
              ? 'text-emerald-400'
              : currency
                ? 'text-amber-400'
                : 'text-rose-400'
        }`}
      >
        {delta === null ? 'No score comparison' : signed(delta, currency)}
      </p>
    </div>
  );
}

const groupVisuals = {
  added: { Icon: Plus, label: 'Added', tone: 'text-emerald-400' },
  changed: { Icon: Pencil, label: 'Changed', tone: 'text-amber-400' },
  removed: { Icon: Minus, label: 'Removed', tone: 'text-rose-400' },
} as const;

function readableField(field: string): string {
  return field
    .replace('configuration.', '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function DiffGroup({
  kind,
  items,
  onSelect,
}: {
  kind: keyof typeof groupVisuals;
  items: ArchitectureDiffItem[];
  onSelect: (item: ArchitectureDiffItem) => void;
}) {
  const { Icon, label, tone } = groupVisuals[kind];

  return (
    <section aria-label={`${label} architecture elements`}>
      <div className="mb-1.5 flex items-center gap-1.5">
        <Icon className={`size-3 ${tone}`} aria-hidden="true" />
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
          {label}
        </h3>
        <span className="ml-auto font-mono text-[10px] text-slate-700">
          {items.length}
        </span>
      </div>
      {items.length > 0 ? (
        <ul className="space-y-1">
          {items.map((item) => {
            const selectable =
              kind !== 'removed' && item.entity !== 'architecture';
            return (
              <li key={`${item.entity}:${item.id}`}>
                <button
                  type="button"
                  disabled={!selectable}
                  onClick={() => onSelect(item)}
                  className="w-full border border-slate-800/80 bg-slate-900/25 px-2 py-2 text-left enabled:hover:border-cyan-400/30 enabled:hover:bg-cyan-400/5 disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
                >
                  <div className="flex flex-col-reverse gap-1">
                    <span className="min-w-0 break-words text-[12px] font-medium text-slate-300">
                      {item.label}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.08em] text-slate-700">
                      {item.entity}
                    </span>
                  </div>
                  <p className="mt-1 break-words text-[11px] leading-4 text-slate-500">
                    {item.fields.map(readableField).join(' · ')}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="border border-dashed border-slate-800 px-2 py-2 text-[10px] text-slate-700">
          None
        </p>
      )}
    </section>
  );
}

function ComparisonContent({
  comparison,
  onSelect,
}: {
  comparison: ArchitectureComparison;
  onSelect: (item: ArchitectureDiffItem) => void;
}) {
  return (
    <>
      <div
        className="grid grid-cols-3 border-b border-slate-800/80"
        data-testid="agent-session-score-deltas"
      >
        <MetricDelta
          label="Cost"
          before={comparison.before.estimatedMonthlyCost}
          after={comparison.after.estimatedMonthlyCost}
          delta={comparison.delta.estimatedMonthlyCost}
          currency
        />
        <MetricDelta
          label="Resilience"
          before={comparison.before.resilienceScore}
          after={comparison.after.resilienceScore}
          delta={comparison.delta.resilienceScore}
        />
        <MetricDelta
          label="Security"
          before={comparison.before.securityScore}
          after={comparison.after.securityScore}
          delta={comparison.delta.securityScore}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {comparison.hasChanges ? (
          <div className="grid grid-cols-3 gap-2.5">
            <DiffGroup
              kind="added"
              items={comparison.added}
              onSelect={onSelect}
            />
            <DiffGroup
              kind="changed"
              items={comparison.changed}
              onSelect={onSelect}
            />
            <DiffGroup
              kind="removed"
              items={comparison.removed}
              onSelect={onSelect}
            />
          </div>
        ) : (
          <div className="grid min-h-40 place-items-center text-center">
            <div>
              <Check
                className="mx-auto size-5 text-slate-700"
                aria-hidden="true"
              />
              <p className="mt-2 text-[12px] font-medium text-slate-400">
                Baseline checkpoint captured
              </p>
              <p className="mt-1 text-[11px] text-slate-700">
                Agent edits will appear here as deterministic IR changes.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function OpenAgentSessionComparison({ baseline }: { baseline: Architecture }) {
  const architecture = useArchitectureStore((state) => state.architecture);
  const mode = useWebMcpStore((state) => state.mode);
  const setOpen = useWebMcpStore((state) => state.setComparisonOpen);
  const panelRef = usePanelFocus(true, () => setOpen(false));
  const setActivePanel = useWorkspaceUiStore((state) => state.setActivePanel);
  const focusComponent = useWorkspaceUiStore((state) => state.focusComponent);
  const selectConnection = useWorkspaceUiStore(
    (state) => state.selectConnection,
  );
  const comparison = useMemo(
    () => compareArchitectures(baseline, architecture),
    [architecture, baseline],
  );

  const selectItem = (item: ArchitectureDiffItem) => {
    if (item.entity === 'component') {
      focusComponent(item.id);
    } else if (item.entity === 'connection') {
      selectConnection(item.id);
    }
    setActivePanel('inspector');
    setOpen(false);
  };

  return (
    <aside
      ref={panelRef}
      className="absolute bottom-16 right-3 top-16 z-40 flex w-[min(52rem,calc(100vw-2rem))] flex-col border border-slate-700 bg-[#0c1118] shadow-2xl shadow-black/60 max-[1280px]:top-28"
      aria-label="Agent session comparison"
    >
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-slate-800 px-3">
        <div className="grid size-7 place-items-center border border-violet-400/25 bg-violet-400/8">
          <GitCompareArrows
            className="size-3.5 text-violet-300"
            aria-hidden="true"
          />
        </div>
        <div>
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-slate-300">
            Agent session comparison
          </h2>
          <p className="mt-0.5 text-[10px] text-slate-600">
            Revision {comparison.baselineRevision} baseline → revision{' '}
            {comparison.currentRevision}
          </p>
        </div>
        <span
          className={`ml-auto flex items-center gap-1 border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
            mode === 'edit'
              ? 'border-amber-400/25 bg-amber-400/8 text-amber-300'
              : 'border-slate-700 text-slate-500'
          }`}
        >
          <Braces className="size-2.5" aria-hidden="true" />
          {mode === 'edit' ? 'Session active' : 'Session complete'}
        </span>
        <button
          type="button"
          className="grid size-7 place-items-center text-slate-600 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80"
          onClick={() => setOpen(false)}
          aria-label="Close agent session comparison"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </header>

      <ComparisonContent comparison={comparison} onSelect={selectItem} />
    </aside>
  );
}

export function AgentSessionComparison() {
  const baseline = useWebMcpStore((state) => state.agentSessionBaseline);
  const open = useWebMcpStore((state) => state.comparisonOpen);

  return open && baseline ? (
    <OpenAgentSessionComparison baseline={baseline} />
  ) : null;
}
