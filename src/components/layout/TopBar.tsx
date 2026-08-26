import { Boxes, Download, Redo2, Undo2, Upload } from 'lucide-react';

import { useArchitectureStore } from '../../stores/architecture-store';
import { WebMcpStatus } from '../agent/WebMcpStatus';

const iconButtonClass =
  'grid size-8 place-items-center border border-transparent text-slate-500 transition-colors enabled:hover:border-slate-700 enabled:hover:bg-slate-800 enabled:hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80';

export function TopBar() {
  const architectureName = useArchitectureStore(
    (state) => state.architecture.name,
  );
  const canUndo = useArchitectureStore((state) => state.past.length > 0);
  const canRedo = useArchitectureStore((state) => state.future.length > 0);
  const undo = useArchitectureStore((state) => state.undo);
  const redo = useArchitectureStore((state) => state.redo);

  return (
    <header className="flex h-[52px] shrink-0 items-center border-b border-slate-800/90 bg-[#0b0f15] px-3">
      <div className="flex min-w-0 items-center">
        <div
          className="mr-2.5 grid size-7 place-items-center bg-cyan-400 text-slate-950"
          aria-hidden="true"
        >
          <Boxes className="size-4" strokeWidth={2.25} />
        </div>
        <div className="flex items-baseline gap-2 whitespace-nowrap">
          <span className="text-[13px] font-semibold tracking-[-0.01em] text-slate-100">
            AetherSketch
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-600">
            Architecture Copilot
          </span>
        </div>
      </div>

      <div className="mx-4 h-5 w-px shrink-0 bg-slate-800" aria-hidden="true" />

      <div
        className="flex min-w-0 max-w-64 items-center gap-2 px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80"
        aria-label={`Current architecture: ${architectureName}`}
      >
        <span className="min-w-0">
          <span className="block truncate text-[12px] font-medium text-slate-300">
            {architectureName}
          </span>
          <span className="block text-[9px] uppercase tracking-[0.14em] text-slate-600">
            Workspace
          </span>
        </span>
      </div>

      <nav
        className="ml-auto flex items-center gap-1"
        aria-label="Workspace actions"
      >
        <div className="mr-1 flex items-center border-r border-slate-800 pr-2">
          <button
            type="button"
            className={iconButtonClass}
            aria-label="Undo"
            title={
              canUndo ? 'Undo last architecture change' : 'Nothing to undo'
            }
            onClick={() => undo()}
            disabled={!canUndo}
          >
            <Undo2 className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={iconButtonClass}
            aria-label="Redo"
            title={
              canRedo ? 'Redo last architecture change' : 'Nothing to redo'
            }
            onClick={() => redo()}
            disabled={!canRedo}
          >
            <Redo2 className="size-3.5" aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          className="flex h-8 items-center gap-1.5 border border-transparent px-2 text-[11px] font-medium text-slate-500 disabled:cursor-not-allowed disabled:opacity-45"
          aria-label="Import architecture (not available yet)"
          title="Import — available in the editor milestone"
          disabled
        >
          <Upload className="size-3.5" aria-hidden="true" />
          Import
        </button>
        <button
          type="button"
          className="flex h-8 items-center gap-1.5 border border-transparent px-2 text-[11px] font-medium text-slate-500 disabled:cursor-not-allowed disabled:opacity-45"
          aria-label="Export architecture (not available yet)"
          title="Export — available in the editor milestone"
          disabled
        >
          <Download className="size-3.5" aria-hidden="true" />
          Export
        </button>

        <div className="ml-2">
          <WebMcpStatus />
        </div>
      </nav>
    </header>
  );
}
