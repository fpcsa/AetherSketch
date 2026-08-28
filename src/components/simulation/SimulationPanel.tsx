import {
  AlertOctagon,
  CheckCircle2,
  Eraser,
  Play,
  ShieldCheck,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import type { FailureScope } from '../../architecture/simulation';
import { effectiveZones } from '../../architecture/network/structure';
import { useArchitectureStore } from '../../stores/architecture-store';
import { useIntelligenceStore } from '../../stores/intelligence-store';
import { useWorkspaceUiStore } from '../../stores/workspace-ui-store';

const scopes: readonly { value: FailureScope; label: string }[] = [
  { value: 'component', label: 'Component' },
  { value: 'availability-zone', label: 'Availability zone' },
  { value: 'region', label: 'Region' },
];

export function SimulationPanel() {
  const architecture = useArchitectureStore((state) => state.architecture);
  const simulation = useIntelligenceStore((state) => state.simulation);
  const runSimulation = useIntelligenceStore((state) => state.runSimulation);
  const clearSimulation = useIntelligenceStore(
    (state) => state.clearSimulation,
  );
  const focusComponent = useWorkspaceUiStore((state) => state.focusComponent);
  const setNotice = useWorkspaceUiStore((state) => state.setNotice);
  const [selection, setSelection] = useState({
    simulation,
    scope: simulation?.scope ?? 'component',
    target: simulation?.target ?? '',
  });
  if (selection.simulation !== simulation) {
    setSelection({
      simulation,
      scope: simulation?.scope ?? selection.scope,
      target: simulation?.target ?? selection.target,
    });
  }
  const { scope, target } = selection;

  const options = useMemo(() => {
    if (scope === 'component') {
      return architecture.components.map((component) => ({
        value: component.id,
        label: component.name,
      }));
    }
    if (scope === 'availability-zone') {
      return [
        ...new Set(
          architecture.components.flatMap((component) =>
            effectiveZones(architecture, component),
          ),
        ),
      ]
        .sort()
        .map((zone) => ({ value: zone, label: zone }));
    }
    return [
      ...new Set(architecture.components.map((component) => component.region)),
    ]
      .sort()
      .map((region) => ({ value: region, label: region }));
  }, [architecture, scope]);
  const selectedTarget = options.some((option) => option.value === target)
    ? target
    : (options[0]?.value ?? '');
  const statusHeadline = simulation
    ? simulation.status === 'unavailable'
      ? 'System is unavailable'
      : `System remains ${simulation.status}`
    : null;

  const startSimulation = () => {
    if (!selectedTarget) {
      setNotice({ kind: 'error', message: 'Choose a valid failure target.' });
      return;
    }
    try {
      runSimulation({ scope, target: selectedTarget });
    } catch (error) {
      setNotice({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Simulation failed.',
      });
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-3 border-b border-slate-800/80 p-3">
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-600">
            Failure scope
          </p>
          <div className="grid grid-cols-3 gap-1">
            {scopes.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() =>
                  setSelection({ ...selection, scope: item.value, target: '' })
                }
                className={`min-h-8 border px-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 ${
                  scope === item.value
                    ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200'
                    : 'border-slate-800 text-slate-600 hover:text-slate-300'
                }`}
                aria-pressed={scope === item.value}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <label className="block text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-600">
          Failure target
          <select
            className="mt-1 h-9 w-full border border-slate-700 bg-[#0a0f16] px-2 text-[12px] text-slate-200 outline-none focus:border-cyan-400/70"
            value={selectedTarget}
            onChange={(event) =>
              setSelection({ ...selection, target: event.currentTarget.value })
            }
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={startSimulation}
            disabled={!selectedTarget}
            className="flex h-8 flex-1 items-center justify-center gap-1.5 border border-rose-400/30 bg-rose-400/8 text-[12px] font-semibold text-rose-200 transition-colors enabled:hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70"
          >
            <Play className="size-3" aria-hidden="true" />
            Run failure simulation
          </button>
          {simulation ? (
            <button
              type="button"
              onClick={clearSimulation}
              className="grid size-8 place-items-center border border-slate-700 text-slate-500 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80"
              aria-label="Clear simulation"
              title="Clear simulation"
            >
              <Eraser className="size-3" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {simulation ? (
          <div className="space-y-3">
            <div
              className={`border p-3 ${
                simulation.status === 'unavailable'
                  ? 'border-rose-400/35 bg-rose-400/8'
                  : simulation.status === 'degraded'
                    ? 'border-amber-400/30 bg-amber-400/8'
                    : 'border-emerald-400/25 bg-emerald-400/5'
              }`}
            >
              <div className="flex items-center gap-2">
                {simulation.status === 'operational' ? (
                  <CheckCircle2
                    className="size-4 text-emerald-400"
                    aria-hidden="true"
                  />
                ) : (
                  <AlertOctagon
                    className={`size-4 ${simulation.status === 'unavailable' ? 'text-rose-400' : 'text-amber-400'}`}
                    aria-hidden="true"
                  />
                )}
                <span className="text-[13px] font-semibold text-slate-100">
                  {statusHeadline}
                </span>
              </div>
              <p className="mt-1 text-[11px] font-medium text-slate-400">
                {simulation.target} · {simulation.scope} failure
              </p>
              <p className="mt-2 text-[12px] leading-4 text-slate-400">
                {simulation.criticalPathsRemaining
                  ? 'Every critical component remains reachable through surviving capacity.'
                  : 'A critical component, connection, or required internet route is unavailable.'}
              </p>
            </div>

            <div className="grid grid-cols-3 border border-slate-800/80">
              <SummaryMetric
                label="Failed"
                value={simulation.failedComponentIds.length}
                tone="text-rose-300"
              />
              <SummaryMetric
                label="Degraded"
                value={simulation.degradedComponentIds.length}
                tone="text-amber-300"
              />
              <SummaryMetric
                label="Critical path"
                value={simulation.criticalPathsRemaining ? 'Yes' : 'No'}
                tone={
                  simulation.criticalPathsRemaining
                    ? 'text-emerald-300'
                    : 'text-rose-300'
                }
              />
            </div>

            <SimulationComponents
              title="Failed components"
              ids={simulation.failedComponentIds}
              architecture={architecture}
              onSelect={focusComponent}
              empty="No components failed outright."
            />
            <SimulationComponents
              title="Degraded components"
              ids={simulation.degradedComponentIds}
              architecture={architecture}
              onSelect={focusComponent}
              empty="No components are degraded."
            />

            {simulation.findings
              .filter((finding) => finding.code.startsWith('NETWORK_'))
              .map((finding) => (
                <section
                  key={finding.id}
                  className="border border-amber-400/30 bg-amber-400/5 p-3"
                  aria-label={finding.title}
                >
                  <h3 className="text-[12px] font-semibold text-amber-300">
                    {finding.title}
                  </h3>
                  <p className="mt-2 text-[12px] leading-5 text-slate-300">
                    {finding.message}
                  </p>
                  <p className="mt-2 text-[11px] leading-4 text-slate-400">
                    {finding.remediation}
                  </p>
                </section>
              ))}

            <div className="flex items-start gap-2 border border-slate-800/80 bg-slate-900/20 p-2.5">
              <ShieldCheck
                className="mt-0.5 size-3 shrink-0 text-cyan-400"
                aria-hidden="true"
              />
              <p className="text-[10px] leading-4 text-slate-600">
                Simulation is a transient graph projection. Architecture and
                undo history are unchanged. Agent runs add a saved activity
                entry.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid min-h-52 place-items-center text-center">
            <div className="max-w-52">
              <AlertOctagon
                className="mx-auto size-5 text-slate-700"
                aria-hidden="true"
              />
              <p className="mt-3 text-[12px] font-medium text-slate-400">
                No active simulation
              </p>
              <p className="mt-1 text-[11px] leading-4 text-slate-700">
                Choose a failure scope and target to project impact directly on
                the canvas.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: string;
}) {
  return (
    <div className="border-r border-slate-800/80 px-2 py-2.5 text-center last:border-r-0">
      <p className="text-[10px] uppercase tracking-[0.1em] text-slate-700">
        {label}
      </p>
      <p className={`mt-1 text-sm font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function SimulationComponents({
  title,
  ids,
  architecture,
  onSelect,
  empty,
}: {
  title: string;
  ids: string[];
  architecture: ReturnType<
    typeof useArchitectureStore.getState
  >['architecture'];
  onSelect: (componentId: string) => void;
  empty: string;
}) {
  return (
    <section>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-600">
        {title}
      </p>
      {ids.length > 0 ? (
        <div className="space-y-1">
          {ids.map((id) => {
            const component = architecture.components.find(
              (candidate) => candidate.id === id,
            );
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelect(id)}
                className="flex h-8 w-full items-center border border-slate-800/80 bg-slate-900/20 px-2.5 text-left text-[11px] text-slate-400 transition-colors hover:border-cyan-400/30 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
              >
                {component?.name ?? id}
                <span className="ml-auto text-[10px] text-slate-700">
                  Focus
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px] text-slate-700">{empty}</p>
      )}
    </section>
  );
}
