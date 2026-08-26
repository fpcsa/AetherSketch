import { Activity, BoxSelect, Gauge, Settings2, Siren } from 'lucide-react';

import { useArchitectureStore } from '../../stores/architecture-store';
import {
  useWorkspaceUiStore,
  type WorkspacePanel,
} from '../../stores/workspace-ui-store';
import { AnalysisPanel } from '../analysis/AnalysisPanel';
import { SimulationPanel } from '../simulation/SimulationPanel';
import { ComponentInspector } from './ComponentInspector';
import { ConnectionInspector } from './ConnectionInspector';
import { ConstraintsPanel } from './ConstraintsPanel';

const tabs: readonly {
  id: WorkspacePanel;
  label: string;
  Icon: typeof Settings2;
}[] = [
  { id: 'inspector', label: 'Inspect', Icon: Settings2 },
  { id: 'analysis', label: 'Analyze', Icon: Activity },
  { id: 'simulation', label: 'Simulate', Icon: Siren },
];

export function InspectorSidebar() {
  const architecture = useArchitectureStore((state) => state.architecture);
  const selectedComponentId = useWorkspaceUiStore(
    (state) => state.selectedComponentId,
  );
  const selectedConnectionId = useWorkspaceUiStore(
    (state) => state.selectedConnectionId,
  );
  const activePanel = useWorkspaceUiStore((state) => state.activePanel);
  const setActivePanel = useWorkspaceUiStore((state) => state.setActivePanel);
  const selectedComponent = architecture.components.find(
    (component) => component.id === selectedComponentId,
  );
  const selectedConnection = architecture.connections.find(
    (connection) => connection.id === selectedConnectionId,
  );

  return (
    <aside
      className="flex min-h-0 flex-col border-l border-slate-800/90 bg-[#0b0f15]"
      aria-label="Architecture details"
    >
      <nav
        className="grid h-10 shrink-0 grid-cols-3 border-b border-slate-800/90"
        aria-label="Workspace detail panels"
      >
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActivePanel(id)}
            className={`flex items-center justify-center gap-1.5 border-b-2 text-[9px] font-semibold uppercase tracking-[0.09em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400/80 ${
              activePanel === id
                ? 'border-cyan-400 bg-cyan-400/5 text-cyan-200'
                : 'border-transparent text-slate-600 hover:bg-slate-900/50 hover:text-slate-300'
            }`}
            aria-current={activePanel === id ? 'page' : undefined}
          >
            <Icon className="size-3" aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>

      {activePanel === 'analysis' ? <AnalysisPanel /> : null}
      {activePanel === 'simulation' ? <SimulationPanel /> : null}
      {activePanel === 'inspector' ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <section
            className="flex min-h-0 flex-[1.15] flex-col"
            aria-labelledby="inspector-title"
          >
            <div className="flex h-9 shrink-0 items-center border-b border-slate-800/80 px-3">
              <Settings2
                className="mr-2 size-3.5 text-slate-600"
                aria-hidden="true"
              />
              <h2
                id="inspector-title"
                className="text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-400"
              >
                Inspector
              </h2>
              <span className="ml-auto text-[8px] uppercase tracking-[0.1em] text-slate-700">
                {selectedComponent
                  ? 'Component'
                  : selectedConnection
                    ? 'Connection'
                    : 'No selection'}
              </span>
            </div>

            {selectedComponent ? (
              <ComponentInspector component={selectedComponent} />
            ) : selectedConnection ? (
              <ConnectionInspector connection={selectedConnection} />
            ) : (
              <div className="grid min-h-0 flex-1 place-items-center p-5 text-center">
                <div className="max-w-52">
                  <div className="mx-auto grid size-10 place-items-center border border-slate-800 bg-slate-900/30">
                    <BoxSelect
                      className="size-4 text-slate-600"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-3 text-[10px] font-medium text-slate-400">
                    Select an architecture element
                  </p>
                  <p className="mt-1.5 text-[9px] leading-4 text-slate-700">
                    Click a node or edge to edit its typed properties. Connect
                    nodes by dragging between their ports.
                  </p>
                  <p className="mt-3 font-mono text-[8px] text-slate-700">
                    {architecture.components.length} components ·{' '}
                    {architecture.connections.length} connections
                  </p>
                </div>
              </div>
            )}
          </section>

          <section
            className="flex min-h-0 flex-1 flex-col border-t border-slate-800/90"
            aria-labelledby="constraints-title"
          >
            <div className="flex h-9 shrink-0 items-center border-b border-slate-800/80 px-3">
              <Gauge
                className="mr-2 size-3.5 text-slate-600"
                aria-hidden="true"
              />
              <h2
                id="constraints-title"
                className="text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-400"
              >
                Architecture Constraints
              </h2>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <ConstraintsPanel />
            </div>
          </section>
        </div>
      ) : null}
    </aside>
  );
}
