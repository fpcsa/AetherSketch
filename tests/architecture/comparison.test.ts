import { describe, expect, it } from 'vitest';

import { compareArchitectures } from '../../src/architecture/comparison';
import { createComponentFromCatalog } from '../../src/architecture/catalog';
import {
  createEmptyArchitecture,
  validateArchitecture,
} from '../../src/architecture/model';
import { getArchitectureTemplate } from '../../src/templates';
import { getAgentImprovedLockedEcommerceArchitecture } from '../helpers/architecture-fixtures';

function getHumanCheckpoint() {
  const architecture = getArchitectureTemplate('ecommerce-production');
  return validateArchitecture({
    ...architecture,
    revision: 3,
    components: architecture.components.map((component) =>
      component.id === 'ecommerce-postgresql'
        ? { ...component, locked: true }
        : component,
    ),
    constraints: {
      ...architecture.constraints,
      maximumMonthlyCost: 3000,
      targetResilienceScore: 90,
      targetSecurityScore: 90,
      requiredRegion: 'eu-west-1',
      requireEncryptionAtRest: true,
    },
  });
}

describe('deterministic architecture comparison', () => {
  it('does not invent score deltas to, from, or between empty architectures', () => {
    const empty = createEmptyArchitecture({ name: 'Empty architecture' });
    const populated = getHumanCheckpoint();
    for (const [before, after] of [
      [empty, populated],
      [populated, empty],
      [empty, empty],
    ]) {
      const comparison = compareArchitectures(before, after);
      expect(comparison.delta).toMatchObject({
        resilienceScore: null,
        securityScore: null,
      });
      expect(comparison.delta.estimatedMonthlyCost).toBeTypeOf('number');
      expect(
        before.components.length === 0 ? comparison.before : comparison.after,
      ).toMatchObject({
        resilienceScore: null,
        securityScore: null,
      });
    }
  });
  it.each([30, 50])(
    'compares a %i-component workload without losing structural changes',
    (count) => {
      const baseline = getHumanCheckpoint();
      const current = structuredClone(baseline);
      for (let index = 5; index < count; index += 1) {
        current.components.push(
          createComponentFromCatalog(
            {
              id: `scale-${index}`,
              kind: 'queue',
              name: `Queue ${index}`,
              position: {
                x: (index % 3) * 304,
                y: Math.floor(index / 3) * 208,
              },
            },
            { provider: 'aws', region: 'eu-west-1' },
          ),
        );
      }
      for (let pass = 0; pass < 20; pass += 1) {
        const comparison = compareArchitectures(baseline, current);
        expect(comparison.added).toHaveLength(count - 5);
        expect(comparison.changed).toEqual([]);
      }
    },
  );

  it('ignores object key insertion order and never changes either snapshot', () => {
    const baseline = getHumanCheckpoint();
    const current = structuredClone(baseline);
    current.provider = {
      environment: baseline.provider.environment,
      provider: baseline.provider.provider,
    };
    current.constraints = Object.fromEntries(
      Object.entries(baseline.constraints).reverse(),
    ) as typeof baseline.constraints;
    const original = JSON.stringify([baseline, current]);
    expect(compareArchitectures(baseline, current).hasChanges).toBe(false);
    expect(JSON.stringify([baseline, current])).toBe(original);
  });

  it('computes metric deltas and structural IR changes from a checkpoint', () => {
    const comparison = compareArchitectures(
      getHumanCheckpoint(),
      getAgentImprovedLockedEcommerceArchitecture(),
    );

    expect(comparison).toMatchObject({
      baselineRevision: 3,
      currentRevision: 12,
      before: {
        estimatedMonthlyCost: 675,
        resilienceScore: 57,
        securityScore: 76,
      },
      after: {
        estimatedMonthlyCost: 1288,
        resilienceScore: 100,
        securityScore: 90,
      },
      delta: {
        estimatedMonthlyCost: 613,
        resilienceScore: 43,
        securityScore: 14,
      },
      hasChanges: true,
    });
    expect(comparison.after.estimatedMonthlyCost).toBeLessThanOrEqual(3000);
    expect(comparison.delta.estimatedMonthlyCost).toBeGreaterThan(0);
    expect(comparison.added).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity: 'component',
          id: 'agent-database-replica',
          label: 'Orders Failover Replica',
        }),
        expect.objectContaining({
          entity: 'connection',
          id: 'agent-edge-replication',
        }),
      ]),
    );
    const ecsChange = comparison.changed.find(
      (item) => item.id === 'ecommerce-ecs',
    );
    expect(ecsChange?.fields).toEqual(
      expect.arrayContaining([
        'availabilityZones',
        'replicas',
        'configuration.autoscaling',
      ]),
    );
    expect(comparison.removed).toContainEqual(
      expect.objectContaining({ id: 'ecommerce-edge-2' }),
    );
  });

  it('returns a stable empty diff for an unchanged checkpoint', () => {
    const baseline = getHumanCheckpoint();
    const comparison = compareArchitectures(baseline, baseline);

    expect(comparison.hasChanges).toBe(false);
    expect(comparison.added).toEqual([]);
    expect(comparison.changed).toEqual([]);
    expect(comparison.removed).toEqual([]);
    expect(comparison.delta).toEqual({
      estimatedMonthlyCost: 0,
      resilienceScore: 0,
      securityScore: 0,
    });
  });
});
