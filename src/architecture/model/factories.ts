import { ARCHITECTURE_SCHEMA_VERSION } from './types';
import type {
  Architecture,
  ArchitectureConstraints,
  CreateArchitectureInput,
} from './types';
import { validateArchitecture } from './validation';

export const DEFAULT_ARCHITECTURE_REGION = 'eu-west-1';

export const defaultArchitectureConstraints: ArchitectureConstraints = {
  requireMultiAZ: false,
  requireEncryptionAtRest: false,
};

export function createArchitectureId(): string {
  return `architecture-${crypto.randomUUID()}`;
}

export function createEmptyArchitecture(
  input: CreateArchitectureInput,
): Architecture {
  const timestamp = new Date().toISOString();

  return validateArchitecture({
    schemaVersion: ARCHITECTURE_SCHEMA_VERSION,
    revision: 0,
    id: input.id ?? createArchitectureId(),
    name: input.name,
    description: input.description ?? '',
    provider: input.provider ?? {
      provider: 'aws',
      environment: 'development',
    },
    region: input.region ?? DEFAULT_ARCHITECTURE_REGION,
    components: [],
    connections: [],
    constraints: {
      ...defaultArchitectureConstraints,
      ...input.constraints,
    },
    metadata: {
      createdAt: timestamp,
      updatedAt: timestamp,
      tags: [],
      ...input.metadata,
    },
  });
}

export function withIncrementedRevision(
  architecture: Architecture,
  updates: Partial<Omit<Architecture, 'schemaVersion' | 'revision' | 'id'>>,
): Architecture {
  return validateArchitecture({
    ...architecture,
    ...updates,
    revision: architecture.revision + 1,
    metadata: {
      ...architecture.metadata,
      ...updates.metadata,
      updatedAt: new Date().toISOString(),
    },
  });
}
