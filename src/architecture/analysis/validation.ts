import type { Architecture, ArchitectureComponent } from '../model';
import { createFinding } from './finding';
import {
  architectureEntryIds,
  isComputeComponent,
  isDataComponent,
  reachableComponentIds,
} from './graph';
import type { ArchitectureFinding, ValidationAnalysis } from './types';

function componentMap(architecture: Architecture) {
  return new Map(
    architecture.components.map((component) => [component.id, component]),
  );
}

function isDirectPublicSource(component: ArchitectureComponent): boolean {
  return (
    component.kind === 'internet' ||
    component.kind === 'cdn' ||
    (component.kind === 'load-balancer' &&
      component.configuration.scheme === 'internet-facing')
  );
}

export function analyzeArchitectureValidation(
  architecture: Architecture,
): ValidationAnalysis {
  const findings: ArchitectureFinding[] = [];
  const componentsById = componentMap(architecture);
  const componentIdCounts = new Map<string, number>();
  const connectionIdCounts = new Map<string, number>();

  for (const component of architecture.components) {
    componentIdCounts.set(
      component.id,
      (componentIdCounts.get(component.id) ?? 0) + 1,
    );
  }

  for (const [componentId, count] of componentIdCounts) {
    if (count > 1) {
      findings.push(
        createFinding({
          id: `validation:duplicate-component:${componentId}`,
          code: 'DUPLICATE_COMPONENT_ID',
          category: 'validation',
          severity: 'high',
          componentId,
          title: 'Duplicate component identifier',
          message: `${count} components use the identifier “${componentId}”.`,
          remediation: 'Assign every component a unique stable identifier.',
          evidence: { componentId, occurrences: count },
        }),
      );
    }
  }

  for (const connection of architecture.connections) {
    connectionIdCounts.set(
      connection.id,
      (connectionIdCounts.get(connection.id) ?? 0) + 1,
    );

    if (!componentsById.has(connection.source)) {
      findings.push(
        createFinding({
          id: `validation:dangling-source:${connection.id}`,
          code: 'DANGLING_CONNECTION_SOURCE',
          category: 'validation',
          severity: 'high',
          edgeId: connection.id,
          title: 'Connection source is missing',
          message: `Connection “${connection.id}” references missing source “${connection.source}”.`,
          remediation:
            'Reconnect the edge to an existing component or remove it.',
          evidence: {
            connectionId: connection.id,
            missingSourceId: connection.source,
          },
        }),
      );
    }

    if (!componentsById.has(connection.target)) {
      findings.push(
        createFinding({
          id: `validation:dangling-target:${connection.id}`,
          code: 'DANGLING_CONNECTION_TARGET',
          category: 'validation',
          severity: 'high',
          edgeId: connection.id,
          title: 'Connection target is missing',
          message: `Connection “${connection.id}” references missing target “${connection.target}”.`,
          remediation:
            'Reconnect the edge to an existing component or remove it.',
          evidence: {
            connectionId: connection.id,
            missingTargetId: connection.target,
          },
        }),
      );
    }

    if (connection.source === connection.target) {
      findings.push(
        createFinding({
          id: `validation:self-connection:${connection.id}`,
          code: 'SELF_CONNECTION',
          category: 'validation',
          severity: 'high',
          componentId: connection.source,
          edgeId: connection.id,
          title: 'Component connects to itself',
          message: `Connection “${connection.id}” is an unsupported self-reference.`,
          remediation: 'Connect two distinct architecture components.',
          evidence: {
            connectionId: connection.id,
            componentId: connection.source,
          },
        }),
      );
    }

    const source = componentsById.get(connection.source);
    const target = componentsById.get(connection.target);
    if (
      source &&
      target &&
      isDirectPublicSource(source) &&
      isDataComponent(target)
    ) {
      findings.push(
        createFinding({
          id: `validation:public-database-path:${connection.id}`,
          code: 'DATABASE_DIRECTLY_EXPOSED',
          category: 'validation',
          severity: 'critical',
          componentId: target.id,
          edgeId: connection.id,
          title: 'Data service is directly exposed',
          message: `${target.name} accepts a direct connection from ${source.name}.`,
          remediation:
            'Place application and network controls between public ingress and the data tier.',
          evidence: {
            sourceId: source.id,
            targetId: target.id,
            connectionType: connection.type,
          },
        }),
      );
    }
  }

  for (const [connectionId, count] of connectionIdCounts) {
    if (count > 1) {
      findings.push(
        createFinding({
          id: `validation:duplicate-connection:${connectionId}`,
          code: 'DUPLICATE_CONNECTION_ID',
          category: 'validation',
          severity: 'high',
          edgeId: connectionId,
          title: 'Duplicate connection identifier',
          message: `${count} connections use the identifier “${connectionId}”.`,
          remediation: 'Assign every connection a unique stable identifier.',
          evidence: { connectionId, occurrences: count },
        }),
      );
    }
  }

  const degree = new Map(
    architecture.components.map((component) => [component.id, 0]),
  );
  for (const connection of architecture.connections) {
    if (degree.has(connection.source)) {
      degree.set(connection.source, (degree.get(connection.source) ?? 0) + 1);
    }
    if (degree.has(connection.target)) {
      degree.set(connection.target, (degree.get(connection.target) ?? 0) + 1);
    }
  }

  for (const component of architecture.components) {
    if (component.critical && (degree.get(component.id) ?? 0) === 0) {
      findings.push(
        createFinding({
          id: `validation:isolated-critical:${component.id}`,
          code: 'ISOLATED_CRITICAL_COMPONENT',
          category: 'validation',
          severity: 'medium',
          componentId: component.id,
          title: 'Critical component is isolated',
          message: `${component.name} has no modeled connections.`,
          remediation:
            'Connect the component to its intended upstream or downstream dependency.',
          evidence: { componentId: component.id, degree: 0 },
        }),
      );
    }
  }

  const entryIds = architectureEntryIds(architecture);
  if (entryIds.length === 0) {
    findings.push(
      createFinding({
        id: 'validation:no-entry-path',
        code: 'NO_ENTRY_PATH',
        category: 'validation',
        severity: 'high',
        title: 'Architecture has no entry path',
        message:
          'No external, API, or event entry component starts the architecture graph.',
        remediation: 'Add and connect an ingress or event source component.',
        evidence: { componentCount: architecture.components.length },
      }),
    );
  } else {
    const reachable = reachableComponentIds(architecture, entryIds);
    for (const component of architecture.components) {
      if (component.critical && !reachable.has(component.id)) {
        findings.push(
          createFinding({
            id: `validation:unreachable-critical:${component.id}`,
            code: 'CRITICAL_COMPONENT_UNREACHABLE',
            category: 'validation',
            severity: 'high',
            componentId: component.id,
            title: 'Critical component is unreachable',
            message: `${component.name} is not reachable from any modeled entry path.`,
            remediation:
              'Connect the critical component to a valid entry path.',
            evidence: { componentId: component.id, entryIds },
          }),
        );
      }
    }
  }

  const hasCompute = architecture.components.some(isComputeComponent);
  const hasDataOrIntegration = architecture.components.some(
    (component) =>
      isDataComponent(component) ||
      component.kind === 'queue' ||
      component.kind === 'event-bus',
  );

  if (!hasCompute && hasDataOrIntegration) {
    findings.push(
      createFinding({
        id: 'validation:no-compute-for-dependencies',
        code: 'NO_COMPUTE_FOR_APPLICATION_DEPENDENCIES',
        category: 'validation',
        severity: 'medium',
        title: 'Application dependencies have no compute',
        message:
          'Data or integration services exist without a modeled application runtime.',
        remediation:
          'Add the compute service that consumes these dependencies, if applicable.',
        evidence: {
          dependencyCount: architecture.components.filter(
            (component) =>
              isDataComponent(component) ||
              component.kind === 'queue' ||
              component.kind === 'event-bus',
          ).length,
        },
      }),
    );
  }

  return {
    valid: !findings.some(
      (finding) =>
        finding.severity === 'critical' || finding.severity === 'high',
    ),
    findings,
  };
}
