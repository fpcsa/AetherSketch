import { X } from 'lucide-react';
import { useWebMcpStore } from '../../webmcp';
import { usePanelFocus } from '../layout/use-panel-focus';

const toolSummaries = [
  [
    'get_architecture',
    'Read-only',
    'Live graph, stable IDs, locks, constraints and cached metrics.',
  ],
  [
    'inspect_component',
    'Read-only',
    'Typed configuration and relationships for one component.',
  ],
  [
    'analyze_architecture',
    'Review',
    'Planning estimates and findings; opens Analysis and records activity.',
  ],
  [
    'simulate_failure',
    'Review',
    'Failure overlay and activity; leaves the architecture unchanged.',
  ],
  ['add_component', 'Edit', 'Add a typed component to the shared canvas.'],
  ['update_component', 'Edit', 'Change an unlocked component.'],
  [
    'remove_component',
    'Edit',
    'Remove an unlocked component and its incident edges.',
  ],
  ['connect_components', 'Edit', 'Create a unique typed connection.'],
  ['disconnect_components', 'Edit', 'Remove one connection by ID.'],
] as const;

export function ToolDirectory({ onClose }: { onClose: () => void }) {
  const registered = useWebMcpStore((state) => state.registeredTools);
  const status = useWebMcpStore((state) => state.status);
  const editStatus = useWebMcpStore((state) => state.editRegistrationStatus);
  const lastError = useWebMcpStore((state) => state.lastError);
  const panelRef = usePanelFocus(true, onClose);
  const error = lastError?.value as
    { code?: string; message?: string } | undefined;

  return (
    <section
      ref={panelRef}
      role="dialog"
      aria-label="WebMCP tool directory"
      className="fixed right-3 top-16 z-50 max-h-[calc(100dvh-9rem)] w-[min(28rem,calc(100vw-2rem))] overflow-auto whitespace-normal border border-slate-700 bg-[#0d121a] p-4 text-left shadow-2xl max-[1280px]:top-28"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-200">
          Live WebMCP tools · {registered.length} registered
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close tool directory"
          className="grid size-8 shrink-0 place-items-center text-slate-400 focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">
        Humans and agents use the same Architecture IR. Review never changes the
        graph. Only the human can grant editing, set constraints, or lock
        components.
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-400">
        Enabling editing registers five tools; disabling removes them
        immediately. Read-only tools change no state. Analysis and simulation
        update panels and activity.
      </p>
      {status === 'unavailable' ? (
        <p className="mt-2 text-xs text-amber-300">
          WebMCP is unavailable in this browser. All human editing controls
          still work.
        </p>
      ) : null}
      {status === 'error' || editStatus === 'error' ? (
        <p role="alert" className="mt-2 text-xs text-rose-300">
          Registration failed.{' '}
          {status === 'error'
            ? 'Reload the page to retry Review registration.'
            : 'Disable and re-enable editing to retry.'}
        </p>
      ) : null}
      <ul className="mt-3 divide-y divide-slate-800/80">
        {toolSummaries.map(([name, permission, description]) => (
          <li key={name} className="py-2">
            <div className="flex justify-between gap-2 text-xs">
              <code className="text-cyan-300">{name}</code>
              <span
                className={
                  registered.includes(name)
                    ? 'text-emerald-300'
                    : 'text-slate-500'
                }
              >
                {registered.includes(name) ? 'Registered' : 'Not registered'}
              </span>
            </div>
            <p className="mt-1 text-xs leading-4 text-slate-400">
              {permission} · {description}
            </p>
          </li>
        ))}
      </ul>
      {lastError ? (
        <p
          role="status"
          className="mt-2 break-words border border-rose-400/30 p-2 text-xs text-rose-300"
        >
          Last blocked tool: {lastError.toolName} · {error?.code ?? 'ERROR'}.{' '}
          {error?.message ?? 'See activity for details.'}
        </p>
      ) : null}
      <p className="mt-3 text-xs text-slate-500">
        Ready means registered, not an agent connection. Tool inputs use strict
        typed schemas; imported labels remain untrusted data. Escape closes this
        panel.
      </p>
    </section>
  );
}
