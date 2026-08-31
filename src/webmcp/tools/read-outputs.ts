import { effectiveZones } from '../../architecture/network/structure';
import { getCatalogEntry } from '../../architecture/catalog';
import type {
  ArchitectureAnalysis,
  ArchitectureFinding,
} from '../../architecture/analysis';
import type {
  Architecture,
  ArchitectureComponent,
} from '../../architecture/model';
import type { FailureSimulationResult } from '../../architecture/simulation';

type AnalysisSnapshot = {
  analysis: ArchitectureAnalysis | null;
  stale: boolean;
};

type ComponentRelationship = {
  connectionId: string;
  direction: 'incoming' | 'outgoing';
  otherComponentId: string;
  type: Architecture['connections'][number]['type'];
  protocol: string | undefined;
  encrypted: boolean;
};

function compactFinding(finding: ArchitectureFinding) {
  return {
    id: finding.id,
    code: finding.code,
    category: finding.category,
    severity: finding.severity,
    componentId: finding.componentId,
    edgeId: finding.edgeId,
    title: finding.title,
    message: finding.message,
    remediation: finding.remediation,
  };
}

export function compactArchitecture(
  architecture: Architecture,
  snapshot: AnalysisSnapshot,
) {
  const currentAnalysis =
    !snapshot.stale &&
    snapshot.analysis?.architectureId === architecture.id &&
    snapshot.analysis.architectureRevision === architecture.revision
      ? snapshot.analysis
      : null;

  return {
    id: architecture.id,
    name: architecture.name,
    revision: architecture.revision,
    provider: {
      provider: architecture.provider.provider,
      environment: architecture.provider.environment,
    },
    region: architecture.region,
    constraints: {
      maximumMonthlyCost: architecture.constraints.maximumMonthlyCost,
      targetResilienceScore: architecture.constraints.targetResilienceScore,
      targetSecurityScore: architecture.constraints.targetSecurityScore,
      requiredRegion: architecture.constraints.requiredRegion,
      requireMultiAZ: architecture.constraints.requireMultiAZ,
      requireEncryptionAtRest: architecture.constraints.requireEncryptionAtRest,
    },
    components: architecture.components.map((component) => ({
      id: component.id,
      name: component.name,
      kind: component.kind,
      provider: component.provider,
      service: component.service,
      region: component.region,
      availabilityZones: effectiveZones(architecture, component),
      replicas: component.replicas,
      network: component.network,
      critical: component.critical,
      locked: component.locked,
    })),
    connections: architecture.connections.map((connection) => ({
      id: connection.id,
      source: connection.source,
      target: connection.target,
      sourcePort: connection.sourcePort ?? 'right',
      targetPort: connection.targetPort ?? 'left',
      type: connection.type,
      protocol: connection.protocol,
      encrypted: connection.encrypted,
      critical: connection.critical,
    })),
    lockedComponentIds: architecture.components
      .filter((component) => component.locked)
      .map((component) => component.id),
    metrics: currentAnalysis
      ? {
          estimatedMonthlyCost: currentAnalysis.estimatedMonthlyCost,
          resilienceScore: currentAnalysis.resilienceScore,
          securityScore: currentAnalysis.securityScore,
          validationStatus: currentAnalysis.validationStatus,
        }
      : undefined,
    metricsStatus: currentAnalysis
      ? 'current'
      : snapshot.analysis
        ? 'stale'
        : 'unavailable',
  };
}

export function inspectArchitectureComponent(
  architecture: Architecture,
  component: ArchitectureComponent,
) {
  const catalog = getCatalogEntry(component.kind);
  const relationships = architecture.connections.flatMap<ComponentRelationship>(
    (connection) => {
      if (connection.source === component.id) {
        return [
          {
            connectionId: connection.id,
            direction: 'outgoing' as const,
            otherComponentId: connection.target,
            type: connection.type,
            protocol: connection.protocol,
            encrypted: connection.encrypted,
          },
        ];
      }
      if (connection.target === component.id) {
        return [
          {
            connectionId: connection.id,
            direction: 'incoming' as const,
            otherComponentId: connection.source,
            type: connection.type,
            protocol: connection.protocol,
            encrypted: connection.encrypted,
          },
        ];
      }
      return [];
    },
  );

  return {
    id: component.id,
    name: component.name,
    kind: component.kind,
    category: catalog.category,
    provider: component.provider,
    service: component.service,
    region: component.region,
    availabilityZones: effectiveZones(architecture, component),
    replicas: component.replicas,
    network: component.network,
    configuration: component.configuration,
    estimatedMonthlyCost: component.estimatedMonthlyCost,
    locked: component.locked,
    critical: component.critical,
    relationships,
  };
}

export function compactAnalysis(analysis: ArchitectureAnalysis) {
  const findings = analysis.findings.slice(0, 100).map(compactFinding);
  return {
    architectureId: analysis.architectureId,
    architectureRevision: analysis.architectureRevision,
    focus: analysis.focus,
    estimatedMonthlyCost: analysis.estimatedMonthlyCost,
    resilienceScore: analysis.resilienceScore,
    securityScore: analysis.securityScore,
    validationStatus: analysis.validationStatus,
    constraints: analysis.constraints,
    findingCount: analysis.findings.length,
    findingsTruncated: findings.length < analysis.findings.length,
    findings,
  };
}

export function compactSimulation(simulation: FailureSimulationResult) {
  const findings = simulation.findings.slice(0, 50).map(compactFinding);
  return {
    architectureId: simulation.architectureId,
    architectureRevision: simulation.architectureRevision,
    scope: simulation.scope,
    target: simulation.target,
    status: simulation.status,
    failedCount: simulation.failedComponentIds.length,
    degradedCount: simulation.degradedComponentIds.length,
    failedComponentIds: simulation.failedComponentIds,
    degradedComponentIds: simulation.degradedComponentIds,
    impactedEdgeIds: simulation.impactedEdgeIds,
    survivingComponentCount: simulation.survivingComponentIds.length,
    criticalPathRemaining: simulation.criticalPathsRemaining,
    explanation: simulation.explanation,
    findingCount: simulation.findings.length,
    findingsTruncated: findings.length < simulation.findings.length,
    findings,
  };
}
