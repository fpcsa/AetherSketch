import { architectureComponentSchema } from '../model/schemas';
import type {
  AddComponentInput,
  ArchitectureComponent,
  ComponentCategory,
  ComponentConfigurationMap,
  ComponentKind,
  ComponentOfKind,
  ProviderContext,
} from '../model/types';

export type ComponentCatalogEntry<K extends ComponentKind> = {
  kind: K;
  displayName: string;
  category: ComponentCategory;
  description: string;
  aws: {
    service: string;
    displayName: string;
  };
  defaultConfiguration: ComponentConfigurationMap[K];
  baseMonthlyEstimate: number;
  defaultSize: {
    width: number;
    height: number;
  };
  defaultReplicas: number;
  defaultAvailabilityZoneCount: number;
  supportedProperties: readonly string[];
};

export type ComponentCatalog = {
  [K in ComponentKind]: ComponentCatalogEntry<K>;
};

export const componentCatalog = {
  'virtual-network': {
    kind: 'virtual-network',
    displayName: 'Virtual Network',
    category: 'network',
    description:
      'Network boundary with IPv4 address space and resource membership.',
    aws: { service: 'amazon-vpc', displayName: 'Amazon VPC' },
    defaultConfiguration: { cidr: '10.0.0.0/16' },
    baseMonthlyEstimate: 0,
    defaultSize: { width: 216, height: 104 },
    defaultReplicas: 1,
    defaultAvailabilityZoneCount: 0,
    supportedProperties: ['cidr', 'network', 'critical', 'position'],
  },
  subnet: {
    kind: 'subnet',
    displayName: 'Subnet',
    category: 'network',
    description:
      'Zonal network boundary with public/private intent and explicit routes.',
    aws: { service: 'vpc-subnet', displayName: 'Amazon VPC Subnet' },
    defaultConfiguration: {
      cidr: '10.0.1.0/24',
      visibility: 'private',
      routes: [],
    },
    baseMonthlyEstimate: 0,
    defaultSize: { width: 216, height: 104 },
    defaultReplicas: 1,
    defaultAvailabilityZoneCount: 1,
    supportedProperties: [
      'cidr',
      'visibility',
      'routes',
      'network',
      'critical',
      'position',
    ],
  },
  'nat-gateway': {
    kind: 'nat-gateway',
    displayName: 'NAT Gateway',
    category: 'network',
    description:
      'Zonal outbound internet gateway. Place in a public subnet with an Internet Gateway route.',
    aws: { service: 'nat-gateway', displayName: 'AWS NAT Gateway' },
    defaultConfiguration: { monthlyDataGb: 0 },
    baseMonthlyEstimate: 35,
    defaultSize: { width: 216, height: 104 },
    defaultReplicas: 1,
    defaultAvailabilityZoneCount: 1,
    supportedProperties: ['monthlyDataGb', 'network', 'critical', 'position'],
  },
  'security-group': {
    kind: 'security-group',
    displayName: 'Network Security Rules',
    category: 'network',
    description:
      'Attached stateful allow rules for initiated connections. Empty ingress denies inbound traffic.',
    aws: {
      service: 'security-group',
      displayName: 'Amazon VPC Security Group',
    },
    defaultConfiguration: {
      ingress: [],
      egress: [{ peerId: '*', protocol: '*' }],
    },
    baseMonthlyEstimate: 0,
    defaultSize: { width: 216, height: 104 },
    defaultReplicas: 1,
    defaultAvailabilityZoneCount: 0,
    supportedProperties: [
      'ingress',
      'egress',
      'network',
      'critical',
      'position',
    ],
  },
  'private-endpoint': {
    kind: 'private-endpoint',
    displayName: 'Private Service Endpoint',
    category: 'network',
    description:
      'Private access to one managed service, with placement and security rules.',
    aws: {
      service: 'vpc-interface-endpoint',
      displayName: 'AWS PrivateLink Interface Endpoint',
    },
    defaultConfiguration: { serviceId: '', monthlyDataGb: 0 },
    baseMonthlyEstimate: 8,
    defaultSize: { width: 216, height: 104 },
    defaultReplicas: 1,
    defaultAvailabilityZoneCount: 1,
    supportedProperties: [
      'serviceId',
      'monthlyDataGb',
      'network',
      'critical',
      'position',
    ],
  },
  'external-network': {
    kind: 'external-network',
    displayName: 'External Network',
    category: 'network',
    description:
      'Office, data center, or remote network connected through a VPN.',
    aws: { service: 'customer-network', displayName: 'On-premises Network' },
    defaultConfiguration: { cidr: '172.16.0.0/16' },
    baseMonthlyEstimate: 0,
    defaultSize: { width: 216, height: 104 },
    defaultReplicas: 1,
    defaultAvailabilityZoneCount: 0,
    supportedProperties: ['cidr', 'network', 'critical', 'position'],
  },
  'vpn-connection': {
    kind: 'vpn-connection',
    displayName: 'VPN Connection',
    category: 'network',
    description:
      'Encrypted connection between an external network and a Virtual Private Gateway.',
    aws: { service: 'site-to-site-vpn', displayName: 'AWS Site-to-Site VPN' },
    defaultConfiguration: {
      gatewayId: '',
      externalNetworkId: '',
      tunnels: 2,
      encrypted: true,
    },
    baseMonthlyEstimate: 36.5,
    defaultSize: { width: 216, height: 104 },
    defaultReplicas: 1,
    defaultAvailabilityZoneCount: 0,
    supportedProperties: [
      'gatewayId',
      'externalNetworkId',
      'tunnels',
      'encrypted',
      'network',
      'critical',
      'position',
    ],
  },
  internet: {
    kind: 'internet',
    displayName: 'Internet',
    category: 'network',
    description: 'Conceptual public traffic source outside the cloud boundary.',
    aws: { service: 'internet', displayName: 'Public Internet' },
    defaultConfiguration: { entryType: 'public-internet' },
    baseMonthlyEstimate: 0,
    defaultSize: { width: 156, height: 72 },
    defaultReplicas: 1,
    defaultAvailabilityZoneCount: 0,
    supportedProperties: ['critical', 'position'],
  },
  'internet-gateway': {
    kind: 'internet-gateway',
    displayName: 'Internet Gateway',
    category: 'network',
    description:
      'Regional gateway between a virtual network and the public internet. Model routing with connections; traffic charges are excluded.',
    aws: { service: 'internet-gateway', displayName: 'AWS Internet Gateway' },
    defaultConfiguration: {},
    baseMonthlyEstimate: 0,
    defaultSize: { width: 192, height: 88 },
    defaultReplicas: 1,
    defaultAvailabilityZoneCount: 0,
    supportedProperties: ['critical', 'position'],
  },
  'virtual-private-gateway': {
    kind: 'virtual-private-gateway',
    displayName: 'Virtual Private Gateway',
    category: 'network',
    description:
      'Regional gateway for private connectivity to an external network. VPN connections, dedicated links, and traffic charges are excluded.',
    aws: {
      service: 'virtual-private-gateway',
      displayName: 'AWS Virtual Private Gateway',
    },
    defaultConfiguration: { asn: 64512 },
    baseMonthlyEstimate: 0,
    defaultSize: { width: 208, height: 96 },
    defaultReplicas: 1,
    defaultAvailabilityZoneCount: 0,
    supportedProperties: ['asn', 'critical', 'position'],
  },
  dns: {
    kind: 'dns',
    displayName: 'DNS',
    category: 'network',
    description: 'Domain routing and health-aware traffic distribution.',
    aws: { service: 'route-53', displayName: 'Amazon Route 53' },
    defaultConfiguration: { routingPolicy: 'simple', zoneType: 'public' },
    baseMonthlyEstimate: 2,
    defaultSize: { width: 168, height: 76 },
    defaultReplicas: 1,
    defaultAvailabilityZoneCount: 0,
    supportedProperties: ['routingPolicy', 'zoneType', 'critical'],
  },
  cdn: {
    kind: 'cdn',
    displayName: 'CDN',
    category: 'network',
    description: 'Global edge delivery and content caching.',
    aws: { service: 'cloudfront', displayName: 'Amazon CloudFront' },
    defaultConfiguration: { cachePolicy: 'managed', priceClass: 'regional' },
    baseMonthlyEstimate: 85,
    defaultSize: { width: 176, height: 80 },
    defaultReplicas: 1,
    defaultAvailabilityZoneCount: 0,
    supportedProperties: ['cachePolicy', 'priceClass', 'critical'],
  },
  waf: {
    kind: 'waf',
    displayName: 'Web Application Firewall',
    category: 'network',
    description: 'Managed application-layer traffic protection.',
    aws: { service: 'waf', displayName: 'AWS WAF' },
    defaultConfiguration: { managedRules: true, rateLimiting: true },
    baseMonthlyEstimate: 35,
    defaultSize: { width: 184, height: 80 },
    defaultReplicas: 1,
    defaultAvailabilityZoneCount: 0,
    supportedProperties: ['managedRules', 'rateLimiting', 'critical'],
  },
  'load-balancer': {
    kind: 'load-balancer',
    displayName: 'Load Balancer',
    category: 'network',
    description: 'Regional request distribution across compute targets.',
    aws: {
      service: 'application-load-balancer',
      displayName: 'Application Load Balancer',
    },
    defaultConfiguration: { scheme: 'internet-facing', crossZone: true },
    baseMonthlyEstimate: 32,
    defaultSize: { width: 184, height: 80 },
    defaultReplicas: 1,
    defaultAvailabilityZoneCount: 2,
    supportedProperties: [
      'scheme',
      'crossZone',
      'availabilityZones',
      'critical',
    ],
  },
  'api-gateway': {
    kind: 'api-gateway',
    displayName: 'API Gateway',
    category: 'network',
    description: 'Managed HTTP API ingress and request controls.',
    aws: { service: 'api-gateway', displayName: 'Amazon API Gateway' },
    defaultConfiguration: { endpointType: 'regional', throttlingEnabled: true },
    baseMonthlyEstimate: 28,
    defaultSize: { width: 184, height: 80 },
    defaultReplicas: 1,
    defaultAvailabilityZoneCount: 0,
    supportedProperties: ['endpointType', 'throttlingEnabled', 'critical'],
  },
  'virtual-machine': {
    kind: 'virtual-machine',
    displayName: 'Virtual Machine',
    category: 'compute',
    description: 'General-purpose provisioned compute instance.',
    aws: { service: 'ec2', displayName: 'Amazon EC2' },
    defaultConfiguration: {
      instanceType: 't3.medium',
      operatingSystem: 'linux',
      autoscaling: false,
    },
    baseMonthlyEstimate: 42,
    defaultSize: { width: 184, height: 84 },
    defaultReplicas: 1,
    defaultAvailabilityZoneCount: 1,
    supportedProperties: [
      'instanceType',
      'operatingSystem',
      'autoscaling',
      'replicas',
      'availabilityZones',
      'critical',
    ],
  },
  'container-service': {
    kind: 'container-service',
    displayName: 'Container Service',
    category: 'compute',
    description: 'Managed container workload and service scheduling.',
    aws: { service: 'ecs', displayName: 'Amazon ECS' },
    defaultConfiguration: {
      launchType: 'fargate',
      cpu: 512,
      memoryMb: 1024,
      autoscaling: false,
    },
    baseMonthlyEstimate: 138,
    defaultSize: { width: 192, height: 88 },
    defaultReplicas: 1,
    defaultAvailabilityZoneCount: 1,
    supportedProperties: [
      'launchType',
      'cpu',
      'memoryMb',
      'autoscaling',
      'replicas',
      'availabilityZones',
      'critical',
    ],
  },
  'serverless-function': {
    kind: 'serverless-function',
    displayName: 'Serverless Function',
    category: 'compute',
    description: 'Event-driven managed function runtime.',
    aws: { service: 'lambda', displayName: 'AWS Lambda' },
    defaultConfiguration: {
      runtime: 'nodejs22.x',
      memoryMb: 512,
      timeoutSeconds: 30,
    },
    baseMonthlyEstimate: 24,
    defaultSize: { width: 188, height: 84 },
    defaultReplicas: 1,
    defaultAvailabilityZoneCount: 0,
    supportedProperties: ['runtime', 'memoryMb', 'timeoutSeconds', 'critical'],
  },
  worker: {
    kind: 'worker',
    displayName: 'Edge Worker',
    category: 'compute',
    description: 'Globally distributed edge execution runtime.',
    aws: { service: 'lambda-at-edge', displayName: 'Lambda@Edge' },
    defaultConfiguration: { runtime: 'edge' },
    baseMonthlyEstimate: 18,
    defaultSize: { width: 180, height: 80 },
    defaultReplicas: 1,
    defaultAvailabilityZoneCount: 0,
    supportedProperties: ['runtime', 'critical'],
  },
  'serverless-ai': {
    kind: 'serverless-ai',
    displayName: 'Serverless AI / LLM',
    category: 'ai',
    description:
      'Managed foundation-model inference without provisioned model infrastructure.',
    aws: { service: 'bedrock-runtime', displayName: 'Amazon Bedrock' },
    defaultConfiguration: {
      modelId: 'provider-managed-foundation-model',
      modality: 'text',
      guardrailsEnabled: true,
      privateAccess: true,
      encrypted: true,
      dataLogging: false,
    },
    baseMonthlyEstimate: 95,
    defaultSize: { width: 196, height: 88 },
    defaultReplicas: 1,
    defaultAvailabilityZoneCount: 0,
    supportedProperties: [
      'modelId',
      'modality',
      'guardrailsEnabled',
      'privateAccess',
      'encrypted',
      'dataLogging',
      'critical',
    ],
  },
  'ai-agent': {
    kind: 'ai-agent',
    displayName: 'AI Agent',
    category: 'ai',
    description:
      'Managed agent orchestration with tools, memory, guardrails, and approval controls.',
    aws: {
      service: 'bedrock-agent',
      displayName: 'Agents for Amazon Bedrock',
    },
    defaultConfiguration: {
      orchestrationMode: 'single-agent',
      memoryEnabled: true,
      humanApprovalRequired: true,
      guardrailsEnabled: true,
      encrypted: true,
    },
    baseMonthlyEstimate: 38,
    defaultSize: { width: 192, height: 88 },
    defaultReplicas: 1,
    defaultAvailabilityZoneCount: 0,
    supportedProperties: [
      'orchestrationMode',
      'memoryEnabled',
      'humanApprovalRequired',
      'guardrailsEnabled',
      'encrypted',
      'critical',
    ],
  },
  'sql-database': {
    kind: 'sql-database',
    displayName: 'SQL Database',
    category: 'data',
    description: 'Managed relational database for transactional workloads.',
    aws: {
      service: 'rds-postgresql',
      displayName: 'Amazon RDS for PostgreSQL',
    },
    defaultConfiguration: {
      engine: 'postgresql',
      size: 'medium',
      multiAZ: false,
      storageGb: 100,
      encrypted: true,
      backupsEnabled: true,
      publicAccess: false,
    },
    baseMonthlyEstimate: 420,
    defaultSize: { width: 196, height: 88 },
    defaultReplicas: 1,
    defaultAvailabilityZoneCount: 1,
    supportedProperties: [
      'engine',
      'size',
      'multiAZ',
      'storageGb',
      'encrypted',
      'backupsEnabled',
      'publicAccess',
      'availabilityZones',
      'critical',
    ],
  },
  'nosql-database': {
    kind: 'nosql-database',
    displayName: 'NoSQL Database',
    category: 'data',
    description: 'Managed key-value and document data store.',
    aws: { service: 'dynamodb', displayName: 'Amazon DynamoDB' },
    defaultConfiguration: {
      capacityMode: 'on-demand',
      encrypted: true,
      globalTables: false,
    },
    baseMonthlyEstimate: 115,
    defaultSize: { width: 192, height: 86 },
    defaultReplicas: 1,
    defaultAvailabilityZoneCount: 0,
    supportedProperties: [
      'capacityMode',
      'encrypted',
      'globalTables',
      'critical',
    ],
  },
  cache: {
    kind: 'cache',
    displayName: 'Cache',
    category: 'data',
    description: 'Low-latency in-memory data store.',
    aws: {
      service: 'elasticache-redis',
      displayName: 'Amazon ElastiCache for Redis',
    },
    defaultConfiguration: {
      engine: 'redis',
      nodeType: 'cache.t4g.small',
      clusterMode: false,
      encrypted: true,
    },
    baseMonthlyEstimate: 58,
    defaultSize: { width: 180, height: 82 },
    defaultReplicas: 1,
    defaultAvailabilityZoneCount: 1,
    supportedProperties: [
      'nodeType',
      'clusterMode',
      'encrypted',
      'replicas',
      'availabilityZones',
      'critical',
    ],
  },
  'object-storage': {
    kind: 'object-storage',
    displayName: 'Object Storage',
    category: 'data',
    description: 'Durable regional object and file storage.',
    aws: { service: 's3', displayName: 'Amazon S3' },
    defaultConfiguration: {
      encrypted: true,
      publicAccess: false,
      versioning: true,
    },
    baseMonthlyEstimate: 26,
    defaultSize: { width: 188, height: 84 },
    defaultReplicas: 1,
    defaultAvailabilityZoneCount: 0,
    supportedProperties: [
      'encrypted',
      'publicAccess',
      'versioning',
      'critical',
    ],
  },
  queue: {
    kind: 'queue',
    displayName: 'Queue',
    category: 'integration',
    description: 'Durable asynchronous message buffering.',
    aws: { service: 'sqs', displayName: 'Amazon SQS' },
    defaultConfiguration: {
      queueType: 'standard',
      deadLetterQueue: true,
      encrypted: true,
    },
    baseMonthlyEstimate: 12,
    defaultSize: { width: 176, height: 80 },
    defaultReplicas: 1,
    defaultAvailabilityZoneCount: 0,
    supportedProperties: [
      'queueType',
      'deadLetterQueue',
      'encrypted',
      'critical',
    ],
  },
  'event-bus': {
    kind: 'event-bus',
    displayName: 'Event Bus',
    category: 'integration',
    description: 'Managed event routing between producers and consumers.',
    aws: { service: 'eventbridge', displayName: 'Amazon EventBridge' },
    defaultConfiguration: { schemaRegistry: true, archiveEnabled: false },
    baseMonthlyEstimate: 16,
    defaultSize: { width: 184, height: 82 },
    defaultReplicas: 1,
    defaultAvailabilityZoneCount: 0,
    supportedProperties: ['schemaRegistry', 'archiveEnabled', 'critical'],
  },
  identity: {
    kind: 'identity',
    displayName: 'Identity',
    category: 'platform',
    description: 'Authentication and authorization boundary.',
    aws: { service: 'cognito', displayName: 'Amazon Cognito' },
    defaultConfiguration: { identityType: 'customer', mfaRequired: true },
    baseMonthlyEstimate: 22,
    defaultSize: { width: 180, height: 82 },
    defaultReplicas: 1,
    defaultAvailabilityZoneCount: 0,
    supportedProperties: ['identityType', 'mfaRequired', 'critical'],
  },
  'secrets-manager': {
    kind: 'secrets-manager',
    displayName: 'Secrets Manager',
    category: 'platform',
    description: 'Encrypted application secret storage and rotation.',
    aws: { service: 'secrets-manager', displayName: 'AWS Secrets Manager' },
    defaultConfiguration: { automaticRotation: false, encrypted: true },
    baseMonthlyEstimate: 8,
    defaultSize: { width: 188, height: 82 },
    defaultReplicas: 1,
    defaultAvailabilityZoneCount: 0,
    supportedProperties: ['automaticRotation', 'encrypted', 'critical'],
  },
  monitoring: {
    kind: 'monitoring',
    displayName: 'Monitoring',
    category: 'platform',
    description: 'Metrics, logs, alarms, and operational visibility.',
    aws: { service: 'cloudwatch', displayName: 'Amazon CloudWatch' },
    defaultConfiguration: { logRetentionDays: 30, alertingEnabled: true },
    baseMonthlyEstimate: 48,
    defaultSize: { width: 184, height: 82 },
    defaultReplicas: 1,
    defaultAvailabilityZoneCount: 0,
    supportedProperties: ['logRetentionDays', 'alertingEnabled', 'critical'],
  },
} satisfies ComponentCatalog;

export const componentKinds = Object.keys(componentCatalog) as ComponentKind[];

export function getCatalogEntry<K extends ComponentKind>(
  kind: K,
): ComponentCatalogEntry<K> {
  return componentCatalog[kind] as unknown as ComponentCatalogEntry<K>;
}

function createEntityId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function defaultAvailabilityZones(count: number, region: string): string[] {
  return Array.from(
    { length: count },
    (_, index) => `${region}${String.fromCharCode(97 + index)}`,
  );
}

export function createComponentFromCatalog(
  input: AddComponentInput,
  context: Pick<ProviderContext, 'provider'> & { region: string },
): ArchitectureComponent {
  const entry = componentCatalog[input.kind];
  const region = input.region ?? context.region;
  const provider = input.provider ?? context.provider;
  const component = {
    id: input.id ?? createEntityId(input.kind),
    name: input.name ?? entry.displayName,
    kind: input.kind,
    provider,
    service:
      input.service ?? (provider === 'aws' ? entry.aws.service : entry.kind),
    region,
    availabilityZones:
      input.availabilityZones ??
      defaultAvailabilityZones(entry.defaultAvailabilityZoneCount, region),
    replicas: input.replicas ?? entry.defaultReplicas,
    configuration: {
      ...entry.defaultConfiguration,
      ...input.configuration,
    },
    estimatedMonthlyCost:
      input.estimatedMonthlyCost ?? entry.baseMonthlyEstimate,
    locked: input.locked ?? false,
    critical: input.critical ?? false,
    position: input.position ?? { x: 80, y: 80 },
    metadata: input.metadata ?? {},
    ...(input.network ? { network: input.network } : {}),
  };

  return architectureComponentSchema.parse(component);
}

export function isComponentOfKind<K extends ComponentKind>(
  component: ArchitectureComponent,
  kind: K,
): component is ComponentOfKind<K> {
  return component.kind === kind;
}
