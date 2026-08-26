import { Check, Minus, Play, RotateCw, X } from 'lucide-react';

import type {
  ArchitectureConstraints,
  ConstraintResult,
} from '../../architecture';
import { useArchitectureStore } from '../../stores/architecture-store';
import { useIntelligenceStore } from '../../stores/intelligence-store';
import { useWorkspaceUiStore } from '../../stores/workspace-ui-store';

const inputClass =
  'mt-1 h-8 w-full border border-slate-700 bg-[#0a0f16] px-2 text-[10px] text-slate-200 outline-none placeholder:text-slate-700 focus:border-cyan-400/70';

const resultLabels: Record<ConstraintResult['id'], string> = {
  'cost-budget': 'Cost budget',
  'resilience-target': 'Resilience target',
  'security-target': 'Security target',
  'required-region': 'Required region',
  'multi-az-required': 'Multi-AZ',
  'encryption-at-rest-required': 'Encryption at rest',
};

export function ConstraintsPanel() {
  const constraints = useArchitectureStore(
    (state) => state.architecture.constraints,
  );
  const setConstraints = useArchitectureStore((state) => state.setConstraints);
  const analysis = useIntelligenceStore((state) => state.analysis);
  const analysisStale = useIntelligenceStore((state) => state.analysisStale);
  const runAnalysis = useIntelligenceStore((state) => state.runAnalysis);
  const setNotice = useWorkspaceUiStore((state) => state.setNotice);

  const commitConstraints = (updates: Partial<ArchitectureConstraints>) => {
    try {
      setConstraints(updates);
    } catch (error) {
      setNotice({
        kind: 'error',
        message:
          error instanceof Error ? error.message : 'Constraint update failed.',
      });
    }
  };

  const commitNumber = (
    key: 'maximumMonthlyCost' | 'targetResilienceScore' | 'targetSecurityScore',
    value: string,
  ) => {
    const parsed = value.trim() === '' ? undefined : Number(value);
    if (parsed === undefined || Number.isFinite(parsed)) {
      commitConstraints({ [key]: parsed });
    }
  };

  return (
    <div className="space-y-3 px-3 py-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[8px] font-medium uppercase tracking-[0.1em] text-slate-600">
          Maximum monthly cost
          <input
            key={`budget:${constraints.maximumMonthlyCost ?? ''}`}
            className={inputClass}
            type="number"
            min={0}
            placeholder="No limit"
            defaultValue={constraints.maximumMonthlyCost}
            onBlur={(event) =>
              commitNumber('maximumMonthlyCost', event.currentTarget.value)
            }
          />
        </label>
        <label className="block text-[8px] font-medium uppercase tracking-[0.1em] text-slate-600">
          Required region
          <input
            key={`region:${constraints.requiredRegion ?? ''}`}
            className={inputClass}
            placeholder="Any region"
            defaultValue={constraints.requiredRegion ?? ''}
            onBlur={(event) =>
              commitConstraints({
                requiredRegion: event.currentTarget.value.trim() || undefined,
              })
            }
          />
        </label>
        <label className="block text-[8px] font-medium uppercase tracking-[0.1em] text-slate-600">
          Target resilience
          <input
            key={`resilience:${constraints.targetResilienceScore ?? ''}`}
            className={inputClass}
            type="number"
            min={0}
            max={100}
            placeholder="0–100"
            defaultValue={constraints.targetResilienceScore}
            onBlur={(event) =>
              commitNumber('targetResilienceScore', event.currentTarget.value)
            }
          />
        </label>
        <label className="block text-[8px] font-medium uppercase tracking-[0.1em] text-slate-600">
          Target security
          <input
            key={`security:${constraints.targetSecurityScore ?? ''}`}
            className={inputClass}
            type="number"
            min={0}
            max={100}
            placeholder="0–100"
            defaultValue={constraints.targetSecurityScore}
            onBlur={(event) =>
              commitNumber('targetSecurityScore', event.currentTarget.value)
            }
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ConstraintToggle
          label="Require Multi-AZ"
          checked={constraints.requireMultiAZ}
          onChange={(requireMultiAZ) => commitConstraints({ requireMultiAZ })}
        />
        <ConstraintToggle
          label="Encryption at rest"
          checked={constraints.requireEncryptionAtRest}
          onChange={(requireEncryptionAtRest) =>
            commitConstraints({ requireEncryptionAtRest })
          }
        />
      </div>

      <div className="border border-slate-800/80 bg-slate-900/20">
        <div className="flex h-8 items-center border-b border-slate-800/70 px-2.5">
          <p className="text-[8px] font-semibold uppercase tracking-[0.11em] text-slate-600">
            Constraint evaluation
          </p>
          {analysisStale ? (
            <span className="ml-auto flex items-center gap-1 text-[8px] text-amber-300/80">
              <RotateCw className="size-2.5" aria-hidden="true" />
              Stale
            </span>
          ) : null}
        </div>

        {analysis ? (
          <ul className={analysisStale ? 'opacity-55' : ''}>
            {analysis.constraints.results.map((result) => {
              const Icon =
                result.status === 'met'
                  ? Check
                  : result.status === 'not-met'
                    ? X
                    : Minus;
              return (
                <li
                  key={result.id}
                  className="flex min-h-7 items-center gap-2 border-b border-slate-800/60 px-2.5 last:border-b-0"
                  title={result.message}
                >
                  <Icon
                    className={`size-3 ${
                      result.status === 'met'
                        ? 'text-emerald-400'
                        : result.status === 'not-met'
                          ? 'text-rose-400'
                          : 'text-slate-600'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="text-[9px] text-slate-500">
                    {resultLabels[result.id]}
                  </span>
                  <span className="ml-auto text-[8px] uppercase tracking-[0.08em] text-slate-600">
                    {result.status}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="p-3 text-[9px] text-slate-600">
            Run analysis to evaluate constraints.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => runAnalysis()}
        className="flex h-8 w-full items-center justify-center gap-1.5 border border-cyan-400/30 bg-cyan-400/8 text-[10px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80"
      >
        <Play className="size-3" aria-hidden="true" />
        {analysisStale ? 'Rerun analysis' : 'Run analysis'}
      </button>
    </div>
  );
}

function ConstraintToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-9 items-center justify-between gap-2 border border-slate-800/70 bg-slate-900/20 px-2 text-[9px] text-slate-500">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="size-3.5 accent-cyan-400"
      />
    </label>
  );
}
