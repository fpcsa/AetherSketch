import { Braces } from 'lucide-react';

type WebMcpStatusProps = {
  compact?: boolean;
};

export function WebMcpStatus({ compact = false }: WebMcpStatusProps) {
  if (compact) {
    return (
      <div
        className="flex items-center gap-2 text-[11px] text-slate-400"
        title="WebMCP tools are intentionally not registered in this foundation milestone."
      >
        <span
          className="size-1.5 rounded-full bg-slate-600"
          aria-hidden="true"
        />
        <span>WebMCP</span>
        <span className="text-slate-600">·</span>
        <span className="text-slate-500">Not registered</span>
      </div>
    );
  }

  return (
    <div
      className="flex h-8 items-center gap-2 border border-slate-800 bg-[#0d121a] px-2.5 text-[11px] text-slate-400"
      title="WebMCP tools are intentionally not registered in this foundation milestone."
    >
      <Braces className="size-3.5 text-slate-500" aria-hidden="true" />
      <span className="size-1.5 rounded-full bg-slate-600" aria-hidden="true" />
      <span className="font-medium">WebMCP</span>
      <span className="text-slate-600">Integration pending</span>
    </div>
  );
}
