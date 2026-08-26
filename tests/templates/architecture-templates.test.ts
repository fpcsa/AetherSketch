import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ARCHITECTURE_TEMPLATE_ID,
  architectureTemplateIds,
  getArchitectureTemplate,
  listArchitectureTemplates,
} from '../../src/templates';

describe('architecture templates', () => {
  it('provides the three requested templates', () => {
    expect(architectureTemplateIds).toEqual([
      'ecommerce-production',
      'serverless-api',
      'event-processing',
    ]);
    expect(
      listArchitectureTemplates().map((template) => template.name),
    ).toEqual(['Ecommerce Production', 'Serverless API', 'Event Processing']);
    expect(DEFAULT_ARCHITECTURE_TEMPLATE_ID).toBe('ecommerce-production');
  });

  it('models the intentionally imperfect ecommerce critical path', () => {
    const architecture = getArchitectureTemplate('ecommerce-production');

    expect(architecture.components.map((component) => component.kind)).toEqual([
      'internet',
      'cdn',
      'load-balancer',
      'container-service',
      'sql-database',
    ]);
    expect(architecture.connections).toHaveLength(4);

    const compute = architecture.components.find(
      (component) => component.kind === 'container-service',
    );
    const database = architecture.components.find(
      (component) => component.kind === 'sql-database',
    );

    expect(compute?.availabilityZones).toEqual(['eu-west-1a']);
    expect(compute?.replicas).toBe(1);
    expect(database?.availabilityZones).toEqual(['eu-west-1a']);
    if (database?.kind === 'sql-database') {
      expect(database.configuration.multiAZ).toBe(false);
    }
  });

  it('returns independent clones so templates cannot be mutated globally', () => {
    const first = getArchitectureTemplate('event-processing');
    const second = getArchitectureTemplate('event-processing');

    first.name = 'Mutated copy';
    first.components[0].name = 'Mutated component';

    expect(second.name).toBe('Event Processing');
    expect(second.components[0]?.name).toBe('Domain Events');
  });
});
