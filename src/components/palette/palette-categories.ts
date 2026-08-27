import type { ComponentCategory } from '../../architecture/model';

export const paletteCategoryIds = [
  'network',
  'compute',
  'data',
  'integration',
  'ai',
  'platform',
] as const satisfies readonly ComponentCategory[];

export type PaletteCategoryId = ComponentCategory;

export type PaletteCategory = {
  id: PaletteCategoryId;
  label: string;
  description: string;
};

export const paletteCategories: readonly PaletteCategory[] = [
  {
    id: 'network',
    label: 'Network',
    description: 'Ingress, delivery, routing, and traffic controls',
  },
  {
    id: 'compute',
    label: 'Compute',
    description: 'Runtime services and execution environments',
  },
  {
    id: 'data',
    label: 'Data',
    description: 'Persistent stores, caches, and object storage',
  },
  {
    id: 'integration',
    label: 'Integration',
    description: 'Queues, events, and asynchronous workflows',
  },
  {
    id: 'ai',
    label: 'AI',
    description: 'Foundation models and autonomous agent orchestration',
  },
  {
    id: 'platform',
    label: 'Platform',
    description: 'Identity, secrets, and operational tooling',
  },
];
