import { withEffectiveZones } from '../network/structure';
import type { Architecture } from '../model';
import {
  encryptionAtRestState,
  isComponentRedundant,
  isMultiAzCapable,
} from './graph';
import type {
  ConstraintEvaluation,
  ConstraintResult,
  CostEstimate,
  ScoreAnalysis,
} from './types';

function targetResult(
  id: 'resilience-target' | 'security-target',
  label: string,
  actual: number | null,
  expected: number | undefined,
): ConstraintResult {
  if (expected === undefined) {
    return {
      id,
      status: 'not-applicable',
      actual,
      expected: null,
      message: `No ${label.toLowerCase()} target is set.`,
    };
  }

  if (actual === null) {
    return {
      id,
      status: 'not-met',
      actual: null,
      expected,
      message: `${label} is not assessed for an empty architecture. Add components to evaluate the target of ${expected}.`,
    };
  }
  const met = actual >= expected;
  return {
    id,
    status: met ? 'met' : 'not-met',
    actual,
    expected,
    message: met
      ? `${label} score ${actual} meets the target of ${expected}.`
      : `${label} score ${actual} is below the target of ${expected}.`,
  };
}

export function evaluateConstraints(
  architecture: Architecture,
  cost: CostEstimate,
  resilience: ScoreAnalysis,
  security: ScoreAnalysis,
): ConstraintEvaluation {
  architecture = withEffectiveZones(architecture);
  const budget = architecture.constraints.maximumMonthlyCost;
  const withinBudget =
    budget === undefined ? null : cost.totalEstimatedMonthlyCost <= budget;

  const budgetResult: ConstraintResult =
    budget === undefined
      ? {
          id: 'cost-budget',
          status: 'not-applicable',
          actual: cost.totalEstimatedMonthlyCost,
          expected: null,
          message: 'No maximum monthly cost is set.',
        }
      : {
          id: 'cost-budget',
          status: withinBudget ? 'met' : 'not-met',
          actual: cost.totalEstimatedMonthlyCost,
          expected: budget,
          message: withinBudget
            ? `Estimated architecture cost $${cost.totalEstimatedMonthlyCost.toFixed(2)} is within the $${budget.toFixed(2)} monthly budget.`
            : `Estimated architecture cost $${cost.totalEstimatedMonthlyCost.toFixed(2)} exceeds the $${budget.toFixed(2)} monthly budget.`,
        };

  const requiredRegion = architecture.constraints.requiredRegion;
  const regionMet =
    requiredRegion === undefined || architecture.region === requiredRegion;
  const regionResult: ConstraintResult =
    requiredRegion === undefined
      ? {
          id: 'required-region',
          status: 'not-applicable',
          actual: architecture.region,
          expected: null,
          message: 'No required region is set.',
        }
      : {
          id: 'required-region',
          status: regionMet ? 'met' : 'not-met',
          actual: architecture.region,
          expected: requiredRegion,
          message: regionMet
            ? `Architecture region ${architecture.region} matches the required region.`
            : `Architecture region ${architecture.region} does not match ${requiredRegion}.`,
        };

  const criticalMultiAzComponents = architecture.components.filter(
    (component) => component.critical && isMultiAzCapable(component),
  );
  const multiAzActual = criticalMultiAzComponents.every(isComponentRedundant);
  const multiAzRequired = architecture.constraints.requireMultiAZ;
  const multiAzResult: ConstraintResult = multiAzRequired
    ? {
        id: 'multi-az-required',
        status: multiAzActual ? 'met' : 'not-met',
        actual: multiAzActual,
        expected: true,
        message: multiAzActual
          ? 'All critical zonal components model Multi-AZ redundancy.'
          : 'At least one critical zonal component lacks Multi-AZ redundancy.',
      }
    : {
        id: 'multi-az-required',
        status: 'not-applicable',
        actual: multiAzActual,
        expected: false,
        message: 'Multi-AZ is not required by the current constraints.',
      };

  const encryptableComponents = architecture.components.filter(
    (component) => encryptionAtRestState(component) !== null,
  );
  const encryptionActual = encryptableComponents.every(
    (component) => encryptionAtRestState(component) === true,
  );
  const encryptionRequired = architecture.constraints.requireEncryptionAtRest;
  const encryptionResult: ConstraintResult = encryptionRequired
    ? {
        id: 'encryption-at-rest-required',
        status: encryptionActual ? 'met' : 'not-met',
        actual: encryptionActual,
        expected: true,
        message: encryptionActual
          ? 'All applicable components model encryption at rest.'
          : 'At least one applicable component lacks encryption at rest.',
      }
    : {
        id: 'encryption-at-rest-required',
        status: 'not-applicable',
        actual: encryptionActual,
        expected: false,
        message:
          'Encryption at rest is not required by the current constraints.',
      };

  const results: ConstraintResult[] = [
    budgetResult,
    targetResult(
      'resilience-target',
      'Resilience',
      resilience.score,
      architecture.constraints.targetResilienceScore,
    ),
    targetResult(
      'security-target',
      'Security',
      security.score,
      architecture.constraints.targetSecurityScore,
    ),
    regionResult,
    multiAzResult,
    encryptionResult,
  ];

  return {
    withinBudget,
    allApplicableConstraintsMet: results.every(
      (result) => result.status !== 'not-met',
    ),
    results,
  };
}
