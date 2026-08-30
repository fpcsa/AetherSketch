import { createComponentFromCatalog } from '../../src/architecture/catalog';
import { analyzeSecurity } from '../../src/architecture/analysis';
import { describe, expect, it } from 'vitest';

import { getArchitectureTemplate } from '../../src/templates';
import { getHardenedEcommerceArchitecture } from '../helpers/architecture-fixtures';

describe('deterministic security scoring', () => {
  it('reports the Ecommerce baseline and its missing controls', () => {
    const result = analyzeSecurity(
      getArchitectureTemplate('ecommerce-production'),
    );

    expect(result.score).toBe(76);
    expect(result.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        'PUBLIC_WEB_WITHOUT_WAF',
        'SECRETS_MANAGER_MISSING',
        'ENCRYPTION_AT_REST_COMPLETE',
        'ENCRYPTED_DATA_TRANSPORT',
      ]),
    );
  });

  it('raises the score when a WAF and secrets manager are modeled', () => {
    const result = analyzeSecurity(getHardenedEcommerceArchitecture());

    expect(result.score).toBe(90);
    expect(result.findings.map((finding) => finding.code)).toContain(
      'WAF_PRESENT',
    );
    expect(result.findings.map((finding) => finding.code)).not.toContain(
      'SECRETS_MANAGER_MISSING',
    );
  });

  it.each([false, true])(
    'does not credit a disconnected WAF (critical=%s)',
    (critical) => {
      const architecture = getArchitectureTemplate('ecommerce-production');
      const baseline = analyzeSecurity(architecture);
      const waf = createComponentFromCatalog(
        { id: 'test-waf', kind: 'waf', critical },
        { provider: 'aws', region: architecture.region },
      );
      const result = analyzeSecurity({
        ...architecture,
        components: [...architecture.components, waf],
      });

      expect(result.score).toBe(baseline.score);
      expect(result.findings.map((finding) => finding.code)).not.toContain(
        'WAF_PRESENT',
      );
      expect(result.findings.map((finding) => finding.code)).toContain(
        'PUBLIC_WEB_WITHOUT_WAF',
      );
    },
  );

  it('does not credit a WAF when a public request can bypass it', () => {
    const architecture = getHardenedEcommerceArchitecture();
    architecture.connections.push({
      ...getArchitectureTemplate('ecommerce-production').connections[1],
      id: 'waf-bypass',
    });
    const before = JSON.stringify(architecture);
    const result = analyzeSecurity(architecture);
    expect(result.score).toBe(81);
    expect(result.findings.map((finding) => finding.code)).not.toContain(
      'WAF_PRESENT',
    );
    expect(
      result.findings.find(
        (finding) => finding.code === 'PUBLIC_WEB_WITHOUT_WAF',
      )?.evidence,
    ).toMatchObject({
      unprotectedComponentIds: ['ecommerce-ecs'],
    });
    expect(JSON.stringify(architecture)).toBe(before);
  });

  it.each(['management', 'data', 'async'] as const)(
    'does not mistake %s links for WAF request protection',
    (type) => {
      const architecture = getHardenedEcommerceArchitecture();
      architecture.connections = architecture.connections.map((connection) =>
        connection.source === 'ecommerce-waf' ||
        connection.target === 'ecommerce-waf'
          ? { ...connection, type }
          : connection,
      );
      const result = analyzeSecurity(architecture);
      expect(result.findings.map((finding) => finding.code)).not.toContain(
        'WAF_PRESENT',
      );
      expect(result.findings.map((finding) => finding.code)).toContain(
        'PUBLIC_WEB_WITHOUT_WAF',
      );
    },
  );

  it('does not credit a WAF on a dead-end branch', () => {
    const architecture = getHardenedEcommerceArchitecture();
    architecture.connections = architecture.connections.filter(
      (connection) => connection.source !== 'ecommerce-waf',
    );
    architecture.connections.push({
      ...getArchitectureTemplate('ecommerce-production').connections[1],
      id: 'application-path',
    });
    expect(
      analyzeSecurity(architecture).findings.map((finding) => finding.code),
    ).not.toContain('WAF_PRESENT');
  });

  it('requires protection for a second independent public entry path', () => {
    const architecture = getHardenedEcommerceArchitecture();
    const gateway = createComponentFromCatalog(
      { id: 'second-api', kind: 'api-gateway' },
      { provider: 'aws', region: architecture.region },
    );
    architecture.components.push(gateway);
    architecture.connections.push({
      id: 'second-entry',
      source: gateway.id,
      target: 'ecommerce-ecs',
      type: 'request',
      encrypted: true,
      critical: true,
      metadata: {},
    });
    expect(
      analyzeSecurity(architecture).findings.map((finding) => finding.code),
    ).not.toContain('WAF_PRESENT');
  });

  it('terminates on request cycles and preserves protection upstream of the cycle', () => {
    const architecture = getHardenedEcommerceArchitecture();
    architecture.connections.push({
      id: 'request-cycle',
      source: 'ecommerce-ecs',
      target: 'ecommerce-alb',
      type: 'request',
      encrypted: true,
      critical: false,
      metadata: {},
    });
    expect(analyzeSecurity(architecture).score).toBe(90);
  });

  it('flags public, unencrypted databases and unencrypted data transport', () => {
    const architecture = getArchitectureTemplate('ecommerce-production');
    const unsafe = {
      ...architecture,
      components: architecture.components.map((component) =>
        component.kind === 'sql-database'
          ? {
              ...component,
              configuration: {
                ...component.configuration,
                publicAccess: true,
                encrypted: false,
              },
            }
          : component,
      ),
      connections: architecture.connections.map((connection) =>
        connection.type === 'data'
          ? { ...connection, encrypted: false }
          : connection,
      ),
    };
    const result = analyzeSecurity(unsafe);

    expect(result.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        'PUBLIC_DATABASE',
        'UNENCRYPTED_DATABASE',
        'UNENCRYPTED_DATA_CONNECTION',
      ]),
    );
    expect(
      result.findings.find((finding) => finding.code === 'PUBLIC_DATABASE'),
    ).toMatchObject({ severity: 'critical' });
    expect(
      result.findings.find(
        (finding) => finding.code === 'UNENCRYPTED_DATABASE',
      ),
    ).toMatchObject({ severity: 'critical' });
  });

  it('detects public storage and secret-like ordinary metadata', () => {
    const architecture = getArchitectureTemplate('ecommerce-production');
    const storage = createComponentFromCatalog(
      {
        id: 'unsafe-storage',
        kind: 'object-storage',
        configuration: { publicAccess: true },
        metadata: { api_key: 'placeholder-value' },
      },
      { provider: 'aws', region: architecture.region },
    );
    const result = analyzeSecurity({
      ...architecture,
      components: [...architecture.components, storage],
    });

    expect(result.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        'PUBLIC_OBJECT_STORAGE',
        'SECRET_IN_COMPONENT_METADATA',
      ]),
    );
  });

  it('applies encryption-at-rest checks to managed AI components', () => {
    const architecture = getArchitectureTemplate('ecommerce-production');
    const model = createComponentFromCatalog(
      {
        id: 'unencrypted-ai-model',
        kind: 'serverless-ai',
        configuration: { encrypted: false },
      },
      { provider: 'aws', region: architecture.region },
    );
    const result = analyzeSecurity({
      ...architecture,
      components: [...architecture.components, model],
    });

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        code: 'UNENCRYPTED_DATA_SERVICE',
        componentId: model.id,
        severity: 'high',
      }),
    );
  });
});
