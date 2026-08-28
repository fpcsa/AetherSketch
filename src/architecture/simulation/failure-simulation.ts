import { createFinding } from '../analysis/finding';
import {
  architectureEntryIds,
  hasIndependentReplicationPeer,
  isComponentRedundant,
  isGloballyDistributed,
  reachableComponentIds,
} from '../analysis/graph';
import type { Architecture, ArchitectureComponent } from '../model';
import { ArchitectureDomainError } from '../model';
import {
  attachmentOnlyKinds,
  componentSubnets,
  virtualNetworkId,
  withEffectiveZones,
} from '../network/structure';
import { connectionNetworkPath, internetPaths } from '../network/routing';
import type {
  FailureSimulationInput,
  FailureSimulationResult,
  FailureSimulationStatus,
} from './types';

function componentSurvivesAzFailure(
  architecture: Architecture,
  component: ArchitectureComponent,
  failedAvailabilityZone: string,
): boolean {
  return (
    isComponentRedundant(component) ||
    hasIndependentReplicationPeer(
      architecture,
      component,
      failedAvailabilityZone,
    )
  );
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
  architecture = withEffectiveZones(architecture);
  const failed = new Set<string>();
  const degraded = new Set<string>();
  const networkFindings = [];

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
      if (componentSurvivesAzFailure(architecture, component, input.target)) {
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

  // A failed boundary removes placement capacity. Dependencies do not become
  // healthy simply because a workload's own zone survives.
  for (let pass = 0; pass < 3; pass += 1) {
    for (const component of architecture.components) {
      const networkId = virtualNetworkId(architecture, component);
      const subnets = componentSubnets(architecture, component);
      if (
        (networkId && failed.has(networkId)) ||
        (subnets.length && subnets.every((subnet) => failed.has(subnet.id)))
      )
        failed.add(component.id);
      else if (subnets.some((subnet) => failed.has(subnet.id)))
        degraded.add(component.id);
      if (
        component.kind === 'vpn-connection' &&
        (failed.has(component.configuration.gatewayId) ||
          failed.has(component.configuration.externalNetworkId))
      )
        failed.add(component.id);
    }
  }
  const egressUnavailable = new Set<string>();
  for (const component of architecture.components) {
    if (!component.network?.internetAccessRequired || failed.has(component.id))
      continue;
    const before = internetPaths(architecture, component);
    const after = internetPaths(architecture, component, failed);
    const survivingPlacements = after.filter(
      (route) => !route.subnetId || !failed.has(route.subnetId),
    );
    if (!survivingPlacements.some((route) => route.reachable))
      egressUnavailable.add(component.id);
    const lostRoutes = survivingPlacements.filter(
      (route) =>
        !route.reachable &&
        before.some(
          (prior) => prior.subnetId === route.subnetId && prior.reachable,
        ),
    );
    if (!lostRoutes.length) continue;
    degraded.add(component.id);
    const natIds = [
      ...new Set(
        lostRoutes
          .map((route) => route.natGatewayId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    networkFindings.push(
      createFinding({
        id: `simulation:network-egress:${component.id}`,
        code: 'NETWORK_EGRESS_LOST',
        category: 'simulation',
        severity:
          egressUnavailable.has(component.id) && component.critical
            ? 'critical'
            : 'high',
        componentId: component.id,
        title: 'Internet route lost in this failure',
        message: `${component.name} retains workload capacity but ${egressUnavailable.has(component.id) ? 'cannot reach the internet' : 'loses internet egress in some surviving subnets'}.${natIds.some((id) => failed.has(id)) ? ' Its route depends on a NAT gateway in the failed scope.' : natIds.length ? ' Its NAT route has no surviving Internet Gateway path.' : ''}`,
        remediation:
          'Provide a NAT and internet route in every workload zone; verify attached egress rules.',
        evidence: {
          natGatewayIds: natIds,
          subnetIds: lostRoutes.map((route) => route.subnetId ?? ''),
          target: input.target,
          scope: input.scope,
        },
      }),
    );
  }
  failed.forEach((id) => degraded.delete(id));
  const impactedEdgeIds = architecture.connections
    .filter(
      (connection) =>
        failed.has(connection.source) ||
        failed.has(connection.target) ||
        degraded.has(connection.source) ||
        degraded.has(connection.target) ||
        (connectionNetworkPath(architecture, connection).reachable &&
          !connectionNetworkPath(architecture, connection, failed).reachable),
    )
    .map((connection) => connection.id);

  const entryIds = architectureEntryIds(architecture, failed).filter(
    (entryId) => !failed.has(entryId),
  );
  const reachable = reachableComponentIds(architecture, entryIds, failed);
  const criticalComponents = architecture.components.filter(
    (component) =>
      component.critical && !attachmentOnlyKinds.has(component.kind),
  );
  const criticalPathsRemaining =
    entryIds.length > 0 &&
    criticalComponents.every(
      (component) =>
        !failed.has(component.id) &&
        !egressUnavailable.has(component.id) &&
        reachable.has(component.id),
    ) &&
    architecture.connections
      .filter((edge) => edge.critical)
      .every(
        (edge) => connectionNetworkPath(architecture, edge, failed).reachable,
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
    ...networkFindings,
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
        ? 'All modeled critical components, connections and required internet routes remain available.'
        : 'At least one modeled critical component, connection or required internet route is unavailable.',
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
