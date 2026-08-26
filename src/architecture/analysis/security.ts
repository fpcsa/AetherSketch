import type { Architecture, ArchitectureComponent } from '../model';
import { createFinding } from './finding';
import {
  containsPotentialSecret,
  encryptionAtRestState,
  isComputeComponent,
  isDataComponent,
} from './graph';
import type {
  ArchitectureFinding,
  ScoreAdjustment,
  ScoreAnalysis,
} from './types';

const SECURITY_BASE_SCORE = 82;

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

type SecurityRuleInput = {
  code: string;
  delta: number;
  component?: ArchitectureComponent;
  edgeId?: string;
  severity: ArchitectureFinding['severity'];
  title: string;
  message: string;
  remediation: string;
  evidence: ArchitectureFinding['evidence'];
};

export function analyzeSecurity(architecture: Architecture): ScoreAnalysis {
  const adjustments: ScoreAdjustment[] = [];
  const findings: ArchitectureFinding[] = [];

  const applyRule = (input: SecurityRuleInput) => {
    adjustments.push({
      code: input.code,
      delta: input.delta,
      reason: input.message,
      componentId: input.component?.id,
      edgeId: input.edgeId,
    });
    findings.push(
      createFinding({
        id: `security:${input.code.toLowerCase()}:${input.component?.id ?? input.edgeId ?? 'architecture'}`,
        code: input.code,
        category: 'security',
        severity: input.severity,
        componentId: input.component?.id,
        edgeId: input.edgeId,
        title: input.title,
        message: input.message,
        remediation: input.remediation,
        evidence: input.evidence,
      }),
    );
  };

  for (const component of architecture.components) {
    if (
      component.kind === 'sql-database' &&
      component.configuration.publicAccess
    ) {
      applyRule({
        code: 'PUBLIC_DATABASE',
        delta: -25,
        component,
        severity: 'critical',
        title: 'Database allows public access',
        message: `${component.name} is modeled with public network access.`,
        remediation:
          'Place the database in private subnets and restrict inbound access.',
        evidence: { publicAccess: true, scoreDelta: -25 },
      });
    }

    const encryptionState = encryptionAtRestState(component);
    if (encryptionState === false) {
      const database =
        component.kind === 'sql-database' ||
        component.kind === 'nosql-database';
      applyRule({
        code: database ? 'UNENCRYPTED_DATABASE' : 'UNENCRYPTED_DATA_SERVICE',
        delta: database ? -20 : -12,
        component,
        severity: database ? 'critical' : 'high',
        title: database
          ? 'Database encryption is disabled'
          : 'Data service encryption is disabled',
        message: `${component.name} does not model encryption at rest.`,
        remediation:
          'Enable provider-managed or customer-managed encryption at rest.',
        evidence: { encrypted: false, scoreDelta: database ? -20 : -12 },
      });
    }

    if (
      component.kind === 'object-storage' &&
      component.configuration.publicAccess
    ) {
      applyRule({
        code: 'PUBLIC_OBJECT_STORAGE',
        delta: -15,
        component,
        severity: 'high',
        title: 'Object storage allows public access',
        message: `${component.name} permits public object access.`,
        remediation:
          'Block public access and use narrowly scoped delivery controls.',
        evidence: { publicAccess: true, scoreDelta: -15 },
      });
    }

    if (containsPotentialSecret(component.metadata)) {
      applyRule({
        code: 'SECRET_IN_COMPONENT_METADATA',
        delta: -15,
        component,
        severity: 'high',
        title: 'Potential secret stored in ordinary metadata',
        message: `${component.name} contains a secret-like metadata key or value.`,
        remediation: 'Move secret material to a dedicated secrets manager.',
        evidence: { metadataContainsPotentialSecret: true, scoreDelta: -15 },
      });
    }
  }

  for (const connection of architecture.connections) {
    if (connection.type === 'data' && !connection.encrypted) {
      applyRule({
        code: 'UNENCRYPTED_DATA_CONNECTION',
        delta: -12,
        edgeId: connection.id,
        severity: 'high',
        title: 'Data connection is not encrypted',
        message: `Connection “${connection.id}” carries modeled data without encrypted transport.`,
        remediation: 'Require TLS or another authenticated encrypted protocol.',
        evidence: {
          connectionId: connection.id,
          protocol: connection.protocol ?? 'unspecified',
          encrypted: false,
          scoreDelta: -12,
        },
      });
    }
  }

  const publicWebArchitecture = architecture.components.some(
    (component) =>
      component.kind === 'internet' ||
      component.kind === 'cdn' ||
      (component.kind === 'load-balancer' &&
        component.configuration.scheme === 'internet-facing') ||
      (component.kind === 'api-gateway' &&
        component.configuration.endpointType !== 'private'),
  );
  const hasWaf = architecture.components.some(
    (component) => component.kind === 'waf',
  );
  if (publicWebArchitecture && !hasWaf) {
    applyRule({
      code: 'PUBLIC_WEB_WITHOUT_WAF',
      delta: -6,
      severity: 'medium',
      title: 'Public web path has no WAF',
      message:
        'The public request path has no modeled web application firewall.',
      remediation: 'Add a WAF with managed rules and rate limiting.',
      evidence: { publicWebArchitecture: true, hasWaf: false, scoreDelta: -6 },
    });
  } else if (publicWebArchitecture && hasWaf) {
    applyRule({
      code: 'WAF_PRESENT',
      delta: 3,
      severity: 'info',
      title: 'Web application firewall is present',
      message: 'The public request path includes a modeled WAF.',
      remediation: 'Maintain managed rules and monitor blocked requests.',
      evidence: { hasWaf: true, scoreDelta: 3 },
    });
  }

  const hasCompute = architecture.components.some(isComputeComponent);
  const hasData = architecture.components.some(isDataComponent);
  const hasSecretsManager = architecture.components.some(
    (component) => component.kind === 'secrets-manager',
  );
  if (hasCompute && hasData && !hasSecretsManager) {
    applyRule({
      code: 'SECRETS_MANAGER_MISSING',
      delta: -5,
      severity: 'medium',
      title: 'Application has no secrets manager',
      message:
        'Compute and data services exist without a modeled secrets manager.',
      remediation:
        'Add a dedicated secrets manager and rotate application credentials.',
      evidence: {
        hasCompute,
        hasData,
        hasSecretsManager: false,
        scoreDelta: -5,
      },
    });
  }

  const encryptableComponents = architecture.components.filter(
    (component) => encryptionAtRestState(component) !== null,
  );
  if (
    encryptableComponents.length > 0 &&
    encryptableComponents.every(
      (component) => encryptionAtRestState(component) === true,
    )
  ) {
    applyRule({
      code: 'ENCRYPTION_AT_REST_COMPLETE',
      delta: 3,
      severity: 'info',
      title: 'Modeled data services are encrypted',
      message:
        'Every modeled encryptable data service has encryption at rest enabled.',
      remediation: 'Maintain encryption-key access controls and rotation.',
      evidence: {
        componentIds: encryptableComponents.map((component) => component.id),
        scoreDelta: 3,
      },
    });
  }

  const dataConnections = architecture.connections.filter(
    (connection) => connection.type === 'data',
  );
  if (
    dataConnections.length > 0 &&
    dataConnections.every((connection) => connection.encrypted)
  ) {
    applyRule({
      code: 'ENCRYPTED_DATA_TRANSPORT',
      delta: 2,
      severity: 'info',
      title: 'Data connections use encrypted transport',
      message: 'Every modeled data connection is encrypted.',
      remediation:
        'Continue enforcing encrypted protocols and certificate validation.',
      evidence: {
        connectionIds: dataConnections.map((connection) => connection.id),
        scoreDelta: 2,
      },
    });
  }

  return {
    baseScore: SECURITY_BASE_SCORE,
    score: clampScore(
      SECURITY_BASE_SCORE +
        adjustments.reduce((total, adjustment) => total + adjustment.delta, 0),
    ),
    adjustments,
    findings,
  };
}
