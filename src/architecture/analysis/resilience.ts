import { analyzeNetwork, attachmentOnlyKinds } from './network';
import { withEffectiveZones } from '../network/structure';
import type { Architecture, ArchitectureComponent } from '../model';
import { createFinding } from './finding';
import {
  hasIndependentReplicationPeer,
  isComponentRedundantInArchitecture,
  isProvisionedCompute,
} from './graph';
import type {
  ArchitectureFinding,
  ScoreAdjustment,
  ScoreAnalysis,
} from './types';

const RESILIENCE_BASE_SCORE = 90;

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

type ResilienceRuleInput = {
  code: string;
  delta: number;
  component?: ArchitectureComponent;
  severity: ArchitectureFinding['severity'];
  title: string;
  message: string;
  remediation: string;
  evidence: ArchitectureFinding['evidence'];
};

export function analyzeResilience(architecture: Architecture): ScoreAnalysis {
  architecture = withEffectiveZones(architecture);
  const adjustments: ScoreAdjustment[] = [];
  const findings: ArchitectureFinding[] = analyzeNetwork(architecture).filter(
    (finding) => finding.category === 'resilience',
  );
  adjustments.push(
    ...findings.map((finding) => ({
      code: finding.code,
      delta: Number(finding.evidence.scoreDelta ?? 0),
      reason: finding.message,
      componentId: finding.componentId,
      edgeId: finding.edgeId,
    })),
  );

  const applyRule = (input: ResilienceRuleInput) => {
    adjustments.push({
      code: input.code,
      delta: input.delta,
      reason: input.message,
      componentId: input.component?.id,
    });
    findings.push(
      createFinding({
        id: `resilience:${input.code.toLowerCase()}:${input.component?.id ?? 'architecture'}`,
        code: input.code,
        category: 'resilience',
        severity: input.severity,
        componentId: input.component?.id,
        title: input.title,
        message: input.message,
        remediation: input.remediation,
        evidence: input.evidence,
      }),
    );
  };

  const criticalSqlDatabases = architecture.components.filter(
    (component) => component.kind === 'sql-database' && component.critical,
  );
  for (const database of criticalSqlDatabases) {
    if (database.kind !== 'sql-database') {
      continue;
    }

    const hasNativeMultiAz =
      database.configuration.multiAZ && database.availabilityZones.length >= 2;
    const hasReplicationPeer = hasIndependentReplicationPeer(
      architecture,
      database,
    );

    if (!hasNativeMultiAz && !hasReplicationPeer) {
      applyRule({
        code: 'CRITICAL_DATABASE_SINGLE_AZ',
        delta: -12,
        component: database,
        severity: 'high',
        title: 'Critical database is single-AZ',
        message: `${database.name} has no modeled standby in another availability zone.`,
        remediation:
          'Enable Multi-AZ and model at least two availability zones.',
        evidence: {
          availabilityZones: database.availabilityZones,
          multiAZ: database.configuration.multiAZ,
          scoreDelta: -12,
        },
      });
    } else if (hasNativeMultiAz) {
      applyRule({
        code: 'CRITICAL_DATABASE_MULTI_AZ',
        delta: 4,
        component: database,
        severity: 'info',
        title: 'Critical database spans availability zones',
        message: `${database.name} models Multi-AZ database capacity.`,
        remediation: 'Maintain tested failover and backup procedures.',
        evidence: {
          availabilityZones: database.availabilityZones,
          multiAZ: database.configuration.multiAZ,
          scoreDelta: 4,
        },
      });
    } else {
      applyRule({
        code: 'CRITICAL_DATABASE_REPLICATED',
        delta: 4,
        component: database,
        severity: 'info',
        title: 'Critical database has an independent replica',
        message: `${database.name} has a modeled replication peer in another availability zone.`,
        remediation:
          'Maintain replication monitoring and test promotion procedures.',
        evidence: {
          availabilityZones: database.availabilityZones,
          replicationPeer: true,
          scoreDelta: 4,
        },
      });
    }

    if (!database.configuration.backupsEnabled) {
      applyRule({
        code: 'DATABASE_BACKUPS_DISABLED',
        delta: -7,
        component: database,
        severity: 'high',
        title: 'Database backups are disabled',
        message: `${database.name} has no modeled backup capability.`,
        remediation:
          'Enable automated backups and document recovery objectives.',
        evidence: { backupsEnabled: false, scoreDelta: -7 },
      });
    }
  }

  const criticalProvisionedCompute = architecture.components.filter(
    (component) => component.critical && isProvisionedCompute(component),
  );
  for (const compute of criticalProvisionedCompute) {
    const spansZones = compute.availabilityZones.length >= 2;
    const hasReplicas = compute.replicas >= 2;

    if (!spansZones) {
      applyRule({
        code: 'CRITICAL_COMPUTE_SINGLE_AZ',
        delta: -8,
        component: compute,
        severity: 'high',
        title: 'Critical compute is single-AZ',
        message: `${compute.name} is modeled only in ${compute.availabilityZones[0] ?? 'one implicit zone'}.`,
        remediation:
          'Distribute critical compute across at least two availability zones.',
        evidence: {
          availabilityZones: compute.availabilityZones,
          scoreDelta: -8,
        },
      });
    }

    if (!hasReplicas) {
      applyRule({
        code: 'CRITICAL_COMPUTE_SINGLE_REPLICA',
        delta: -7,
        component: compute,
        severity: 'high',
        title: 'Critical compute has one replica',
        message: `${compute.name} has a single modeled runtime replica.`,
        remediation:
          'Run at least two replicas and distribute them across zones.',
        evidence: { replicas: compute.replicas, scoreDelta: -7 },
      });
    }

    if (spansZones && hasReplicas) {
      applyRule({
        code: 'CRITICAL_COMPUTE_REPLICATED_MULTI_AZ',
        delta: 5,
        component: compute,
        severity: 'info',
        title: 'Critical compute is replicated across zones',
        message: `${compute.name} models ${compute.replicas} replicas across ${compute.availabilityZones.length} zones.`,
        remediation: 'Maintain health checks and safe deployment policies.',
        evidence: {
          replicas: compute.replicas,
          availabilityZones: compute.availabilityZones,
          scoreDelta: 5,
        },
      });
    }
  }

  const totalProvisionedReplicas = architecture.components
    .filter(isProvisionedCompute)
    .reduce((total, component) => total + component.replicas, 0);
  const hasLoadBalancer = architecture.components.some(
    (component) => component.kind === 'load-balancer',
  );
  if (totalProvisionedReplicas > 1 && !hasLoadBalancer) {
    applyRule({
      code: 'MULTI_COMPUTE_WITHOUT_LOAD_BALANCER',
      delta: -6,
      severity: 'medium',
      title: 'Replicated compute lacks a load balancer',
      message: `${totalProvisionedReplicas} compute replicas are modeled without a load balancer.`,
      remediation:
        'Add a load balancer or document another traffic distribution mechanism.',
      evidence: { totalProvisionedReplicas, scoreDelta: -6 },
    });
  }

  const eventDriven =
    architecture.components.some(
      (component) =>
        component.kind === 'event-bus' || component.kind === 'worker',
    ) ||
    architecture.connections.some((connection) => connection.type === 'async');
  const hasQueue = architecture.components.some(
    (component) => component.kind === 'queue',
  );
  const hasProcessingCompute = architecture.components.some(
    (component) =>
      component.kind === 'serverless-function' ||
      component.kind === 'container-service' ||
      component.kind === 'worker',
  );

  if (eventDriven && hasProcessingCompute && !hasQueue) {
    applyRule({
      code: 'ASYNC_BUFFERING_MISSING',
      delta: -8,
      severity: 'medium',
      title: 'Event processing lacks durable buffering',
      message: 'An event-driven processing path has no modeled queue.',
      remediation: 'Add durable queue buffering and a dead-letter strategy.',
      evidence: { eventDriven: true, hasQueue: false, scoreDelta: -8 },
    });
  } else if (hasQueue) {
    applyRule({
      code: 'QUEUE_BUFFERING_PRESENT',
      delta: 2,
      severity: 'info',
      title: 'Durable queue buffering is present',
      message:
        'The architecture includes a managed queue for workload buffering.',
      remediation: 'Maintain retry, retention, and dead-letter policies.',
      evidence: { queueCount: 1, scoreDelta: 2 },
    });
  }

  const criticalComponents = architecture.components.filter(
    (component) =>
      component.critical && !attachmentOnlyKinds.has(component.kind),
  );
  const nonRedundantCritical = criticalComponents.filter(
    (component) => !isComponentRedundantInArchitecture(architecture, component),
  );

  if (nonRedundantCritical.length > 0) {
    applyRule({
      code: 'CRITICAL_PATH_SINGLE_POINTS',
      delta: -6,
      severity: 'high',
      title: 'Critical path contains single points of failure',
      message: `${nonRedundantCritical.length} critical component${nonRedundantCritical.length === 1 ? '' : 's'} lack modeled redundancy.`,
      remediation:
        'Add replica and zone redundancy to every critical-path component.',
      evidence: {
        componentIds: nonRedundantCritical.map((component) => component.id),
        scoreDelta: -6,
      },
    });
  } else if (criticalComponents.length > 1) {
    applyRule({
      code: 'CRITICAL_PATH_REPLICATED',
      delta: 3,
      severity: 'info',
      title: 'Critical path is replicated',
      message:
        'Every modeled critical-path component has a redundancy mechanism.',
      remediation: 'Validate failover behavior with deterministic simulations.',
      evidence: {
        componentIds: criticalComponents.map((component) => component.id),
        scoreDelta: 3,
      },
    });
  }

  return {
    baseScore: RESILIENCE_BASE_SCORE,
    score: clampScore(
      RESILIENCE_BASE_SCORE +
        adjustments.reduce((total, adjustment) => total + adjustment.delta, 0),
    ),
    adjustments,
    findings,
  };
}
