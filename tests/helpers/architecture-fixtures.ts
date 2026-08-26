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
