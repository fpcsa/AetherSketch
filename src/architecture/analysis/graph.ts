import type {
  Architecture,
  ArchitectureComponent,
  ComponentKind,
  JsonValue,
} from '../model';

const entryKinds = new Set<ComponentKind>([
  'internet',
  'dns',
  'cdn',
  'api-gateway',
  'event-bus',
]);

const computeKinds = new Set<ComponentKind>([
  'virtual-machine',
  'container-service',
  'serverless-function',
  'worker',
  'serverless-ai',
  'ai-agent',
]);

const provisionedComputeKinds = new Set<ComponentKind>([
  'virtual-machine',
  'container-service',
]);

const dataKinds = new Set<ComponentKind>([
  'sql-database',
  'nosql-database',
  'cache',
  'object-storage',
]);

const globallyDistributedKinds = new Set<ComponentKind>([
  'internet',
  'dns',
  'cdn',
  'waf',
  'worker',
]);

export function isEntryComponent(component: ArchitectureComponent): boolean {
  if (entryKinds.has(component.kind)) {
    return true;
  }

  return (
    component.kind === 'load-balancer' &&
    component.configuration.scheme === 'internet-facing'
  );
}

export function isComputeComponent(component: ArchitectureComponent): boolean {
  return computeKinds.has(component.kind);
}

export function isProvisionedCompute(
  component: ArchitectureComponent,
): boolean {
  return provisionedComputeKinds.has(component.kind);
}

export function isDataComponent(component: ArchitectureComponent): boolean {
  return dataKinds.has(component.kind);
}

export function isGloballyDistributed(
  component: ArchitectureComponent,
): boolean {
  return globallyDistributedKinds.has(component.kind);
}

export function encryptionAtRestState(
  component: ArchitectureComponent,
): boolean | null {
  switch (component.kind) {
    case 'sql-database':
    case 'nosql-database':
    case 'cache':
    case 'object-storage':
    case 'queue':
    case 'secrets-manager':
    case 'serverless-ai':
    case 'ai-agent':
      return component.configuration.encrypted;
    default:
      return null;
  }
}

export function isMultiAzCapable(component: ArchitectureComponent): boolean {
  return (
    isProvisionedCompute(component) ||
    component.kind === 'sql-database' ||
    component.kind === 'cache'
  );
}

export function isComponentRedundant(
  component: ArchitectureComponent,
): boolean {
  if (isGloballyDistributed(component)) {
    return true;
  }

  switch (component.kind) {
    case 'sql-database':
      return (
        component.configuration.multiAZ &&
        component.availabilityZones.length >= 2
      );
    case 'container-service':
    case 'virtual-machine':
      return component.replicas >= 2 && component.availabilityZones.length >= 2;
    case 'cache':
      return (
        (component.replicas >= 2 || component.configuration.clusterMode) &&
        component.availabilityZones.length >= 2
      );
    case 'load-balancer':
      return component.availabilityZones.length >= 2;
    case 'serverless-function':
    case 'api-gateway':
    case 'nosql-database':
    case 'object-storage':
    case 'queue':
    case 'event-bus':
    case 'identity':
    case 'secrets-manager':
    case 'monitoring':
    case 'serverless-ai':
    case 'ai-agent':
      return true;
    default:
      return false;
  }
}

export function replicationPeers(
  architecture: Architecture,
  component: ArchitectureComponent,
): ArchitectureComponent[] {
  const peerIds = architecture.connections
    .filter(
      (connection) =>
        connection.type === 'replication' &&
        (connection.source === component.id ||
          connection.target === component.id),
    )
    .map((connection) =>
      connection.source === component.id
        ? connection.target
        : connection.source,
    );

  return peerIds
    .map((peerId) =>
      architecture.components.find((candidate) => candidate.id === peerId),
    )
    .filter(
      (candidate): candidate is ArchitectureComponent =>
        Boolean(candidate) && candidate?.kind === component.kind,
    );
}

export function hasIndependentReplicationPeer(
  architecture: Architecture,
  component: ArchitectureComponent,
  failedAvailabilityZone?: string,
): boolean {
  return replicationPeers(architecture, component).some((peer) => {
    if (failedAvailabilityZone) {
      return (
        !peer.availabilityZones.includes(failedAvailabilityZone) ||
        isComponentRedundant(peer)
      );
    }

    return (
      peer.availabilityZones.some(
        (zone) => !component.availabilityZones.includes(zone),
      ) || isComponentRedundant(peer)
    );
  });
}

export function isComponentRedundantInArchitecture(
  architecture: Architecture,
  component: ArchitectureComponent,
): boolean {
  return (
    isComponentRedundant(component) ||
    hasIndependentReplicationPeer(architecture, component)
  );
}

export function architectureEntryIds(architecture: Architecture): string[] {
  const incomingCounts = new Map(
    architecture.components.map((component) => [component.id, 0]),
  );

  for (const connection of architecture.connections) {
    if (incomingCounts.has(connection.target)) {
      incomingCounts.set(
        connection.target,
        (incomingCounts.get(connection.target) ?? 0) + 1,
      );
    }
  }

  return architecture.components
    .filter(
      (component) =>
        isEntryComponent(component) &&
        (incomingCounts.get(component.id) ?? 0) === 0,
    )
    .map((component) => component.id);
}

export function reachableComponentIds(
  architecture: Architecture,
  entryIds: readonly string[],
  failedIds: ReadonlySet<string> = new Set(),
): Set<string> {
  const componentIds = new Set(
    architecture.components
      .filter((component) => !failedIds.has(component.id))
      .map((component) => component.id),
  );
  const adjacency = new Map<string, string[]>();

  for (const connection of architecture.connections) {
    if (
      componentIds.has(connection.source) &&
      componentIds.has(connection.target)
    ) {
      const targets = adjacency.get(connection.source) ?? [];
      targets.push(connection.target);
      adjacency.set(connection.source, targets);
    }
  }

  const visited = new Set<string>();
  const queue = entryIds.filter((entryId) => componentIds.has(entryId));

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);
    for (const target of adjacency.get(current) ?? []) {
      if (!visited.has(target)) {
        queue.push(target);
      }
    }
  }

  return visited;
}

const secretKeyPattern =
  /(^|[-_])(password|passwd|secret|token|api[-_]?key|access[-_]?key)($|[-_])/i;

export function containsPotentialSecret(value: JsonValue): boolean {
  if (Array.isArray(value)) {
    return value.some(containsPotentialSecret);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).some(
      ([key, nested]) =>
        secretKeyPattern.test(key) || containsPotentialSecret(nested),
    );
  }

  return typeof value === 'string' && /^(sk-|AKIA)[A-Za-z0-9]/.test(value);
}
