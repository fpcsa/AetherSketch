import { describe, expect, it } from 'vitest';

import { analyzeArchitectureValidation } from '../../src/architecture/analysis';
import type { Architecture } from '../../src/architecture/model';
import { getArchitectureTemplate } from '../../src/templates';

describe('architecture validation analysis', () => {
  it('accepts the structurally coherent Ecommerce template', () => {
    const result = analyzeArchitectureValidation(
      getArchitectureTemplate('ecommerce-production'),
    );

    expect(result.valid).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it('reports duplicate identifiers, dangling edges, and self-connections', () => {
    const architecture = getArchitectureTemplate('ecommerce-production');
    const malformed = {
      ...architecture,
      components: [
        ...architecture.components,
        { ...architecture.components[0] },
      ],
      connections: [
        ...architecture.connections,
        {
          ...architecture.connections[0],
          source: 'missing-component',
          target: 'missing-component',
        },
      ],
    } as Architecture;
    const result = analyzeArchitectureValidation(malformed);
    const codes = result.findings.map((finding) => finding.code);

    expect(result.valid).toBe(false);
    expect(codes).toEqual(
      expect.arrayContaining([
        'DUPLICATE_COMPONENT_ID',
        'DUPLICATE_CONNECTION_ID',
        'DANGLING_CONNECTION_SOURCE',
        'DANGLING_CONNECTION_TARGET',
        'SELF_CONNECTION',
      ]),
    );
  });

  it('detects direct data exposure and unreachable critical components', () => {
    const architecture = getArchitectureTemplate('ecommerce-production');
    const database = architecture.components.find(
      (component) => component.kind === 'sql-database',
    );
    expect(database).toBeDefined();

    const unsafe = {
      ...architecture,
      components: architecture.components.map((component) =>
        component.id === 'ecommerce-ecs'
          ? { ...component, critical: false }
          : component,
      ),
      connections: [
        ...architecture.connections.filter(
          (connection) => connection.target !== 'ecommerce-postgresql',
        ),
        {
          id: 'direct-public-data',
          source: 'ecommerce-internet',
          target: database!.id,
          type: 'data' as const,
          protocol: 'PostgreSQL',
          encrypted: false,
          critical: true,
          metadata: {},
        },
      ],
    };
    const result = analyzeArchitectureValidation(unsafe);

    expect(result.findings.map((finding) => finding.code)).toContain(
      'DATABASE_DIRECTLY_EXPOSED',
    );
  });

  it('reports missing ingress and missing compute for application dependencies', () => {
    const architecture = getArchitectureTemplate('ecommerce-production');
    const dependenciesOnly = {
      ...architecture,
      components: architecture.components.filter(
        (component) => component.kind === 'sql-database',
      ),
      connections: [],
    };
    const result = analyzeArchitectureValidation(dependenciesOnly);

    expect(result.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        'NO_ENTRY_PATH',
        'ISOLATED_CRITICAL_COMPONENT',
        'NO_COMPUTE_FOR_APPLICATION_DEPENDENCIES',
      ]),
    );
  });
});
