import { createComponentFromCatalog } from '../../src/architecture/catalog';
import {
  validateArchitecture,
  type Architecture,
} from '../../src/architecture/model';
import { getArchitectureTemplate } from '../../src/templates';

export function getHardenedEcommerceArchitecture(): Architecture {
  const architecture = getArchitectureTemplate('ecommerce-production');
  const context = {
    provider: architecture.provider.provider,
    region: architecture.region,
  };
  const waf = createComponentFromCatalog(
    {
      id: 'ecommerce-waf',
      kind: 'waf',
      name: 'Storefront WAF',
      critical: true,
      position: { x: 380, y: 220 },
    },
    context,
  );
  const secretsManager = createComponentFromCatalog(
    {
      id: 'ecommerce-secrets',
      kind: 'secrets-manager',
      name: 'Application Secrets',
      position: { x: 740, y: 390 },
    },
    context,
  );

  return validateArchitecture({
    ...architecture,
    revision: architecture.revision + 1,
    components: [
      ...architecture.components.map((component) => {
        if (component.kind === 'container-service') {
          return {
            ...component,
            replicas: 3,
            availabilityZones: ['eu-west-1a', 'eu-west-1b'],
            configuration: { ...component.configuration, autoscaling: true },
          };
        }

        if (component.kind === 'sql-database') {
          return {
            ...component,
            availabilityZones: ['eu-west-1a', 'eu-west-1b'],
            configuration: { ...component.configuration, multiAZ: true },
          };
        }

        return component;
      }),
      waf,
      secretsManager,
    ],
    connections: [
      ...architecture.connections.map((connection) =>
        connection.id === 'ecommerce-edge-2'
          ? { ...connection, target: waf.id }
          : connection,
      ),
      {
        id: 'ecommerce-edge-waf-alb',
        source: waf.id,
        target: 'ecommerce-alb',
        type: 'request' as const,
        protocol: 'HTTPS',
        encrypted: true,
        critical: true,
        metadata: {},
      },
      {
        id: 'ecommerce-edge-secrets',
        source: secretsManager.id,
        target: 'ecommerce-ecs',
        type: 'management' as const,
        protocol: 'HTTPS',
        encrypted: true,
        critical: false,
        metadata: {},
      },
    ],
    constraints: {
      maximumMonthlyCost: 1300,
      targetResilienceScore: 90,
      targetSecurityScore: 90,
      requiredRegion: 'eu-west-1',
      requireMultiAZ: true,
      requireEncryptionAtRest: true,
    },
  });
}

export function getAgentImprovedLockedEcommerceArchitecture(): Architecture {
  const architecture = getArchitectureTemplate('ecommerce-production');
  const context = {
    provider: architecture.provider.provider,
    region: architecture.region,
  };
  const additions = [
    createComponentFromCatalog(
      {
        id: 'agent-waf',
        kind: 'waf',
        name: 'Storefront WAF',
        critical: true,
        position: { x: 420, y: 90 },
      },
      context,
    ),
    createComponentFromCatalog(
      {
        id: 'agent-queue',
        kind: 'queue',
        name: 'Order Buffer',
        configuration: { deadLetterQueue: true, encrypted: true },
        position: { x: 760, y: 390 },
      },
      context,
    ),
    createComponentFromCatalog(
      {
        id: 'agent-secrets',
        kind: 'secrets-manager',
        name: 'Application Secrets',
        configuration: { automaticRotation: true },
        position: { x: 520, y: 390 },
      },
      context,
    ),
    createComponentFromCatalog(
      {
        id: 'agent-database-replica',
        kind: 'sql-database',
        name: 'Orders Failover Replica',
        availabilityZones: ['eu-west-1b'],
        configuration: {
          engine: 'postgresql',
          multiAZ: false,
          encrypted: true,
          backupsEnabled: true,
          publicAccess: false,
        },
        position: { x: 980, y: 390 },
      },
      context,
    ),
  ];

  return validateArchitecture({
    ...architecture,
    revision: 12,
    components: [
      ...architecture.components.map((component) => {
        if (component.id === 'ecommerce-ecs') {
          return {
            ...component,
            replicas: 2,
            availabilityZones: ['eu-west-1a', 'eu-west-1b'],
            configuration: { ...component.configuration, autoscaling: true },
          };
        }
        if (component.id === 'ecommerce-postgresql') {
          return { ...component, locked: true };
        }
        return component;
      }),
      ...additions,
    ],
    connections: [
      ...architecture.connections.filter(
        (connection) => connection.id !== 'ecommerce-edge-2',
      ),
      {
        id: 'agent-edge-cdn-waf',
        source: 'ecommerce-cloudfront',
        target: 'agent-waf',
        type: 'request' as const,
        protocol: 'HTTPS',
        encrypted: true,
        critical: true,
        metadata: {},
      },
      {
        id: 'agent-edge-waf-alb',
        source: 'agent-waf',
        target: 'ecommerce-alb',
        type: 'request' as const,
        protocol: 'HTTPS',
        encrypted: true,
        critical: true,
        metadata: {},
      },
      {
        id: 'agent-edge-queue',
        source: 'ecommerce-ecs',
        target: 'agent-queue',
        type: 'async' as const,
        protocol: 'HTTPS',
        encrypted: true,
        critical: false,
        metadata: {},
      },
      {
        id: 'agent-edge-secrets',
        source: 'agent-secrets',
        target: 'ecommerce-ecs',
        type: 'management' as const,
        protocol: 'HTTPS',
        encrypted: true,
        critical: false,
        metadata: {},
      },
      {
        id: 'agent-edge-replication',
        source: 'ecommerce-postgresql',
        target: 'agent-database-replica',
        type: 'replication' as const,
        protocol: 'PostgreSQL/TLS',
        encrypted: true,
        critical: true,
        metadata: {},
      },
    ],
    constraints: {
      maximumMonthlyCost: 3000,
      targetResilienceScore: 90,
      targetSecurityScore: 90,
      requiredRegion: 'eu-west-1',
      requireMultiAZ: false,
      requireEncryptionAtRest: true,
    },
  });
}
