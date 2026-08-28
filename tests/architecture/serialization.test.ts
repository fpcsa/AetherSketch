import { describe, expect, it } from 'vitest';

import {
  ARCHITECTURE_SCHEMA_VERSION,
  ArchitectureDomainError,
  validateArchitecture,
} from '../../src/architecture/model';
import { createComponentFromCatalog } from '../../src/architecture/catalog';
import {
  deserializeArchitecture,
  serializeArchitecture,
} from '../../src/architecture/serialization';
import { getArchitectureTemplate } from '../../src/templates';

describe('architecture serialization', () => {
  it.each(['__proto__', 'constructor', 'prototype'])(
    'rejects reserved %s keys in imported metadata without pollution',
    (key) => {
      const architecture = getArchitectureTemplate('ecommerce-production');
      const serialized = JSON.stringify({
        ...architecture,
        metadata: JSON.parse(`{"${key}":{"polluted":true}}`) as unknown,
      });
      expect(() => deserializeArchitecture(serialized)).toThrowError(
        expect.objectContaining({ code: 'INVALID_ARCHITECTURE' }),
      );
      expect(Object.prototype).not.toHaveProperty('polluted');
    },
  );

  it('rejects oversized and excessively nested imports before recursive schema parsing', () => {
    expect(() => deserializeArchitecture(' '.repeat(4_000_001))).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARCHITECTURE' }),
    );
    const architecture = getArchitectureTemplate('ecommerce-production');
    let metadata: Record<string, unknown> = { value: 'too deep' };
    for (let i = 0; i < 30; i += 1) metadata = { child: metadata };
    expect(() =>
      deserializeArchitecture(JSON.stringify({ ...architecture, metadata })),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_ARCHITECTURE' }));
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() =>
      validateArchitecture({ ...architecture, metadata: circular }),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_ARCHITECTURE' }));
  });

  it('round-trips a schema-versioned Architecture IR', () => {
    const architecture = getArchitectureTemplate('ecommerce-production');
    const serialized = serializeArchitecture(architecture);
    const restored = deserializeArchitecture(serialized);

    expect(restored).toEqual(architecture);
    expect(restored.schemaVersion).toBe(ARCHITECTURE_SCHEMA_VERSION);
  });

  it('round-trips trigger connections as a supported semantic type', () => {
    const architecture = getArchitectureTemplate('serverless-api');
    const connection = architecture.connections[0];
    expect(connection).toBeDefined();
    if (!connection) {
      return;
    }

    const architectureWithTrigger = {
      ...architecture,
      connections: [
        { ...connection, type: 'trigger' as const },
        ...architecture.connections.slice(1),
      ],
    };

    expect(
      deserializeArchitecture(serializeArchitecture(architectureWithTrigger))
        .connections[0]?.type,
    ).toBe('trigger');
  });

  it('round-trips typed AI components without losing configuration', () => {
    const architecture = getArchitectureTemplate('ecommerce-production');
    const context = {
      provider: architecture.provider.provider,
      region: architecture.region,
    };
    const model = createComponentFromCatalog(
      {
        id: 'serialization-ai-model',
        kind: 'serverless-ai',
        configuration: { modality: 'multimodal' },
      },
      context,
    );
    const agent = createComponentFromCatalog(
      {
        id: 'serialization-ai-agent',
        kind: 'ai-agent',
        configuration: { orchestrationMode: 'supervisor' },
      },
      context,
    );
    const restored = deserializeArchitecture(
      serializeArchitecture({
        ...architecture,
        components: [...architecture.components, model, agent],
      }),
    );

    const restoredModel = restored.components.find(
      (component) => component.id === model.id,
    );
    const restoredAgent = restored.components.find(
      (component) => component.id === agent.id,
    );

    expect(restoredModel?.kind).toBe('serverless-ai');
    if (restoredModel?.kind === 'serverless-ai') {
      expect(restoredModel.configuration.modality).toBe('multimodal');
    }
    expect(restoredAgent?.kind).toBe('ai-agent');
    if (restoredAgent?.kind === 'ai-agent') {
      expect(restoredAgent.configuration.orchestrationMode).toBe('supervisor');
    }
  });

  it('fails safely with a structured error for invalid JSON', () => {
    expect(() => deserializeArchitecture('{not valid json')).toThrowError(
      expect.objectContaining({
        name: 'ArchitectureDomainError',
        code: 'INVALID_ARCHITECTURE',
      }),
    );
  });

  it('rejects invalid schema versions and dangling connections', () => {
    const architecture = getArchitectureTemplate('serverless-api');

    expect(() =>
      validateArchitecture({ ...architecture, schemaVersion: 99 }),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_ARCHITECTURE' }));

    const invalid = {
      ...architecture,
      connections: [
        ...architecture.connections,
        {
          id: 'dangling-edge',
          source: architecture.components[0]?.id,
          target: 'missing-component',
          type: 'request',
          encrypted: true,
          critical: false,
          metadata: {},
        },
      ],
    };

    try {
      validateArchitecture(invalid);
      throw new Error('Expected validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(ArchitectureDomainError);
      expect(error).toMatchObject({ code: 'INVALID_ARCHITECTURE' });
      if (error instanceof ArchitectureDomainError) {
        expect(JSON.stringify(error.details)).toContain(
          'Connection target does not exist',
        );
      }
    }
  });
});
