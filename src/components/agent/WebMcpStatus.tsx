import { Braces } from 'lucide-react';

type WebMcpStatusProps = {
  compact?: boolean;
};

export function WebMcpStatus({ compact = false }: WebMcpStatusProps) {
  const availability = 'modelContext' in document ? 'ready' : 'unavailable';

  const statusLabel = availability === 'ready' ? 'Ready' : 'Unavailable';
  const statusColor =
    availability === 'ready' ? 'bg-emerald-400' : 'bg-slate-600';

  if (compact) {
    return (
      <div
        className="flex items-center gap-2 text-[11px] text-slate-400"
        title="Feature detection only. AetherSketch has not registered WebMCP tools yet."
      >
        <span
          className={`size-1.5 rounded-full ${statusColor}`}
          aria-hidden="true"
        />
        <span>WebMCP</span>
        <span className="text-slate-600">·</span>
        <span className="text-slate-500">{statusLabel}</span>
      </div>
    );
  }

  return (
    <div
      className="flex h-8 items-center gap-2 border border-slate-800 bg-[#0d121a] px-2.5 text-[11px] text-slate-400"
      title="Feature detection only. AetherSketch has not registered WebMCP tools yet."
    >
      <Braces className="size-3.5 text-slate-500" aria-hidden="true" />
      <span
        className={`size-1.5 rounded-full ${statusColor}`}
        aria-hidden="true"
      />
      <span className="font-medium">WebMCP</span>
      <span className="text-slate-600">{statusLabel}</span>
    </div>
  );
}
