import { Cloud, ShieldCheck } from 'lucide-react';

import { useIntelligenceStore } from '../../stores/intelligence-store';
import { WebMcpStatus } from '../agent/WebMcpStatus';

type StatusMetricProps = {
  label: string;
  value: string;
  detail: string;
};

function StatusMetric({ label, value, detail }: StatusMetricProps) {
  return (
    <div className="flex h-full items-center gap-2 border-r border-slate-800/80 px-4">
      <span className="text-[10px] uppercase tracking-[0.11em] text-slate-600">
        {label}
      </span>
      <span className="text-[11px] font-semibold tabular-nums text-slate-300">
        {value}
      </span>
      <span className="text-[10px] text-slate-600">{detail}</span>
    </div>
  );
}

export function StatusBar() {
  const analysis = useIntelligenceStore((state) => state.analysis);
  const analysisStale = useIntelligenceStore((state) => state.analysisStale);

  const cost = analysis?.estimatedMonthlyCost;
  const metricDetail = analysisStale ? 'stale — rerun analysis' : '/ 100';

  return (
    <footer
      className="flex h-8 shrink-0 items-center border-t border-slate-800/90 bg-[#0b0f15]"
      aria-label="Architecture status"
    >
      <StatusMetric
        label="Estimated architecture cost"
        value={cost === undefined ? '—' : `$${cost.toLocaleString('en-US')}`}
        detail={
          analysisStale ? 'stale planning estimate' : 'planning — not AWS quote'
        }
      />
      <StatusMetric
        label="Resilience"
        value={analysis?.resilienceScore.toString() ?? '—'}
        detail={metricDetail}
      />
      <StatusMetric
        label="Security"
        value={analysis?.securityScore.toString() ?? '—'}
        detail={metricDetail}
      />

      <div className="ml-auto flex h-full items-center gap-5 px-3">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
          <ShieldCheck className="size-3" aria-hidden="true" />
          No cloud credentials
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
          <Cloud className="size-3" aria-hidden="true" />
          Cloudflare-ready
        </div>
        <WebMcpStatus compact />
      </div>
    </footer>
  );
}
