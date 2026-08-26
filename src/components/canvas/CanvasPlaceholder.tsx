import {
  BoxSelect,
  Focus,
  Grid3X3,
  Minus,
  MousePointer2,
  Plus,
} from 'lucide-react';

import { getCatalogEntry } from '../../architecture/catalog';
import { useArchitectureStore } from '../../stores/architecture-store';

const canvasButtonClass =
  'grid size-7 place-items-center border border-transparent text-slate-600 disabled:cursor-not-allowed disabled:opacity-60';

export function CanvasPlaceholder() {
  const architecture = useArchitectureStore((state) => state.architecture);

  return (
    <section
      className="relative flex h-full min-h-0 flex-col overflow-hidden"
      aria-labelledby="canvas-title"
    >
      <div className="flex h-11 shrink-0 items-center border-b border-slate-800/80 bg-[#0b0f15]/95 px-3">
        <MousePointer2
          className="mr-2 size-3.5 text-cyan-400"
          aria-hidden="true"
        />
        <h1
          id="canvas-title"
          className="text-[11px] font-medium text-slate-300"
        >
          Architecture Canvas
        </h1>
        <span className="mx-2 text-slate-700" aria-hidden="true">
          /
        </span>
        <span className="text-[10px] text-slate-600">{architecture.name}</span>

        <div className="ml-auto flex items-center gap-1">
          <div className="mr-2 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.12em] text-slate-700">
            <span
              className="size-1.5 rounded-full bg-amber-400/60"
              aria-hidden="true"
            />
            Domain model active
          </div>
          <button
            type="button"
            className={canvasButtonClass}
            aria-label="Zoom out (not available yet)"
            title="Zoom out — enabled with the XYFlow editor"
            disabled
          >
            <Minus className="size-3.5" aria-hidden="true" />
          </button>
          <span className="w-9 text-center font-mono text-[9px] text-slate-600">
            100%
          </span>
          <button
            type="button"
            className={canvasButtonClass}
            aria-label="Zoom in (not available yet)"
            title="Zoom in — enabled with the XYFlow editor"
            disabled
          >
            <Plus className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={canvasButtonClass}
            aria-label="Fit canvas (not available yet)"
            title="Fit canvas — enabled with the XYFlow editor"
            disabled
          >
            <Focus className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="canvas-grid relative min-h-0 flex-1 overflow-hidden">
        <div className="canvas-axis canvas-axis-x" aria-hidden="true" />
        <div className="canvas-axis canvas-axis-y" aria-hidden="true" />

        <div className="absolute inset-0 grid place-items-center px-8 pb-8">
          <div className="w-full max-w-[760px] border border-slate-800/90 bg-[#0c1118]/95 shadow-2xl shadow-black/20">
            <div className="flex h-9 items-center border-b border-slate-800 px-3">
              <BoxSelect
                className="size-3.5 text-cyan-400"
                aria-hidden="true"
              />
              <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Canvas foundation ready
              </span>
              <span className="ml-auto font-mono text-[9px] text-slate-700">
                {architecture.components.length} nodes ·{' '}
                {architecture.connections.length} edges
              </span>
            </div>

            <div className="px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold tracking-[-0.01em] text-slate-200">
                    {architecture.name}
                  </h2>
                  <p className="mt-1 text-[10px] text-slate-600">
                    {architecture.provider.provider.toUpperCase()} ·{' '}
                    {architecture.region} · schema v{architecture.schemaVersion}
                  </p>
                </div>
                <span className="border border-emerald-400/20 bg-emerald-400/5 px-2 py-1 text-[9px] font-medium uppercase tracking-[0.1em] text-emerald-400/70">
                  IR source of truth
                </span>
              </div>

              <ol className="mt-5 flex items-stretch overflow-hidden border border-slate-800/80">
                {architecture.components.map((component, index) => {
                  const catalogEntry = getCatalogEntry(component.kind);
                  return (
                    <li
                      key={component.id}
                      className="relative min-w-0 flex-1 border-r border-slate-800/80 px-2.5 py-3 last:border-r-0"
                    >
                      <div className="mb-2 flex items-center gap-1.5">
                        <span className="font-mono text-[8px] text-cyan-400/60">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span
                          className="h-px flex-1 bg-slate-800"
                          aria-hidden="true"
                        />
                      </div>
                      <span className="block truncate text-[9px] font-medium text-slate-400">
                        {component.name}
                      </span>
                      <span className="mt-1 block truncate text-[8px] text-slate-700">
                        {catalogEntry.aws.displayName}
                      </span>
                    </li>
                  );
                })}
              </ol>

              <div className="mt-3 flex items-center justify-between text-[9px] text-slate-700">
                <span>
                  Read-only IR preview · XYFlow projection follows later
                </span>
                <span className="font-mono">rev {architecture.revision}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-3 left-3 flex h-7 items-center gap-2 border border-slate-800/80 bg-[#0b0f15]/90 px-2 text-[9px] text-slate-600">
          <Grid3X3 className="size-3" aria-hidden="true" />
          Grid 16 px
        </div>
      </div>
    </section>
  );
}
