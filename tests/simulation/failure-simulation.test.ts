import { describe, expect, it } from 'vitest';

import { simulateFailure } from '../../src/architecture/simulation';
import { createComponentFromCatalog } from '../../src/architecture/catalog';
import { analyzeArchitecture } from '../../src/architecture/analysis';
import { createEmptyArchitecture } from '../../src/architecture/model';
import { getArchitectureTemplate } from '../../src/templates';
import {
  getAgentImprovedLockedEcommerceArchitecture,
  getHardenedEcommerceArchitecture,
} from '../helpers/architecture-fixtures';

describe('deterministic failure simulation', () => {
  it.each(['internet-gateway', 'virtual-private-gateway'] as const)(
    'treats %s as a regional entry and preserves its path during a zone outage',
    (kind) => {
      const base = createEmptyArchitecture({ name: 'Gateway simulation' });
      const context = { provider: 'aws' as const, region: base.region };
      const gateway = createComponentFromCatalog(
        { kind, critical: true },
        context,
      );
      const database = createComponentFromCatalog(
        {
          kind: 'sql-database',
          critical: true,
          availabilityZones: ['eu-west-1a', 'eu-west-1b'],
          configuration: { multiAZ: true },
        },
        context,
      );
      const architecture = {
        ...base,
        components: [gateway, database],
        connections: [
          {
            id: 'gateway-data-link',
            source: gateway.id,
            target: database.id,
            type: 'data' as const,
            protocol: 'TLS',
            encrypted: true,
            critical: true,
            metadata: {},
          },
        ],
      };
      const findings = analyzeArchitecture(architecture).findings.map(
        (finding) => finding.code,
      );
      expect(findings).not.toContain('NO_ENTRY_PATH');
      expect(findings).not.toContain('CRITICAL_COMPONENT_UNREACHABLE');
      expect(findings).not.toContain('CRITICAL_PATH_SINGLE_POINTS');
      expect(findings.includes('DATABASE_DIRECTLY_EXPOSED')).toBe(
        kind === 'internet-gateway',
      );
      expect(findings.includes('PUBLIC_WEB_WITHOUT_WAF')).toBe(
        kind === 'internet-gateway',
      );
      const zoneFailure = simulateFailure(architecture, {
        scope: 'availability-zone',
        target: 'eu-west-1a',
      });
      expect(zoneFailure.criticalPathsRemaining).toBe(true);
      expect(zoneFailure.failedComponentIds).toEqual([]);
      expect(zoneFailure.degradedComponentIds).toEqual([database.id]);
      const regionFailure = simulateFailure(architecture, {
        scope: 'region',
        target: 'eu-west-1',
      });
      expect(regionFailure.failedComponentIds).toContain(gateway.id);
      expect(regionFailure.criticalPathsRemaining).toBe(false);
      const gatewayFailure = simulateFailure(architecture, {
        scope: 'component',
        target: gateway.id,
      });
      expect(gatewayFailure.criticalPathsRemaining).toBe(false);
    },
  );
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
