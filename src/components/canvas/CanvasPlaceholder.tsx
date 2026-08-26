import {
  BoxSelect,
  Focus,
  Grid3X3,
  Minus,
  MousePointer2,
  Plus,
} from 'lucide-react';

const canvasButtonClass =
  'grid size-7 place-items-center border border-transparent text-slate-600 disabled:cursor-not-allowed disabled:opacity-60';

export function CanvasPlaceholder() {
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
        <span className="text-[10px] text-slate-600">
          Untitled Architecture
        </span>

        <div className="ml-auto flex items-center gap-1">
          <div className="mr-2 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.12em] text-slate-700">
            <span
              className="size-1.5 rounded-full bg-amber-400/60"
              aria-hidden="true"
            />
            Foundation
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
          <div className="w-full max-w-[430px] border border-slate-800/90 bg-[#0c1118]/95 shadow-2xl shadow-black/20">
            <div className="flex h-9 items-center border-b border-slate-800 px-3">
              <BoxSelect
                className="size-3.5 text-cyan-400"
                aria-hidden="true"
              />
              <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Canvas foundation ready
              </span>
              <span className="ml-auto font-mono text-[9px] text-slate-700">
                0 nodes
              </span>
            </div>

            <div className="px-5 py-5">
              <h2 className="text-sm font-semibold tracking-[-0.01em] text-slate-200">
                A shared architecture workspace
              </h2>
              <p className="mt-2 max-w-[360px] text-[11px] leading-[1.65] text-slate-500">
                The shell is prepared for a provider-neutral architecture model
                and its XYFlow projection. Editing is intentionally deferred to
                the next product milestones.
              </p>

              <div className="mt-5 grid grid-cols-3 border border-slate-800/80">
                {['Domain IR', 'XYFlow view', 'Agent tools'].map(
                  (label, index) => (
                    <div
                      key={label}
                      className="relative border-r border-slate-800/80 px-3 py-3 last:border-r-0"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span className="font-mono text-[9px] text-slate-700">
                          0{index + 1}
                        </span>
                        <span
                          className="h-px flex-1 bg-slate-800"
                          aria-hidden="true"
                        />
                      </div>
                      <span className="text-[10px] font-medium text-slate-500">
                        {label}
                      </span>
                      <span className="mt-1 block text-[9px] text-slate-700">
                        Planned
                      </span>
                    </div>
                  ),
                )}
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
