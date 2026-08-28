import { Handle, Position, type NodeProps } from '@xyflow/react';
import { CircleX, LockKeyhole, ShieldAlert, TriangleAlert } from 'lucide-react';

import { getCatalogEntry } from '../../architecture/catalog';
import { useWorkspaceUiStore } from '../../stores/workspace-ui-store';
import { getComponentVisual } from './component-visuals';
import type { ArchitectureFlowNode } from './flow-types';

const stateClasses = {
  normal: 'border-slate-700/90 bg-[#101720] shadow-black/30',
  failed:
    'border-rose-400/80 bg-rose-950/70 shadow-rose-950/50 ring-2 ring-rose-400/20',
  degraded:
    'border-amber-300/80 bg-amber-950/50 shadow-amber-950/40 ring-2 ring-amber-300/20',
} as const;

export function ArchitectureNode({
  data,
  selected,
  isConnectable,
}: NodeProps<ArchitectureFlowNode>) {
  const { component, simulationState } = data;
  const catalog = getCatalogEntry(component.kind);
  const catalogDescriptionMode = useWorkspaceUiStore(
    (state) => state.catalogDescriptionMode,
  );
  const visual = getComponentVisual(component.kind);
  const Icon = visual.Icon;
  const statusLabel =
    simulationState === 'failed'
      ? 'Failed'
      : simulationState === 'degraded'
        ? 'Degraded'
        : 'Operational';

  return (
    <article
      className={`group relative min-h-[104px] w-[216px] border shadow-lg transition-[border-color,box-shadow,background-color] ${stateClasses[simulationState]} ${selected ? 'ring-2 ring-cyan-300/70 ring-offset-2 ring-offset-[#090d13]' : ''}`}
      aria-label={`${component.name}${catalogDescriptionMode === 'aws' ? `, ${catalog.aws.displayName}` : ''}, ${statusLabel}${component.locked ? ', locked' : ''}${component.critical ? ', critical' : ''}`}
      data-component-id={component.id}
      data-simulation-state={simulationState}
    >
      {simulationState !== 'normal' ? (
        <div
          className={`absolute -right-1.5 -top-7 z-10 flex items-center gap-1 border px-1.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] shadow-lg ${
            simulationState === 'failed'
              ? 'border-rose-300/60 bg-rose-950/95 text-rose-200'
              : 'border-amber-300/60 bg-amber-950/95 text-amber-200'
          }`}
          aria-hidden="true"
        >
          {simulationState === 'failed' ? (
            <CircleX className="size-3" />
          ) : (
            <TriangleAlert className="size-3" />
          )}
          {statusLabel}
        </div>
      ) : null}

      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className="!size-2.5 !border-2 !border-[#090d13] !bg-slate-500 transition-colors group-hover:!bg-cyan-300"
        aria-label={`Connect into ${component.name}`}
      />

      <div className="flex min-h-[58px] items-start gap-2.5 px-3 pb-2 pt-3">
        <div
          className={`grid size-8 shrink-0 place-items-center border ${visual.className}`}
          title={visual.label}
        >
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <h3 className="min-w-0 flex-1 break-words text-[13px] font-semibold leading-[18px] text-slate-100">
              {component.name}
            </h3>
            {component.locked ? (
              <LockKeyhole
                className="mt-0.5 size-3 shrink-0 text-slate-500"
                aria-label="Locked"
              />
            ) : null}
            {component.critical ? (
              <ShieldAlert
                className="mt-0.5 size-3 shrink-0 text-rose-300"
                aria-label="Critical component"
              />
            ) : null}
          </div>
          {catalogDescriptionMode === 'aws' ? (
            <p className="mt-0.5 break-words text-[11px] leading-4 text-slate-500">
              {catalog.aws.displayName}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex h-7 items-center border-t border-slate-700/60 px-3 text-[10px] uppercase tracking-[0.1em]">
        <span
          className={
            simulationState === 'failed'
              ? 'text-rose-300'
              : simulationState === 'degraded'
                ? 'text-amber-300'
                : 'text-emerald-400/80'
          }
        >
          {simulationState !== 'normal' ? (
            simulationState === 'failed' ? (
              <CircleX className="mr-1 inline size-3" aria-hidden="true" />
            ) : (
              <TriangleAlert
                className="mr-1 inline size-3"
                aria-hidden="true"
              />
            )
          ) : null}
          {statusLabel}
        </span>
        <span className="ml-auto font-mono text-slate-600">
          {component.availabilityZones.length > 0
            ? `${component.availabilityZones.length} AZ`
            : component.region}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="!size-2.5 !border-2 !border-[#090d13] !bg-slate-500 transition-colors group-hover:!bg-cyan-300"
        aria-label={`Connect from ${component.name}`}
      />
    </article>
  );
}
