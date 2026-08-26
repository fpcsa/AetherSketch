import { ArrowRight, Trash2 } from 'lucide-react';

import type {
  ArchitectureConnection,
  ConnectionType,
} from '../../architecture/model';
import { useArchitectureStore } from '../../stores/architecture-store';
import { useWorkspaceUiStore } from '../../stores/workspace-ui-store';

const connectionTypes: readonly ConnectionType[] = [
  'request',
  'async',
  'data',
  'replication',
  'management',
];

const inputClass =
  'mt-1 h-8 w-full border border-slate-700 bg-[#0a0f16] px-2 text-[10px] text-slate-200 outline-none focus:border-cyan-400/70';

type ConnectionInspectorProps = {
  connection: ArchitectureConnection;
};

export function ConnectionInspector({ connection }: ConnectionInspectorProps) {
  const architecture = useArchitectureStore((state) => state.architecture);
  const updateConnection = useArchitectureStore(
    (state) => state.updateConnection,
  );
  const disconnectComponents = useArchitectureStore(
    (state) => state.disconnectComponents,
  );
  const clearSelection = useWorkspaceUiStore((state) => state.clearSelection);
  const source = architecture.components.find(
    (component) => component.id === connection.source,
  );
  const target = architecture.components.find(
    (component) => component.id === connection.target,
  );

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="border-b border-slate-800/80 px-3 py-3">
        <p className="text-[9px] font-semibold uppercase tracking-[0.11em] text-slate-600">
          Connection
        </p>
        <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-300">
          <span className="min-w-0 flex-1 truncate">
            {source?.name ?? connection.source}
          </span>
          <ArrowRight
            className="size-3 shrink-0 text-cyan-400"
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate text-right">
            {target?.name ?? connection.target}
          </span>
        </div>
      </div>

      <fieldset className="space-y-3 px-3 py-3">
        <legend className="sr-only">Connection properties</legend>
        <label className="block text-[9px] font-medium uppercase tracking-[0.1em] text-slate-600">
          Connection type
          <select
            className={inputClass}
            value={connection.type}
            onChange={(event) =>
              updateConnection(connection.id, {
                type: event.currentTarget.value as ConnectionType,
              })
            }
          >
            {connectionTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-[9px] font-medium uppercase tracking-[0.1em] text-slate-600">
          Protocol
          <input
            key={`${connection.id}:protocol:${connection.protocol ?? ''}`}
            className={inputClass}
            defaultValue={connection.protocol ?? ''}
            placeholder="HTTPS, PostgreSQL/TLS, SQS…"
            onBlur={(event) => {
              const protocol = event.currentTarget.value.trim();
              if (protocol !== (connection.protocol ?? '')) {
                updateConnection(connection.id, {
                  protocol: protocol || undefined,
                });
              }
            }}
          />
        </label>

        <label className="flex min-h-9 items-center justify-between border border-slate-800/70 bg-slate-900/20 px-2.5 text-[10px] text-slate-400">
          Encrypted transport
          <input
            type="checkbox"
            checked={connection.encrypted}
            onChange={(event) =>
              updateConnection(connection.id, {
                encrypted: event.currentTarget.checked,
              })
            }
            className="size-3.5 accent-cyan-400"
          />
        </label>

        <label className="flex min-h-9 items-center justify-between border border-slate-800/70 bg-slate-900/20 px-2.5 text-[10px] text-slate-400">
          Critical path
          <input
            type="checkbox"
            checked={connection.critical}
            onChange={(event) =>
              updateConnection(connection.id, {
                critical: event.currentTarget.checked,
              })
            }
            className="size-3.5 accent-rose-400"
          />
        </label>
      </fieldset>

      <div className="border-t border-slate-800/80 p-3">
        <button
          type="button"
          onClick={() => {
            disconnectComponents(connection.id);
            clearSelection();
          }}
          className="flex h-8 w-full items-center justify-center gap-1.5 border border-slate-700 text-[10px] font-medium text-slate-400 transition-colors hover:border-rose-400/50 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70"
        >
          <Trash2 className="size-3" aria-hidden="true" />
          Delete connection
        </button>
      </div>
    </div>
  );
}
