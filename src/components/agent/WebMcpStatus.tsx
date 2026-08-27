import { Braces, Bug, Pencil, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';

import { type WebMcpLifecycleStatus, useWebMcpStore } from '../../webmcp';

type WebMcpStatusProps = {
  compact?: boolean;
};

const statusPresentation: Record<
  WebMcpLifecycleStatus,
  { label: string; dot: string; title: string }
> = {
  unavailable: {
    label: 'Unavailable',
    dot: 'bg-slate-600',
    title:
      'This browser does not expose document.modelContext. The human workspace remains fully available.',
  },
  initializing: {
    label: 'Initializing',
    dot: 'bg-amber-400',
    title:
      'The WebMCP API is available and read-tool registration is in progress.',
  },
  ready: {
    label: 'Ready',
    dot: 'bg-emerald-400',
    title:
      'Four read-only tools are registered on this page. This does not imply that an agent is connected.',
  },
  error: {
    label: 'Error',
    dot: 'bg-rose-400',
    title: 'The WebMCP API is available, but read-tool registration failed.',
  },
};

function JsonValue({ value }: { value: unknown }) {
  return (
    <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words border border-slate-800 bg-[#090d13] p-2 font-mono text-[10px] leading-relaxed text-slate-400">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function DebugPanel({ onClose }: { onClose: () => void }) {
  const mode = useWebMcpStore((state) => state.mode);
  const readTools = useWebMcpStore((state) => state.readTools);
  const editTools = useWebMcpStore((state) => state.editTools);
  const registrationError = useWebMcpStore((state) => state.registrationError);
  const editRegistrationError = useWebMcpStore(
    (state) => state.editRegistrationError,
  );
  const lastInvocation = useWebMcpStore((state) => state.lastInvocation);
  const lastResult = useWebMcpStore((state) => state.lastResult);
  const lastError = useWebMcpStore((state) => state.lastError);

  return (
    <section
      id="webmcp-debug-panel"
      aria-label="WebMCP diagnostics"
      className="absolute right-0 top-10 z-50 w-[min(26rem,calc(100vw-2rem))] border border-slate-700 bg-[#0d121a] p-3 text-left shadow-2xl shadow-black/40"
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-200">
            WebMCP diagnostics
          </p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-slate-500">
            Development only
          </p>
        </div>
        <button
          type="button"
          className="grid size-7 place-items-center border border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          aria-label="Close WebMCP diagnostics"
          onClick={onClose}
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2 text-[11px]">
        <dt className="text-slate-500">Mode</dt>
        <dd className="font-medium text-slate-300">
          {mode === 'review' ? 'Review Mode · read only' : 'Agent Edit Mode'}
        </dd>
        <dt className="text-slate-500">Read tools</dt>
        <dd className="text-slate-300">
          {readTools.length > 0 ? readTools.join(', ') : 'None registered'}
        </dd>
        <dt className="text-slate-500">Edit tools</dt>
        <dd className="text-slate-300">
          {editTools.length > 0 ? editTools.join(', ') : 'None registered'}
        </dd>
      </dl>

      {registrationError ? (
        <div className="mt-3">
          <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-rose-400">
            Registration error
          </p>
          <JsonValue value={{ message: registrationError }} />
        </div>
      ) : null}

      {editRegistrationError ? (
        <div className="mt-3">
          <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-rose-400">
            Edit registration error
          </p>
          <JsonValue value={{ message: editRegistrationError }} />
        </div>
      ) : null}

      <div className="mt-3 grid gap-3">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
            Last invocation
          </p>
          {lastInvocation ? (
            <JsonValue value={lastInvocation} />
          ) : (
            <p className="text-[11px] text-slate-600">No invocation yet.</p>
          )}
        </div>
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">
            Last result / error
          </p>
          {lastError ? (
            <JsonValue value={lastError} />
          ) : lastResult ? (
            <JsonValue value={lastResult} />
          ) : (
            <p className="text-[11px] text-slate-600">No result yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export function WebMcpStatus({ compact = false }: WebMcpStatusProps) {
  const [debugOpen, setDebugOpen] = useState(false);
  const status = useWebMcpStore((state) => state.status);
  const mode = useWebMcpStore((state) => state.mode);
  const editRegistrationStatus = useWebMcpStore(
    (state) => state.editRegistrationStatus,
  );
  const readToolCount = useWebMcpStore((state) => state.readTools.length);
  const editToolCount = useWebMcpStore((state) => state.editTools.length);
  const enableAgentEditing = useWebMcpStore(
    (state) => state.enableAgentEditing,
  );
  const disableAgentEditing = useWebMcpStore(
    (state) => state.disableAgentEditing,
  );
  const presentation = statusPresentation[status];
  const modeLabel =
    mode === 'review'
      ? 'Review Mode'
      : editRegistrationStatus === 'ready'
        ? 'Agent Editing Enabled'
        : editRegistrationStatus === 'error'
          ? 'Agent Editing Error'
          : 'Enabling Agent Editing';
  const readyDetail = status === 'ready';

  if (compact) {
    return (
      <div
        className="flex items-center gap-2 text-[11px] text-slate-400"
        title={presentation.title}
        role="status"
        aria-live="polite"
      >
        <span
          className={`size-1.5 rounded-full ${presentation.dot}`}
          aria-hidden="true"
        />
        <span>WebMCP</span>
        <span className="text-slate-600">·</span>
        <span className="text-slate-500">{presentation.label}</span>
        {readyDetail ? (
          <>
            <span className="text-slate-700">·</span>
            <span
              className={mode === 'edit' ? 'text-amber-400' : 'text-slate-500'}
            >
              {modeLabel}
            </span>
            <span className="text-slate-700">·</span>
            <span className="text-slate-600">{readToolCount} read tools</span>
            <span className="text-slate-700">·</span>
            <span className="text-slate-600">{editToolCount} edit tools</span>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative flex items-center">
      <div className="flex h-8 items-center border border-slate-800 bg-[#0d121a]">
        <div
          className="flex h-full items-center gap-2 px-2.5 text-[11px] text-slate-400"
          title={presentation.title}
          role="status"
          aria-live="polite"
        >
          <Braces className="size-3.5 text-slate-500" aria-hidden="true" />
          <span
            className={`size-1.5 rounded-full ${presentation.dot}`}
            aria-hidden="true"
          />
          <span className="font-medium">WebMCP</span>
          <span className="text-slate-600">{presentation.label}</span>
          {readyDetail ? (
            <>
              <span className="border-l border-slate-800 pl-2 text-slate-500 max-[1240px]:hidden">
                {modeLabel}
              </span>
              <span className="text-slate-600 max-[1240px]:hidden">
                {readToolCount} read / {editToolCount} edit
              </span>
            </>
          ) : null}
        </div>

        <button
          type="button"
          className={`flex h-full items-center gap-1.5 border-l px-2.5 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:text-slate-700 ${
            mode === 'edit'
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15'
              : 'border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
          }`}
          disabled={status !== 'ready'}
          aria-pressed={mode === 'edit'}
          aria-label={
            mode === 'edit' ? 'Disable Agent Editing' : 'Enable Agent Editing'
          }
          title={
            status === 'ready'
              ? mode === 'edit'
                ? 'Remove all five mutation tools. Existing architecture changes remain.'
                : 'Temporarily register five mutation tools for an authorized agent.'
              : 'Agent editing requires WebMCP support and successful read-tool registration.'
          }
          onClick={mode === 'edit' ? disableAgentEditing : enableAgentEditing}
        >
          {mode === 'edit' ? (
            <Pencil className="size-3" aria-hidden="true" />
          ) : (
            <ShieldCheck className="size-3" aria-hidden="true" />
          )}
          <span>
            {mode === 'edit'
              ? editRegistrationStatus === 'initializing'
                ? 'Enabling…'
                : 'Disable editing'
              : 'Enable editing'}
          </span>
        </button>
      </div>

      {import.meta.env.DEV ? (
        <button
          type="button"
          className="ml-1 grid size-8 place-items-center border border-slate-800 bg-[#0d121a] text-slate-500 hover:border-slate-700 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          aria-label="Toggle WebMCP diagnostics"
          aria-expanded={debugOpen}
          aria-controls="webmcp-debug-panel"
          onClick={() => setDebugOpen((open) => !open)}
        >
          <Bug className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}

      {import.meta.env.DEV && debugOpen ? (
        <DebugPanel onClose={() => setDebugOpen(false)} />
      ) : null}
    </div>
  );
}
