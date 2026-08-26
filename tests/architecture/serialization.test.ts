import { describe, expect, it } from 'vitest';

import {
  ARCHITECTURE_SCHEMA_VERSION,
  ArchitectureDomainError,
  validateArchitecture,
} from '../../src/architecture/model';
import {
  deserializeArchitecture,
  serializeArchitecture,
} from '../../src/architecture/serialization';
import { getArchitectureTemplate } from '../../src/templates';

describe('architecture serialization', () => {
  it('round-trips a schema-versioned Architecture IR', () => {
    const architecture = getArchitectureTemplate('ecommerce-production');
    const serialized = serializeArchitecture(architecture);
    const restored = deserializeArchitecture(serialized);

    expect(restored).toEqual(architecture);
    expect(restored.schemaVersion).toBe(ARCHITECTURE_SCHEMA_VERSION);
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
