import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';

import type { ConnectionType } from '../../architecture/model';
import { useThemeStore } from '../../stores/theme-store';
import type { ArchitectureFlowEdge } from './flow-types';

const edgeVisuals = {
  request: {
    dark: '#38bdf8',
    light: '#0284c7',
    dash: undefined,
    label: 'Request',
  },
  async: {
    dark: '#fbbf24',
    light: '#b45309',
    dash: '7 5',
    label: 'Async',
  },
  data: {
    dark: '#34d399',
    light: '#059669',
    dash: undefined,
    label: 'Data',
  },
  replication: {
    dark: '#a78bfa',
    light: '#7c3aed',
    dash: '3 4',
    label: 'Replication',
  },
  trigger: {
    dark: '#f472b6',
    light: '#be185d',
    dash: '9 4 2 4',
    label: 'Trigger',
  },
  management: {
    dark: '#94a3b8',
    light: '#475569',
    dash: '2 5',
    label: 'Management',
  },
} satisfies Record<
  ConnectionType,
  {
    dark: string;
    light: string;
    dash: string | undefined;
    label: string;
  }
>;

export function ArchitectureEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  selected,
  data,
}: EdgeProps<ArchitectureFlowEdge>) {
  const theme = useThemeStore((state) => state.theme);
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 10,
  });
  const connection = data?.connection;
  if (!connection) {
    return null;
  }

  const visual = edgeVisuals[connection.type];
  const impacted = data.impacted;
  const impactState = data.impactState;
  const color = impacted
    ? impactState === 'failed'
      ? theme === 'dark'
        ? '#fb7185'
        : '#e11d48'
      : theme === 'dark'
        ? '#fbbf24'
        : '#b45309'
    : visual[theme];
  const impactLabel =
    impactState === 'failed'
      ? 'Failed path'
      : impactState === 'degraded'
        ? 'Reduced capacity'
        : visual.label;

  return (
    <>
      <g
        data-edge-id={id}
        data-impacted={impacted ? 'true' : 'false'}
        aria-label={`${visual.label} connection${impacted ? `, ${impactLabel}` : ''}`}
      >
        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={markerEnd}
          style={{
            stroke: color,
            strokeWidth: selected || impacted ? 2.4 : 1.5,
            strokeDasharray: impacted ? '5 4' : visual.dash,
            opacity: impacted ? 1 : selected ? 1 : 0.72,
          }}
        />
      </g>
      <EdgeLabelRenderer>
        <div
          className={`nodrag nopan pointer-events-none absolute max-w-[80px] border px-1.5 py-0.5 text-center text-[10px] leading-3 uppercase tracking-[0.04em] shadow-sm ${
            impacted
              ? impactState === 'failed'
                ? 'border-rose-400/40 bg-rose-950/95 text-rose-200'
                : 'border-amber-400/40 bg-amber-950/95 text-amber-200'
              : 'border-slate-700/80 bg-[#0b1119]/95 text-slate-500'
          }`}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          aria-label={`${visual.label} connection${impacted ? ', impacted by simulation' : ''}`}
        >
          {impacted ? impactLabel : visual.label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
