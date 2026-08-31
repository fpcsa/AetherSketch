import { analyzeArchitecture } from '../analysis';
import type {
  Architecture,
  ArchitectureComponent,
  ArchitectureConnection,
} from '../model';

export type ArchitectureMetricSnapshot = {
  estimatedMonthlyCost: number;
  resilienceScore: number | null;
  securityScore: number | null;
};

export type ArchitectureDiffEntity =
  'architecture' | 'component' | 'connection';

export type ArchitectureDiffItem = {
  id: string;
  entity: ArchitectureDiffEntity;
  label: string;
  fields: string[];
};

export type ArchitectureComparison = {
  baselineRevision: number;
  currentRevision: number;
  before: ArchitectureMetricSnapshot;
  after: ArchitectureMetricSnapshot;
  delta: ArchitectureMetricSnapshot;
  added: ArchitectureDiffItem[];
  changed: ArchitectureDiffItem[];
  removed: ArchitectureDiffItem[];
  hasChanges: boolean;
};

function equal(left: unknown, right: unknown): boolean {
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, item]) => [key, normalize(item)]),
      );
    }
    return value;
  };
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

function componentChangedFields(
  before: ArchitectureComponent,
  after: ArchitectureComponent,
): string[] {
  const fields: string[] = [];
  const scalarFields = [
    'name',
    'kind',
    'provider',
    'service',
    'region',
    'availabilityZones',
    'replicas',
    'estimatedMonthlyCost',
    'locked',
    'critical',
    'position',
    'network',
  ] as const;

  for (const field of scalarFields) {
    if (!equal(before[field], after[field])) {
      fields.push(field);
    }
  }

  const beforeConfiguration = before.configuration as Record<string, unknown>;
  const afterConfiguration = after.configuration as Record<string, unknown>;
  const configurationKeys = new Set([
    ...Object.keys(beforeConfiguration),
    ...Object.keys(afterConfiguration),
  ]);
  for (const key of [...configurationKeys].sort()) {
    if (!equal(beforeConfiguration[key], afterConfiguration[key])) {
      fields.push(`configuration.${key}`);
    }
  }

  return fields;
}

function connectionChangedFields(
  before: ArchitectureConnection,
  after: ArchitectureConnection,
): string[] {
  const fields = [
    'source',
    'target',
    'type',
    'protocol',
    'encrypted',
    'critical',
  ] as const;
  return [
    ...fields.filter((field) => !equal(before[field], after[field])),
    ...(['sourcePort', 'targetPort'] as const).filter((field) => {
      const fallback = field === 'sourcePort' ? 'right' : 'left';
      return (before[field] ?? fallback) !== (after[field] ?? fallback);
    }),
  ];
}

function connectionLabel(
  architecture: Architecture,
  connection: ArchitectureConnection,
): string {
  const source = architecture.components.find(
    (component) => component.id === connection.source,
  )?.name;
  const target = architecture.components.find(
    (component) => component.id === connection.target,
  )?.name;
  return `${source ?? connection.source} → ${target ?? connection.target}`;
}

function sortItems(items: ArchitectureDiffItem[]): ArchitectureDiffItem[] {
  return items.sort(
    (left, right) =>
      left.entity.localeCompare(right.entity) ||
      left.label.localeCompare(right.label) ||
      left.id.localeCompare(right.id),
  );
}

function metrics(architecture: Architecture): ArchitectureMetricSnapshot {
  const analysis = analyzeArchitecture(architecture);
  return {
    estimatedMonthlyCost: analysis.estimatedMonthlyCost,
    resilienceScore: analysis.resilienceScore,
    securityScore: analysis.securityScore,
  };
}

export function compareArchitectures(
  baseline: Architecture,
  current: Architecture,
): ArchitectureComparison {
  const before = metrics(baseline);
  const after = metrics(current);
  const baselineComponents = new Map(
    baseline.components.map((component) => [component.id, component]),
  );
  const currentComponents = new Map(
    current.components.map((component) => [component.id, component]),
  );
  const baselineConnections = new Map(
    baseline.connections.map((connection) => [connection.id, connection]),
  );
  const currentConnections = new Map(
    current.connections.map((connection) => [connection.id, connection]),
  );
  const added: ArchitectureDiffItem[] = [];
  const changed: ArchitectureDiffItem[] = [];
  const removed: ArchitectureDiffItem[] = [];

  for (const component of current.components) {
    const previous = baselineComponents.get(component.id);
    if (!previous) {
      added.push({
        id: component.id,
        entity: 'component',
        label: component.name,
        fields: [component.kind],
      });
      continue;
    }
    const fields = componentChangedFields(previous, component);
    if (fields.length > 0) {
      changed.push({
        id: component.id,
        entity: 'component',
        label: component.name,
        fields,
      });
    }
  }

  for (const component of baseline.components) {
    if (!currentComponents.has(component.id)) {
      removed.push({
        id: component.id,
        entity: 'component',
        label: component.name,
        fields: [component.kind],
      });
    }
  }

  for (const connection of current.connections) {
    const previous = baselineConnections.get(connection.id);
    if (!previous) {
      added.push({
        id: connection.id,
        entity: 'connection',
        label: connectionLabel(current, connection),
        fields: [connection.type],
      });
      continue;
    }
    const fields = connectionChangedFields(previous, connection);
    if (fields.length > 0) {
      changed.push({
        id: connection.id,
        entity: 'connection',
        label: connectionLabel(current, connection),
        fields,
      });
    }
  }

  for (const connection of baseline.connections) {
    if (!currentConnections.has(connection.id)) {
      removed.push({
        id: connection.id,
        entity: 'connection',
        label: connectionLabel(baseline, connection),
        fields: [connection.type],
      });
    }
  }

  const architectureFields = [
    'name',
    'description',
    'provider',
    'region',
    'constraints',
  ] as const;
  const changedArchitectureFields = architectureFields.filter(
    (field) => !equal(baseline[field], current[field]),
  );
  if (changedArchitectureFields.length > 0) {
    changed.push({
      id: current.id,
      entity: 'architecture',
      label: current.name,
      fields: changedArchitectureFields,
    });
  }

  sortItems(added);
  sortItems(changed);
  sortItems(removed);

  return {
    baselineRevision: baseline.revision,
    currentRevision: current.revision,
    before,
    after,
    delta: {
      estimatedMonthlyCost:
        after.estimatedMonthlyCost - before.estimatedMonthlyCost,
      resilienceScore:
        after.resilienceScore === null || before.resilienceScore === null
          ? null
          : after.resilienceScore - before.resilienceScore,
      securityScore:
        after.securityScore === null || before.securityScore === null
          ? null
          : after.securityScore - before.securityScore,
    },
    added,
    changed,
    removed,
    hasChanges: added.length + changed.length + removed.length > 0,
  };
}
