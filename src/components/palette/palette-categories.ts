export const paletteCategoryIds = [
  'network',
  'compute',
  'data',
  'integration',
  'platform',
] as const;

export type PaletteCategoryId = (typeof paletteCategoryIds)[number];

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
    id: 'platform',
    label: 'Platform',
    description: 'Identity, secrets, and operational tooling',
  },
];
