import { createComponentFromCatalog } from '../architecture/catalog';
import {
  ARCHITECTURE_SCHEMA_VERSION,
  cloneArchitecture,
  validateArchitecture,
} from '../architecture/model';
import type {
  AddComponentInput,
  Architecture,
  ArchitectureConnection,
  ConnectComponentsInput,
} from '../architecture/model';

export const architectureTemplateIds = [
  'ecommerce-production',
  'serverless-api',
  'event-processing',
] as const;

export type ArchitectureTemplateId = (typeof architectureTemplateIds)[number];

export const DEFAULT_ARCHITECTURE_TEMPLATE_ID: ArchitectureTemplateId =
  'ecommerce-production';

const TEMPLATE_TIMESTAMP = '2026-08-26T00:00:00.000Z';
const DEFAULT_REGION = 'eu-west-1';
const awsContext = { provider: 'aws' as const, region: DEFAULT_REGION };

function component(input: AddComponentInput) {
  return createComponentFromCatalog(input, awsContext);
}

function connection(input: ConnectComponentsInput): ArchitectureConnection {
  return {
    id: input.id ?? `connection-${input.source}-${input.target}`,
    source: input.source,
    target: input.target,
    type: input.type,
    protocol: input.protocol,
    encrypted: input.encrypted ?? true,
    critical: input.critical ?? false,
    metadata: input.metadata ?? {},
  };
}

function template(
  value: Omit<Architecture, 'schemaVersion' | 'revision'>,
): Architecture {
  return validateArchitecture({
    ...value,
    schemaVersion: ARCHITECTURE_SCHEMA_VERSION,
    revision: 0,
  });
}

const ecommerceProductionTemplate = template({
  id: 'architecture-ecommerce-production',
  name: 'Ecommerce Production',
  description:
    'AWS-first ecommerce baseline with an intentionally single-AZ application and database tier.',
  provider: { provider: 'aws', environment: 'production' },
  region: DEFAULT_REGION,
  components: [
    component({
      id: 'ecommerce-internet',
      kind: 'internet',
      name: 'Customer Traffic',
      provider: 'generic',
      position: { x: 40, y: 220 },
      critical: true,
    }),
    component({
      id: 'ecommerce-cloudfront',
      kind: 'cdn',
      name: 'Storefront CDN',
      position: { x: 260, y: 220 },
      critical: true,
    }),
    component({
      id: 'ecommerce-alb',
      kind: 'load-balancer',
      name: 'Public Application Load Balancer',
      availabilityZones: ['eu-west-1a', 'eu-west-1b'],
      position: { x: 500, y: 220 },
      critical: true,
    }),
    component({
      id: 'ecommerce-ecs',
      kind: 'container-service',
      name: 'Storefront API',
      availabilityZones: ['eu-west-1a'],
      replicas: 1,
      configuration: { autoscaling: false },
      position: { x: 740, y: 220 },
      critical: true,
    }),
    component({
      id: 'ecommerce-postgresql',
      kind: 'sql-database',
      name: 'Orders Database',
      availabilityZones: ['eu-west-1a'],
      configuration: {
        engine: 'postgresql',
        multiAZ: false,
        encrypted: true,
        backupsEnabled: true,
        publicAccess: false,
      },
      position: { x: 980, y: 220 },
      critical: true,
    }),
  ],
  connections: [
    connection({
      id: 'ecommerce-edge-1',
      source: 'ecommerce-internet',
      target: 'ecommerce-cloudfront',
      type: 'request',
      protocol: 'HTTPS',
      critical: true,
    }),
    connection({
      id: 'ecommerce-edge-2',
      source: 'ecommerce-cloudfront',
      target: 'ecommerce-alb',
      type: 'request',
      protocol: 'HTTPS',
      critical: true,
    }),
    connection({
      id: 'ecommerce-edge-3',
      source: 'ecommerce-alb',
      target: 'ecommerce-ecs',
      type: 'request',
      protocol: 'HTTP',
      encrypted: false,
      critical: true,
    }),
    connection({
      id: 'ecommerce-edge-4',
      source: 'ecommerce-ecs',
      target: 'ecommerce-postgresql',
      type: 'data',
      protocol: 'PostgreSQL/TLS',
      critical: true,
    }),
  ],
  constraints: {
    requireMultiAZ: false,
    requireEncryptionAtRest: false,
  },
  metadata: {
    templateId: 'ecommerce-production',
    createdAt: TEMPLATE_TIMESTAMP,
    updatedAt: TEMPLATE_TIMESTAMP,
    tags: ['ecommerce', 'production', 'aws-first'],
    intentionallyImperfect: true,
  },
});

const serverlessApiTemplate = template({
  id: 'architecture-serverless-api',
  name: 'Serverless API',
  description: 'Managed API and event-driven compute backed by DynamoDB.',
  provider: { provider: 'aws', environment: 'production' },
  region: DEFAULT_REGION,
  components: [
    component({
      id: 'serverless-internet',
      kind: 'internet',
      name: 'API Consumers',
      provider: 'generic',
      position: { x: 80, y: 180 },
      critical: true,
    }),
    component({
      id: 'serverless-gateway',
      kind: 'api-gateway',
      name: 'Public API',
      position: { x: 320, y: 180 },
      critical: true,
    }),
    component({
      id: 'serverless-function',
      kind: 'serverless-function',
      name: 'Request Handler',
      position: { x: 560, y: 180 },
      critical: true,
    }),
    component({
      id: 'serverless-dynamodb',
      kind: 'nosql-database',
      name: 'Application Data',
      position: { x: 800, y: 180 },
      critical: true,
    }),
    component({
      id: 'serverless-monitoring',
      kind: 'monitoring',
      name: 'API Observability',
      position: { x: 560, y: 360 },
    }),
  ],
  connections: [
    connection({
      id: 'serverless-edge-1',
      source: 'serverless-internet',
      target: 'serverless-gateway',
      type: 'request',
      protocol: 'HTTPS',
      critical: true,
    }),
    connection({
      id: 'serverless-edge-2',
      source: 'serverless-gateway',
      target: 'serverless-function',
      type: 'request',
      protocol: 'HTTPS',
      critical: true,
    }),
    connection({
      id: 'serverless-edge-3',
      source: 'serverless-function',
      target: 'serverless-dynamodb',
      type: 'data',
      protocol: 'HTTPS',
      critical: true,
    }),
    connection({
      id: 'serverless-edge-4',
      source: 'serverless-function',
      target: 'serverless-monitoring',
      type: 'management',
      protocol: 'HTTPS',
    }),
  ],
  constraints: {
    requireMultiAZ: false,
    requireEncryptionAtRest: true,
  },
  metadata: {
    templateId: 'serverless-api',
    createdAt: TEMPLATE_TIMESTAMP,
    updatedAt: TEMPLATE_TIMESTAMP,
    tags: ['serverless', 'api', 'aws-first'],
  },
});

const eventProcessingTemplate = template({
  id: 'architecture-event-processing',
  name: 'Event Processing',
  description:
    'Buffered event ingestion with managed processing and durable storage.',
  provider: { provider: 'aws', environment: 'production' },
  region: DEFAULT_REGION,
  components: [
    component({
      id: 'events-bus',
      kind: 'event-bus',
      name: 'Domain Events',
      position: { x: 80, y: 200 },
      critical: true,
    }),
    component({
      id: 'events-queue',
      kind: 'queue',
      name: 'Processing Buffer',
      position: { x: 320, y: 200 },
      critical: true,
    }),
    component({
      id: 'events-function',
      kind: 'serverless-function',
      name: 'Event Processor',
      position: { x: 560, y: 200 },
      critical: true,
    }),
    component({
      id: 'events-storage',
      kind: 'object-storage',
      name: 'Processed Event Archive',
      position: { x: 800, y: 200 },
      critical: true,
    }),
    component({
      id: 'events-monitoring',
      kind: 'monitoring',
      name: 'Pipeline Observability',
      position: { x: 560, y: 380 },
    }),
  ],
  connections: [
    connection({
      id: 'events-edge-1',
      source: 'events-bus',
      target: 'events-queue',
      type: 'async',
      protocol: 'AWS Events',
      critical: true,
    }),
    connection({
      id: 'events-edge-2',
      source: 'events-queue',
      target: 'events-function',
      type: 'async',
      protocol: 'SQS',
      critical: true,
    }),
    connection({
      id: 'events-edge-3',
      source: 'events-function',
      target: 'events-storage',
      type: 'data',
      protocol: 'HTTPS',
      critical: true,
    }),
    connection({
      id: 'events-edge-4',
      source: 'events-function',
      target: 'events-monitoring',
      type: 'management',
      protocol: 'HTTPS',
    }),
  ],
  constraints: {
    requireMultiAZ: false,
    requireEncryptionAtRest: true,
  },
  metadata: {
    templateId: 'event-processing',
    createdAt: TEMPLATE_TIMESTAMP,
    updatedAt: TEMPLATE_TIMESTAMP,
    tags: ['events', 'serverless', 'aws-first'],
  },
});

export const architectureTemplates: Readonly<
  Record<ArchitectureTemplateId, Architecture>
> = {
  'ecommerce-production': ecommerceProductionTemplate,
  'serverless-api': serverlessApiTemplate,
  'event-processing': eventProcessingTemplate,
};

export function getArchitectureTemplate(
  templateId: ArchitectureTemplateId,
): Architecture {
  return cloneArchitecture(architectureTemplates[templateId]);
}

export function listArchitectureTemplates(): Architecture[] {
  return architectureTemplateIds.map(getArchitectureTemplate);
}
