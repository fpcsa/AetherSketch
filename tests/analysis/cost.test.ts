import { describe, expect, it } from 'vitest';

import { estimateArchitectureCost } from '../../src/architecture/analysis';
import { getArchitectureTemplate } from '../../src/templates';
import { getHardenedEcommerceArchitecture } from '../helpers/architecture-fixtures';

describe('deterministic cost estimation', () => {
  it('calculates the Ecommerce planning baseline from catalog values', () => {
    const result = estimateArchitectureCost(
      getArchitectureTemplate('ecommerce-production'),
    );

    expect(result.label).toBe('Estimated architecture cost');
    expect(result.totalEstimatedMonthlyCost).toBe(675);
    expect(result.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          componentId: 'ecommerce-ecs',
          estimatedMonthlyCost: 138,
        }),
        expect.objectContaining({
          componentId: 'ecommerce-postgresql',
          estimatedMonthlyCost: 420,
        }),
      ]),
    );
    expect(result.disclaimer).toContain('not an AWS billing quote');
  });

  it('applies explicit replica and Multi-AZ multipliers', () => {
    const baseline = estimateArchitectureCost(
      getArchitectureTemplate('ecommerce-production'),
    );
    const hardened = estimateArchitectureCost(
      getHardenedEcommerceArchitecture(),
    );

    expect(hardened.totalEstimatedMonthlyCost).toBe(1246);
    expect(hardened.totalEstimatedMonthlyCost).toBeGreaterThan(
      baseline.totalEstimatedMonthlyCost,
    );
    expect(
      hardened.components.find(
        (component) => component.componentId === 'ecommerce-postgresql',
      )?.multipliers,
    ).toContainEqual(expect.objectContaining({ code: 'MULTI_AZ', value: 1.6 }));
  });
});
