import { describe, expect, it } from 'vitest';

import {
  componentCatalog,
  componentKinds,
  createComponentFromCatalog,
} from '../../src/architecture/catalog';
import { architectureComponentSchema } from '../../src/architecture/model';

describe('component catalog', () => {
  it('defines all supported MVP component kinds with useful defaults', () => {
    expect(componentKinds).toHaveLength(23);
    expect(new Set(componentKinds)).toEqual(
      new Set([
        'internet',
        'internet-gateway',
        'virtual-private-gateway',
        'dns',
        'cdn',
        'waf',
        'load-balancer',
        'api-gateway',
        'virtual-machine',
        'container-service',
        'serverless-function',
        'worker',
        'serverless-ai',
        'ai-agent',
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
      const component = createComponentFromCatalog(
        { kind },
        { provider: 'aws', region: 'eu-west-1' },
      );
      expect(architectureComponentSchema.parse(component)).toEqual(component);
    }
  });

  it('does not assign an AWS service to a generic component and preserves explicit services', () => {
    const context = { provider: 'generic' as const, region: 'region-1' };
    const input = { kind: 'sql-database' as const };
    expect(createComponentFromCatalog(input, context).service).toBe(
      'sql-database',
    );
    expect(
      createComponentFromCatalog(
        { ...input, service: 'custom-postgres' },
        context,
      ).service,
    ).toBe('custom-postgres');
    expect(
      createComponentFromCatalog({ ...input, provider: 'aws' }, context)
        .service,
    ).toBe('rds-postgresql');
  });

  it('validates gateway settings and both private ASN ranges', () => {
    const context = { provider: 'aws' as const, region: 'eu-west-1' };
    for (const asn of [64512, 65534, 4_200_000_000, 4_294_967_294]) {
      expect(
        createComponentFromCatalog(
          {
            kind: 'virtual-private-gateway',
            configuration: { asn },
          },
          context,
        ).configuration,
      ).toEqual({ asn });
    }
    const gateway = createComponentFromCatalog(
      { kind: 'virtual-private-gateway' },
      context,
    );
    for (const asn of [
      0,
      64511,
      65535,
      4_199_999_999,
      4_294_967_295,
      64512.5,
      '64512',
    ]) {
      expect(
        architectureComponentSchema.safeParse({
          ...gateway,
          configuration: { asn },
        }).success,
      ).toBe(false);
    }
    const internetGateway = createComponentFromCatalog(
      { kind: 'internet-gateway' },
      context,
    );
    expect(
      architectureComponentSchema.safeParse({
        ...internetGateway,
        configuration: { asn: 64512 },
      }).success,
    ).toBe(false);
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
