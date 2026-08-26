import { describe, expect, it } from 'vitest';

import {
  componentCatalog,
  componentKinds,
  createComponentFromCatalog,
} from '../../src/architecture/catalog';
import { architectureComponentSchema } from '../../src/architecture/model';

describe('component catalog', () => {
  it('defines all supported MVP component kinds with useful defaults', () => {
    expect(componentKinds).toHaveLength(19);
    expect(new Set(componentKinds)).toEqual(
      new Set([
        'internet',
        'dns',
        'cdn',
        'waf',
        'load-balancer',
        'api-gateway',
        'virtual-machine',
        'container-service',
        'serverless-function',
        'worker',
        'sql-database',
        'nosql-database',
        'cache',
        'object-storage',
        'queue',
        'event-bus',
        'identity',
        'secrets-manager',
        'monitoring',
      ]),
    );

    for (const kind of componentKinds) {
      const entry = componentCatalog[kind];
      expect(entry.displayName.length).toBeGreaterThan(0);
      expect(entry.aws.service.length).toBeGreaterThan(0);
      expect(entry.baseMonthlyEstimate).toBeGreaterThanOrEqual(0);
      expect(entry.defaultSize.width).toBeGreaterThan(0);
      expect(entry.defaultSize.height).toBeGreaterThan(0);
      expect(entry.supportedProperties.length).toBeGreaterThan(0);
    }
  });

  it('creates schema-valid components from typed catalog defaults', () => {
    const component = createComponentFromCatalog(
      {
        id: 'catalog-test-database',
        kind: 'sql-database',
        name: 'Catalog Database',
        configuration: { multiAZ: true },
      },
      { provider: 'aws', region: 'eu-west-1' },
    );

    expect(architectureComponentSchema.parse(component)).toEqual(component);
    expect(component.kind).toBe('sql-database');
    if (component.kind === 'sql-database') {
      expect(component.configuration.engine).toBe('postgresql');
      expect(component.configuration.multiAZ).toBe(true);
      expect(component.configuration.encrypted).toBe(true);
    }
  });
});
