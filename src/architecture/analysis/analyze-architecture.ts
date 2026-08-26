import type { Architecture } from '../model';
import { evaluateConstraints } from './constraints';
import { estimateArchitectureCost } from './cost';
import { deduplicateFindings } from './finding';
import { analyzeResilience } from './resilience';
import { analyzeSecurity } from './security';
import type {
  AnalyzeArchitectureOptions,
  ArchitectureAnalysis,
  ArchitectureFinding,
} from './types';
import { analyzeArchitectureValidation } from './validation';

const severityOrder = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
} as const;

function sortFindings(findings: ArchitectureFinding[]): ArchitectureFinding[] {
  return [...findings].sort(
    (left, right) =>
      severityOrder[left.severity] - severityOrder[right.severity] ||
      left.id.localeCompare(right.id),
  );
}

export function analyzeArchitecture(
  architecture: Architecture,
  options: AnalyzeArchitectureOptions = {},
): ArchitectureAnalysis {
  const focus = options.focus ?? 'all';
  const validation = analyzeArchitectureValidation(architecture);
  const cost = estimateArchitectureCost(architecture);
  const resilience = analyzeResilience(architecture);
  const security = analyzeSecurity(architecture);
  const constraints = evaluateConstraints(
    architecture,
    cost,
    resilience,
    security,
  );

  const focusedFindings =
    focus === 'all'
      ? [
          ...validation.findings,
          ...cost.findings,
          ...resilience.findings,
          ...security.findings,
        ]
      : focus === 'validation'
        ? validation.findings
        : focus === 'cost'
          ? cost.findings
          : focus === 'resilience'
            ? resilience.findings
            : security.findings;

  return {
    architectureId: architecture.id,
    architectureRevision: architecture.revision,
    focus,
    estimatedMonthlyCost: cost.totalEstimatedMonthlyCost,
    resilienceScore: resilience.score,
    securityScore: security.score,
    validationStatus: validation.valid ? 'valid' : 'invalid',
    cost,
    resilience,
    security,
    validation,
    constraints,
    findings: sortFindings(deduplicateFindings(focusedFindings)),
  };
}
