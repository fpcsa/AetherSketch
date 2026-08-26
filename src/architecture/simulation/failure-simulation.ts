import { createFinding } from '../analysis/finding';
import {
  architectureEntryIds,
  isComponentRedundant,
  isGloballyDistributed,
  reachableComponentIds,
} from '../analysis/graph';
import type { Architecture, ArchitectureComponent } from '../model';
import { ArchitectureDomainError } from '../model';
import type {
  FailureSimulationInput,
  FailureSimulationResult,
  FailureSimulationStatus,
} from './types';

function componentSurvivesAzFailure(component: ArchitectureComponent): boolean {
  return isComponentRedundant(component);
}

function simulationStatus(
  criticalPathsRemaining: boolean,
  failedCount: number,
  degradedCount: number,
): FailureSimulationStatus {
  if (!criticalPathsRemaining) {
    return 'unavailable';
  }
  return failedCount > 0 || degradedCount > 0 ? 'degraded' : 'operational';
}

export function simulateFailure(
  architecture: Architecture,
  input: FailureSimulationInput,
): FailureSimulationResult {
  const failed = new Set<string>();
  const degraded = new Set<string>();

  if (input.scope === 'component') {
    const component = architecture.components.find(
      (candidate) => candidate.id === input.target,
    );
    if (!component) {
      throw new ArchitectureDomainError(
        'INVALID_FAILURE_TARGET',
        `Failure target component does not exist: ${input.target}`,
        { componentId: input.target },
      );
    }
    failed.add(component.id);
  }

  if (input.scope === 'availability-zone') {
    const affected = architecture.components.filter((component) =>
      component.availabilityZones.includes(input.target),
    );
    if (affected.length === 0) {
      throw new ArchitectureDomainError(
        'INVALID_FAILURE_TARGET',
        `No component is modeled in availability zone ${input.target}.`,
        { details: { scope: input.scope, target: input.target } },
      );
    }

    for (const component of affected) {
      if (componentSurvivesAzFailure(component)) {
        degraded.add(component.id);
      } else {
        failed.add(component.id);
      }
    }
  }

  if (input.scope === 'region') {
    const affected = architecture.components.filter(
      (component) =>
        component.region === input.target && !isGloballyDistributed(component),
    );
    if (affected.length === 0) {
      throw new ArchitectureDomainError(
        'INVALID_FAILURE_TARGET',
        `No regional component is modeled in ${input.target}.`,
        { details: { scope: input.scope, target: input.target } },
      );
    }
    affected.forEach((component) => failed.add(component.id));
  }

  const impactedEdgeIds = architecture.connections
    .filter(
      (connection) =>
        failed.has(connection.source) ||
        failed.has(connection.target) ||
        degraded.has(connection.source) ||
        degraded.has(connection.target),
    )
    .map((connection) => connection.id);

  const entryIds = architectureEntryIds(architecture).filter(
    (entryId) => !failed.has(entryId),
  );
  const reachable = reachableComponentIds(architecture, entryIds, failed);
  const criticalComponents = architecture.components.filter(
    (component) => component.critical,
  );
  const criticalPathsRemaining =
    entryIds.length > 0 &&
    criticalComponents.every(
      (component) => !failed.has(component.id) && reachable.has(component.id),
    );
  const status = simulationStatus(
    criticalPathsRemaining,
    failed.size,
    degraded.size,
  );
  const survivingComponentIds = architecture.components
    .filter((component) => !failed.has(component.id))
    .map((component) => component.id);

  const findings = [
    ...architecture.components
      .filter((component) => failed.has(component.id))
      .map((component) =>
        createFinding({
          id: `simulation:failed:${input.scope}:${component.id}`,
          code: 'COMPONENT_FAILED',
          category: 'simulation',
          severity: component.critical ? 'critical' : 'high',
          componentId: component.id,
          title: 'Component failed',
          message: `${component.name} is unavailable in this simulation.`,
          remediation:
            'Add an independent replica or failover path for this failure scope.',
          evidence: {
            scope: input.scope,
            target: input.target,
            critical: component.critical,
          },
        }),
      ),
    ...architecture.components
      .filter((component) => degraded.has(component.id))
      .map((component) =>
        createFinding({
          id: `simulation:degraded:${input.scope}:${component.id}`,
          code: 'COMPONENT_DEGRADED',
          category: 'simulation',
          severity: 'medium',
          componentId: component.id,
          title: 'Component capacity is degraded',
          message: `${component.name} retains surviving capacity outside the failed scope.`,
          remediation:
            'Confirm remaining capacity can handle the expected workload.',
          evidence: {
            scope: input.scope,
            target: input.target,
            availabilityZones: component.availabilityZones,
          },
        }),
      ),
    createFinding({
      id: `simulation:status:${input.scope}:${input.target}`,
      code: 'SIMULATION_STATUS',
      category: 'simulation',
      severity:
        status === 'unavailable'
          ? 'critical'
          : status === 'degraded'
            ? 'medium'
            : 'info',
      title: `Architecture is ${status}`,
      message: criticalPathsRemaining
        ? 'All modeled critical components remain reachable from an entry path.'
        : 'At least one modeled critical component is failed or unreachable.',
      remediation:
        status === 'unavailable'
          ? 'Remove single points of failure from the critical path.'
          : 'Validate capacity and recovery procedures for the surviving path.',
      evidence: {
        failedComponentIds: [...failed],
        degradedComponentIds: [...degraded],
        criticalPathsRemaining,
      },
    }),
  ];

  return {
    architectureId: architecture.id,
    architectureRevision: architecture.revision,
    scope: input.scope,
    target: input.target,
    failedComponentIds: [...failed],
    degradedComponentIds: [...degraded],
    impactedEdgeIds,
    survivingComponentIds,
    criticalPathsRemaining,
    status,
    explanation: `Simulated ${input.scope} failure “${input.target}”: ${failed.size} failed, ${degraded.size} degraded; architecture ${status}.`,
    findings,
  };
}
