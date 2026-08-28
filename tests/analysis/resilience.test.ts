import { describe, expect, it } from 'vitest';

import { analyzeResilience } from '../../src/architecture/analysis';
import { getArchitectureTemplate } from '../../src/templates';
import {
  getAgentImprovedLockedEcommerceArchitecture,
  getHardenedEcommerceArchitecture,
} from '../helpers/architecture-fixtures';

describe('deterministic resilience scoring', () => {
  it('keeps the intentionally imperfect Ecommerce baseline in the expected range', () => {
    const result = analyzeResilience(
      getArchitectureTemplate('ecommerce-production'),
    );

    expect(result.score).toBe(57);
    expect(result.score).toBeGreaterThanOrEqual(55);
    expect(result.score).toBeLessThanOrEqual(70);
    expect(result.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        'CRITICAL_DATABASE_SINGLE_AZ',
        'CRITICAL_COMPUTE_SINGLE_AZ',
        'CRITICAL_COMPUTE_SINGLE_REPLICA',
        'CRITICAL_PATH_SINGLE_POINTS',
      ]),
    );
  });

  it('scores a replicated Multi-AZ architecture at least 90', () => {
    const result = analyzeResilience(getHardenedEcommerceArchitecture());

    expect(result.score).toBe(100);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.findings.map((finding) => finding.code)).toContain(
      'CRITICAL_PATH_REPLICATED',
    );
    expect(result.adjustments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CRITICAL_DATABASE_MULTI_AZ',
          delta: 4,
        }),
        expect.objectContaining({
          code: 'CRITICAL_COMPUTE_REPLICATED_MULTI_AZ',
          delta: 5,
        }),
      ]),
    );
  });

  it('improves resilience independently for Multi-AZ RDS and replicated compute', () => {
    const architecture = getArchitectureTemplate('ecommerce-production');
    const baseline = analyzeResilience(architecture);
    const multiAzDatabase = {
      ...architecture,
      components: architecture.components.map((component) =>
        component.kind === 'sql-database'
          ? {
              ...component,
              availabilityZones: ['eu-west-1a', 'eu-west-1b'],
              configuration: { ...component.configuration, multiAZ: true },
            }
          : component,
      ),
    };
    const replicatedCompute = {
      ...architecture,
      components: architecture.components.map((component) =>
        component.kind === 'container-service'
          ? {
              ...component,
              replicas: 2,
              availabilityZones: ['eu-west-1a', 'eu-west-1b'],
            }
          : component,
      ),
    };
    const databaseResult = analyzeResilience(multiAzDatabase);
    const computeResult = analyzeResilience(replicatedCompute);

    expect(databaseResult.score).toBeGreaterThan(baseline.score);
    expect(databaseResult.findings.map((finding) => finding.code)).toContain(
      'CRITICAL_DATABASE_MULTI_AZ',
    );
    expect(
      databaseResult.findings.map((finding) => finding.code),
    ).not.toContain('CRITICAL_DATABASE_SINGLE_AZ');

    expect(computeResult.score).toBeGreaterThan(baseline.score);
    expect(computeResult.findings.map((finding) => finding.code)).toContain(
      'CRITICAL_COMPUTE_REPLICATED_MULTI_AZ',
    );
    expect(computeResult.findings.map((finding) => finding.code)).not.toContain(
      'CRITICAL_COMPUTE_SINGLE_REPLICA',
    );
  });

  it('recognizes an independent replica without modifying the locked primary database', () => {
    const architecture = getAgentImprovedLockedEcommerceArchitecture();
    const database = architecture.components.find(
      (component) => component.id === 'ecommerce-postgresql',
    );
    const result = analyzeResilience(architecture);

    expect(database).toMatchObject({
      locked: true,
      availabilityZones: ['eu-west-1a'],
      configuration: { multiAZ: false },
    });
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.findings.map((finding) => finding.code)).toContain(
      'CRITICAL_DATABASE_REPLICATED',
    );
    expect(result.findings.map((finding) => finding.code)).not.toContain(
      'CRITICAL_DATABASE_SINGLE_AZ',
    );
  });

  it('penalizes missing backups and async buffering independently', () => {
    const architecture = getArchitectureTemplate('event-processing');
    const withoutQueue = {
      ...architecture,
      components: architecture.components.filter(
        (component) => component.kind !== 'queue',
      ),
      connections: architecture.connections.filter(
        (connection) =>
          connection.source !== 'events-queue' &&
          connection.target !== 'events-queue',
      ),
    };
    const result = analyzeResilience(withoutQueue);

    expect(result.findings.map((finding) => finding.code)).toContain(
      'ASYNC_BUFFERING_MISSING',
    );

    const ecommerce = getArchitectureTemplate('ecommerce-production');
    const noBackups = {
      ...ecommerce,
      components: ecommerce.components.map((component) =>
        component.kind === 'sql-database'
          ? {
              ...component,
              configuration: {
                ...component.configuration,
                backupsEnabled: false,
              },
            }
          : component,
      ),
    };
    expect(
      analyzeResilience(noBackups).findings.map((finding) => finding.code),
    ).toContain('DATABASE_BACKUPS_DISABLED');
  });
});
