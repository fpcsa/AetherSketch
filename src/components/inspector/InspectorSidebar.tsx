import {
  BoxSelect,
  ChevronDown,
  Gauge,
  LockKeyhole,
  Settings2,
} from 'lucide-react';

import { useArchitectureStore } from '../../stores/architecture-store';

type ConstraintRowProps = {
  label: string;
  value: string;
};

function ConstraintRow({ label, value }: ConstraintRowProps) {
  return (
    <div className="flex min-h-9 items-center justify-between border-b border-slate-800/60 py-2 last:border-b-0">
      <span className="text-[10px] text-slate-500">{label}</span>
      <span className="font-mono text-[10px] text-slate-700">{value}</span>
    </div>
  );
}

export function InspectorSidebar() {
  const constraints = useArchitectureStore(
    (state) => state.architecture.constraints,
  );

  return (
    <aside
      className="flex min-h-0 flex-col border-l border-slate-800/90 bg-[#0b0f15]"
      aria-label="Architecture details"
    >
      <section
        className="flex min-h-0 flex-[1.05] flex-col"
        aria-labelledby="inspector-title"
      >
        <div className="flex h-11 shrink-0 items-center border-b border-slate-800/80 px-3">
          <Settings2
            className="mr-2 size-3.5 text-slate-600"
            aria-hidden="true"
          />
          <h2
            id="inspector-title"
            className="text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-400"
          >
            Inspector
          </h2>
          <span className="ml-auto text-[9px] uppercase tracking-[0.12em] text-slate-700">
            No selection
          </span>
        </div>

        <div className="grid min-h-0 flex-1 place-items-center p-5 text-center">
          <div className="max-w-48">
            <div className="mx-auto grid size-10 place-items-center border border-slate-800 bg-slate-900/30">
              <BoxSelect className="size-4 text-slate-600" aria-hidden="true" />
            </div>
            <p className="mt-3 text-[11px] font-medium text-slate-400">
              Nothing selected
            </p>
            <p className="mt-1.5 text-[10px] leading-4 text-slate-700">
              Component and connection properties will appear here when the
              editor is enabled.
            </p>
          </div>
        </div>
      </section>

      <section
        className="flex min-h-0 flex-1 flex-col border-t border-slate-800/90"
        aria-labelledby="constraints-title"
      >
        <div className="flex h-11 shrink-0 items-center border-b border-slate-800/80 px-3">
          <Gauge className="mr-2 size-3.5 text-slate-600" aria-hidden="true" />
          <h2
            id="constraints-title"
            className="text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-400"
          >
            Architecture Constraints
          </h2>
          <ChevronDown
            className="ml-auto size-3.5 text-slate-700"
            aria-hidden="true"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-3 py-2">
          <ConstraintRow
            label="Maximum monthly cost"
            value={
              constraints.maximumMonthlyCost === undefined
                ? 'Not set'
                : `$${constraints.maximumMonthlyCost.toLocaleString('en-US')}`
            }
          />
          <ConstraintRow
            label="Target resilience"
            value={
              constraints.targetResilienceScore === undefined
                ? 'Not set'
                : `${constraints.targetResilienceScore} / 100`
            }
          />
          <ConstraintRow
            label="Target security"
            value={
              constraints.targetSecurityScore === undefined
                ? 'Not set'
                : `${constraints.targetSecurityScore} / 100`
            }
          />
          <ConstraintRow
            label="Required region"
            value={constraints.requiredRegion ?? 'Any'}
          />
          <ConstraintRow
            label="Multi-AZ required"
            value={constraints.requireMultiAZ ? 'Required' : 'Optional'}
          />
          <ConstraintRow
            label="Encryption at rest"
            value={
              constraints.requireEncryptionAtRest ? 'Required' : 'Optional'
            }
          />

          <div className="mt-3 flex items-start gap-2 border border-slate-800/70 bg-slate-900/20 p-2.5">
            <LockKeyhole
              className="mt-0.5 size-3 shrink-0 text-slate-600"
              aria-hidden="true"
            />
            <p className="text-[9px] leading-4 text-slate-700">
              Constraints are stored in the Architecture IR and remain
              human-controlled. Editing controls arrive with the visual editor.
            </p>
          </div>
        </div>
      </section>
    </aside>
  );
}
