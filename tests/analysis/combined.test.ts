import { describe, expect, it } from 'vitest';

import { analyzeArchitecture } from '../../src/architecture/analysis';
import { getArchitectureTemplate } from '../../src/templates';
import { getHardenedEcommerceArchitecture } from '../helpers/architecture-fixtures';

describe('combined architecture analysis', () => {
  it('returns all deterministic metrics and de-duplicated findings', () => {
    const result = analyzeArchitecture(
      getArchitectureTemplate('ecommerce-production'),
    );

    expect(result).toMatchObject({
      estimatedMonthlyCost: 675,
      resilienceScore: 57,
      securityScore: 76,
      validationStatus: 'valid',
      focus: 'all',
    });
    expect(new Set(result.findings.map((finding) => finding.id)).size).toBe(
      result.findings.length,
    );
    expect(result.findings.every((finding) => finding.deterministic)).toBe(
      true,
    );
  });

  it('filters returned findings without skipping any metric engine', () => {
    const result = analyzeArchitecture(
      getArchitectureTemplate('ecommerce-production'),
      { focus: 'security' },
    );

    expect(result.findings.length).toBeGreaterThan(0);
    expect(
      result.findings.every((finding) => finding.category === 'security'),
    ).toBe(true);
    expect(result.estimatedMonthlyCost).toBe(675);
    expect(result.resilienceScore).toBe(57);
  });

  it('evaluates every explicit constraint against calculated results', () => {
    const result = analyzeArchitecture(getHardenedEcommerceArchitecture());

    expect(result.constraints.withinBudget).toBe(true);
    expect(result.constraints.allApplicableConstraintsMet).toBe(true);
    expect(result.constraints.results).toHaveLength(6);
    expect(
      result.constraints.results.every(
        (constraint) => constraint.status === 'met',
      ),
    ).toBe(true);
  });

  it('reports failed budget, region, score, Multi-AZ, and encryption constraints', () => {
    const architecture = getArchitectureTemplate('ecommerce-production');
    const unencrypted = {
      ...architecture,
      components: architecture.components.map((component) =>
        component.kind === 'sql-database'
          ? {
              ...component,
              configuration: { ...component.configuration, encrypted: false },
            }
          : component,
      ),
      constraints: {
        maximumMonthlyCost: 100,
        targetResilienceScore: 90,
        targetSecurityScore: 90,
        requiredRegion: 'us-east-1',
        requireMultiAZ: true,
        requireEncryptionAtRest: true,
      },
    };
    const result = analyzeArchitecture(unencrypted);

    expect(result.constraints.withinBudget).toBe(false);
    expect(result.constraints.allApplicableConstraintsMet).toBe(false);
    expect(
      result.constraints.results.filter(
        (constraint) => constraint.status === 'not-met',
      ),
    ).toHaveLength(6);
  });
});
