import { describe, expect, it } from 'vitest';

import { simulateFailure } from '../../src/architecture/simulation';
import { getArchitectureTemplate } from '../../src/templates';
import {
  getAgentImprovedLockedEcommerceArchitecture,
  getHardenedEcommerceArchitecture,
} from '../helpers/architecture-fixtures';

describe('deterministic failure simulation', () => {
  it('propagates a single-AZ outage through the initial critical path', () => {
    const architecture = getArchitectureTemplate('ecommerce-production');
    const result = simulateFailure(architecture, {
      scope: 'availability-zone',
      target: 'eu-west-1a',
    });

    expect(result.failedComponentIds).toEqual(
      expect.arrayContaining(['ecommerce-ecs', 'ecommerce-postgresql']),
    );
    expect(result.degradedComponentIds).toContain('ecommerce-alb');
    expect(result.criticalPathsRemaining).toBe(false);
    expect(result.status).toBe('unavailable');
    expect(result.impactedEdgeIds).toEqual(
      expect.arrayContaining(['ecommerce-edge-2', 'ecommerce-edge-3']),
    );
  });

  it('retains a degraded critical path in the hardened architecture', () => {
    const result = simulateFailure(getHardenedEcommerceArchitecture(), {
      scope: 'availability-zone',
      target: 'eu-west-1a',
    });

    expect(result.failedComponentIds).toEqual([]);
    expect(result.degradedComponentIds).toEqual(
      expect.arrayContaining([
        'ecommerce-alb',
        'ecommerce-ecs',
        'ecommerce-postgresql',
      ]),
    );
    expect(result.survivingComponentIds).toContain('ecommerce-ecs');
    expect(result.criticalPathsRemaining).toBe(true);
    expect(result.status).toBe('degraded');
  });

  it('fails over to an independent replica while preserving the locked primary', () => {
    const result = simulateFailure(
      getAgentImprovedLockedEcommerceArchitecture(),
      {
        scope: 'availability-zone',
        target: 'eu-west-1a',
      },
    );

    expect(result.status).toBe('degraded');
    expect(result.criticalPathsRemaining).toBe(true);
    expect(result.failedComponentIds).toEqual([]);
    expect(result.degradedComponentIds).toEqual(
      expect.arrayContaining([
        'ecommerce-alb',
        'ecommerce-ecs',
        'ecommerce-postgresql',
      ]),
    );
    expect(result.survivingComponentIds).toContain('agent-database-replica');
    expect(result.impactedEdgeIds).toContain('agent-edge-replication');
  });

  it('simulates component and regional failures', () => {
    const architecture = getArchitectureTemplate('ecommerce-production');
    const componentFailure = simulateFailure(architecture, {
      scope: 'component',
      target: 'ecommerce-alb',
    });
    const regionFailure = simulateFailure(architecture, {
      scope: 'region',
      target: 'eu-west-1',
    });

    expect(componentFailure.status).toBe('unavailable');
    expect(componentFailure.failedComponentIds).toEqual(['ecommerce-alb']);
    expect(regionFailure.failedComponentIds).toEqual(
      expect.arrayContaining([
        'ecommerce-alb',
        'ecommerce-ecs',
        'ecommerce-postgresql',
      ]),
    );
    expect(regionFailure.failedComponentIds).not.toContain(
      'ecommerce-cloudfront',
    );
    expect(regionFailure.status).toBe('unavailable');
  });

  it('rejects unknown targets and never mutates the input architecture', () => {
    const architecture = getArchitectureTemplate('ecommerce-production');
    const before = JSON.stringify(architecture);

    expect(() =>
      simulateFailure(architecture, {
        scope: 'component',
        target: 'unknown-component',
      }),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_FAILURE_TARGET' }));

    simulateFailure(architecture, {
      scope: 'availability-zone',
      target: 'eu-west-1a',
    });
    expect(JSON.stringify(architecture)).toBe(before);
  });
});
