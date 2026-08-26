import {
  CloudCog,
  Database,
  Network,
  RadioTower,
  ServerCog,
} from 'lucide-react';

import type {
  ComponentCategory,
  ComponentKind,
} from '../../architecture/model';
import { getCatalogEntry } from '../../architecture/catalog';

export const categoryVisuals = {
  network: {
    Icon: Network,
    label: 'Network',
    accent: '#22d3ee',
    className: 'text-cyan-300 bg-cyan-400/10 border-cyan-400/20',
  },
  compute: {
    Icon: ServerCog,
    label: 'Compute',
    accent: '#a78bfa',
    className: 'text-violet-300 bg-violet-400/10 border-violet-400/20',
  },
  data: {
    Icon: Database,
    label: 'Data',
    accent: '#34d399',
    className: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20',
  },
  integration: {
    Icon: RadioTower,
    label: 'Integration',
    accent: '#fbbf24',
    className: 'text-amber-300 bg-amber-400/10 border-amber-400/20',
  },
  platform: {
    Icon: CloudCog,
    label: 'Platform',
    accent: '#60a5fa',
    className: 'text-blue-300 bg-blue-400/10 border-blue-400/20',
  },
} satisfies Record<
  ComponentCategory,
  {
    Icon: typeof Network;
    label: string;
    accent: string;
    className: string;
  }
>;

export function getComponentVisual(kind: ComponentKind) {
  return categoryVisuals[getCatalogEntry(kind).category];
}
