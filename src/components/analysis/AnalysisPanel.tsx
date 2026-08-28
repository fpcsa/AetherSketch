import { AlertTriangle, Eraser, Play, RotateCw } from 'lucide-react';

import type {
  ArchitectureFinding,
  FindingSeverity,
} from '../../architecture/analysis';
import { useArchitectureStore } from '../../stores/architecture-store';
import { useIntelligenceStore } from '../../stores/intelligence-store';
import { useWorkspaceUiStore } from '../../stores/workspace-ui-store';

const severityOrder: readonly FindingSeverity[] = [
  'critical',
  'high',
  'medium',
  'low',
  'info',
];

const severityClasses: Record<FindingSeverity, string> = {
  critical: 'border-rose-400/40 bg-rose-400/10 text-rose-200',
  high: 'border-orange-400/35 bg-orange-400/10 text-orange-200',
  medium: 'border-amber-400/30 bg-amber-400/8 text-amber-200',
  low: 'border-blue-400/25 bg-blue-400/8 text-blue-200',
  info: 'border-slate-600 bg-slate-800/40 text-slate-400',
};

export function AnalysisPanel() {
  const architecture = useArchitectureStore((state) => state.architecture);
  const analysis = useIntelligenceStore((state) => state.analysis);
  const analysisStale = useIntelligenceStore((state) => state.analysisStale);
  const runAnalysis = useIntelligenceStore((state) => state.runAnalysis);
  const clearAnalysis = useIntelligenceStore((state) => state.clearAnalysis);
  const focusComponent = useWorkspaceUiStore((state) => state.focusComponent);
  const selectConnection = useWorkspaceUiStore(
    (state) => state.selectConnection,
  );

  const findingsBySeverity = severityOrder
    .map((severity) => ({
      severity,
      findings:
        analysis?.findings.filter((finding) => finding.severity === severity) ??
        [],
    }))
    .filter((group) => group.findings.length > 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-3 border-b border-slate-800/80">
        <Metric
          label="Estimated cost"
          value={
            analysis
              ? `$${analysis.estimatedMonthlyCost.toLocaleString('en-US')}`
              : '—'
          }
          detail="monthly"
        />
        <Metric
          label="Resilience"
          value={analysis?.resilienceScore.toString() ?? '—'}
          detail="/ 100"
          progress={analysis?.resilienceScore}
        />
        <Metric
          label="Security"
          value={analysis?.securityScore.toString() ?? '—'}
          detail="/ 100"
          progress={analysis?.securityScore}
        />
      </div>

      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-slate-800/80 px-3">
        <button
          type="button"
          onClick={() => runAnalysis()}
          className="flex h-7 items-center gap-1.5 border border-cyan-400/30 bg-cyan-400/8 px-2.5 text-[11px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80"
        >
          {analysisStale ? (
            <RotateCw className="size-3" aria-hidden="true" />
          ) : (
            <Play className="size-3" aria-hidden="true" />
          )}
          {analysisStale ? 'Rerun' : 'Run analysis'}
        </button>
        {analysis ? (
          <button
            type="button"
            onClick={clearAnalysis}
            className="grid size-7 place-items-center border border-slate-800 text-slate-600 transition-colors hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80"
            aria-label="Clear analysis"
            title="Clear analysis results"
          >
            <Eraser className="size-3" aria-hidden="true" />
          </button>
        ) : null}
        <span className="ml-auto text-[10px] uppercase tracking-[0.1em] text-slate-600">
          {analysisStale
            ? 'Results stale'
            : analysis
              ? `${analysis.findings.length} findings`
              : 'Not run'}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {analysis ? (
          <>
            {analysisStale ? (
              <div className="mb-3 flex items-start gap-2 border border-amber-400/25 bg-amber-400/5 p-2.5 text-[11px] leading-4 text-amber-200/80">
                <AlertTriangle
                  className="mt-0.5 size-3 shrink-0"
                  aria-hidden="true"
                />
                Architecture revision {architecture.revision} differs from this
                result. Rerun before making decisions.
              </div>
            ) : null}

            {findingsBySeverity.length > 0 ? (
              <div className="space-y-4">
                {findingsBySeverity.map((group) => (
                  <section key={group.severity}>
                    <div className="mb-1.5 flex items-center gap-2">
                      <span
                        className={`border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${severityClasses[group.severity]}`}
                      >
                        {group.severity}
                      </span>
                      <span className="text-[10px] text-slate-700">
                        {group.findings.length}
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {group.findings.map((finding) => (
                        <FindingItem
                          key={finding.id}
                          finding={finding}
                          componentName={
                            architecture.components.find(
                              (component) =>
                                component.id === finding.componentId,
                            )?.name
                          }
                          onSelect={() => {
                            if (finding.componentId) {
                              focusComponent(finding.componentId);
                            } else if (finding.edgeId) {
                              selectConnection(finding.edgeId);
                            }
                          }}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : (
              <p className="border border-emerald-400/20 bg-emerald-400/5 p-3 text-[12px] text-emerald-300/80">
                No findings for this analysis focus.
              </p>
            )}
          </>
        ) : (
          <div className="grid min-h-52 place-items-center text-center">
            <div className="max-w-52">
              <AlertTriangle
                className="mx-auto size-5 text-slate-700"
                aria-hidden="true"
              />
              <p className="mt-3 text-[12px] font-medium text-slate-400">
                No analysis results
              </p>
              <p className="mt-1 text-[11px] leading-4 text-slate-700">
                Run deterministic analysis to inspect cost, resilience,
                security, and structural findings.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  progress,
}: {
  label: string;
  value: string;
  detail: string;
  progress?: number;
}) {
  return (
    <div className="border-r border-slate-800/80 px-2 py-2.5 last:border-r-0">
      <p className="min-h-8 text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-600">
        {label}
      </p>
      <p className="mt-1 text-[13px] font-semibold tabular-nums text-slate-200">
        {value}{' '}
        <span className="text-[10px] font-normal text-slate-700">{detail}</span>
      </p>
      {progress === undefined ? (
        <div className="mt-1.5 h-0.5 bg-slate-800" aria-hidden="true" />
      ) : (
        <div
          className="mt-1.5 h-0.5 bg-slate-800"
          role="progressbar"
          aria-label={`${label} score`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div
            className={`h-full ${progress >= 80 ? 'bg-emerald-400' : progress >= 60 ? 'bg-amber-400' : 'bg-rose-400'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

function FindingItem({
  finding,
  componentName,
  onSelect,
}: {
  finding: ArchitectureFinding;
  componentName?: string;
  onSelect: () => void;
}) {
  const selectable = Boolean(finding.componentId || finding.edgeId);
  return (
    <li>
      <button
        type="button"
        disabled={!selectable}
        onClick={onSelect}
        className="w-full border border-slate-800/80 bg-slate-900/25 p-2.5 text-left transition-colors enabled:hover:border-cyan-400/35 enabled:hover:bg-cyan-400/5 disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
        title={
          selectable
            ? 'Select affected architecture element'
            : finding.remediation
        }
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-600">
            {finding.category}
          </span>
          <span className="min-w-0 break-all font-mono text-[10px] text-slate-700">
            {finding.code}
          </span>
        </div>
        <p className="mt-1 text-[12px] font-medium leading-4 text-slate-300">
          {finding.title}
        </p>
        {componentName ? (
          <p className="mt-0.5 text-[11px] text-cyan-400/80">{componentName}</p>
        ) : null}
        <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-600">
          {finding.message}
        </p>
      </button>
    </li>
  );
}
