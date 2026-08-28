import { describe, expect, it } from 'vitest';

import { createComponentFromCatalog } from '../../src/architecture/catalog';
import { estimateArchitectureCost } from '../../src/architecture/analysis';
import { createEmptyArchitecture } from '../../src/architecture/model';
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
    expect(result.disclaimer).toContain('not a cloud billing quote');
  });

  it('keeps gateway resource estimates separate from unmodeled connectivity charges', () => {
    const architecture = createEmptyArchitecture({ name: 'Gateway cost' });
    const context = { provider: 'aws' as const, region: architecture.region };
    const components = (
      ['internet-gateway', 'virtual-private-gateway'] as const
    ).map((kind) => createComponentFromCatalog({ kind }, context));
    const result = estimateArchitectureCost({ ...architecture, components });
    expect(result.totalEstimatedMonthlyCost).toBe(0);
    expect(result.components[0]?.explanation).toContain(
      'Traffic charges are excluded',
    );
    expect(result.components[1]?.explanation).toContain(
      'VPN connections, dedicated links, and traffic charges are excluded',
    );
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

  it('models AI modality and agent orchestration cost drivers', () => {
    const architecture = getArchitectureTemplate('ecommerce-production');
    const context = {
      provider: architecture.provider.provider,
      region: architecture.region,
    };
    const model = createComponentFromCatalog(
      {
        id: 'cost-ai-model',
        kind: 'serverless-ai',
        configuration: { modality: 'multimodal' },
      },
      context,
    );
    const agent = createComponentFromCatalog(
      {
        id: 'cost-ai-agent',
        kind: 'ai-agent',
        configuration: { orchestrationMode: 'supervisor' },
      },
      context,
    );
    const result = estimateArchitectureCost({
      ...architecture,
      components: [model, agent],
      connections: [],
    });

    expect(result.totalEstimatedMonthlyCost).toBe(211.52);
    expect(
      result.components.find((component) => component.componentId === model.id)
        ?.multipliers,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'AI_MODALITY', value: 1.45 }),
        expect.objectContaining({ code: 'AI_GUARDRAILS', value: 1.05 }),
      ]),
    );
    expect(
      result.components.find((component) => component.componentId === agent.id)
        ?.multipliers,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'AGENT_ORCHESTRATION', value: 1.6 }),
        expect.objectContaining({ code: 'AGENT_MEMORY', value: 1.1 }),
      ]),
    );
  });
});
