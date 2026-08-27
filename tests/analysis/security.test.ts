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

  it('replaces the missing-WAF penalty with a positive WAF adjustment', () => {
    const architecture = getArchitectureTemplate('ecommerce-production');
    const baseline = analyzeSecurity(architecture);
    const waf = createComponentFromCatalog(
      { id: 'test-waf', kind: 'waf' },
      { provider: 'aws', region: architecture.region },
    );
    const result = analyzeSecurity({
      ...architecture,
      components: [...architecture.components, waf],
    });

    expect(result.score).toBeGreaterThan(baseline.score);
    expect(result.findings.map((finding) => finding.code)).toContain(
      'WAF_PRESENT',
    );
    expect(result.findings.map((finding) => finding.code)).not.toContain(
      'PUBLIC_WEB_WITHOUT_WAF',
    );
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
