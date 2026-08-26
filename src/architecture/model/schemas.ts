import { z } from 'zod';

import {
  ARCHITECTURE_SCHEMA_VERSION,
  type ActivityEntry,
  type Architecture,
  type ArchitectureComponent,
  type JsonValue,
} from './types';

const idSchema = z.string().trim().min(1).max(128);
const shortTextSchema = z.string().trim().min(1).max(240);
const regionSchema = z.string().trim().min(1).max(64);

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const metadataSchema = z.record(z.string().max(128), jsonValueSchema);

export const providerSchema = z.enum([
  'aws',
  'azure',
  'gcp',
  'cloudflare',
  'generic',
]);

export const providerContextSchema = z
  .object({
    provider: providerSchema,
    environment: z.enum(['development', 'staging', 'production']),
    accountReference: z.string().trim().min(1).max(128).optional(),
  })
  .strict();

export const architectureConstraintsSchema = z
  .object({
    maximumMonthlyCost: z.number().finite().nonnegative().optional(),
    targetResilienceScore: z.number().finite().min(0).max(100).optional(),
    targetSecurityScore: z.number().finite().min(0).max(100).optional(),
    requiredRegion: regionSchema.optional(),
    requireMultiAZ: z.boolean(),
    requireEncryptionAtRest: z.boolean(),
    notes: z
      .union([z.string().max(4000), z.record(z.string(), jsonValueSchema)])
      .optional(),
  })
  .strict();

const componentBaseFields = {
  id: idSchema,
  name: shortTextSchema,
  provider: providerSchema,
  service: shortTextSchema,
  region: regionSchema,
  availabilityZones: z
    .array(z.string().trim().min(1).max(64))
    .max(32)
    .refine((zones) => new Set(zones).size === zones.length, {
      message: 'Availability zones must be unique.',
    }),
  replicas: z.number().int().min(1).max(10_000),
  estimatedMonthlyCost: z.number().finite().nonnegative(),
  locked: z.boolean(),
  critical: z.boolean(),
  position: z
    .object({
      x: z.number().finite(),
      y: z.number().finite(),
    })
    .strict(),
  metadata: metadataSchema,
};

const componentSchemas = [
  z
    .object({
      ...componentBaseFields,
      kind: z.literal('internet'),
      configuration: z
        .object({ entryType: z.literal('public-internet') })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...componentBaseFields,
      kind: z.literal('dns'),
      configuration: z
        .object({
          routingPolicy: z.enum(['simple', 'latency', 'failover']),
          zoneType: z.enum(['public', 'private']),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...componentBaseFields,
      kind: z.literal('cdn'),
      configuration: z
        .object({
          cachePolicy: z.enum(['managed', 'custom']),
          priceClass: z.enum(['regional', 'all']),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...componentBaseFields,
      kind: z.literal('waf'),
      configuration: z
        .object({ managedRules: z.boolean(), rateLimiting: z.boolean() })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...componentBaseFields,
      kind: z.literal('load-balancer'),
      configuration: z
        .object({
          scheme: z.enum(['internet-facing', 'internal']),
          crossZone: z.boolean(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...componentBaseFields,
      kind: z.literal('api-gateway'),
      configuration: z
        .object({
          endpointType: z.enum(['regional', 'edge', 'private']),
          throttlingEnabled: z.boolean(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...componentBaseFields,
      kind: z.literal('virtual-machine'),
      configuration: z
        .object({
          instanceType: z.string().trim().min(1).max(64),
          operatingSystem: z.enum(['linux', 'windows']),
          autoscaling: z.boolean(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...componentBaseFields,
      kind: z.literal('container-service'),
      configuration: z
        .object({
          launchType: z.enum(['fargate', 'ec2']),
          cpu: z.number().int().min(128).max(16_384),
          memoryMb: z.number().int().min(256).max(131_072),
          autoscaling: z.boolean(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...componentBaseFields,
      kind: z.literal('serverless-function'),
      configuration: z
        .object({
          runtime: z.string().trim().min(1).max(64),
          memoryMb: z.number().int().min(128).max(10_240),
          timeoutSeconds: z.number().int().min(1).max(900),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...componentBaseFields,
      kind: z.literal('worker'),
      configuration: z
        .object({
          runtime: z.literal('edge'),
          compatibilityDate: z.string().date().optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...componentBaseFields,
      kind: z.literal('sql-database'),
      configuration: z
        .object({
          engine: z.enum(['postgresql', 'mysql']),
          size: z.enum(['small', 'medium', 'large']),
          multiAZ: z.boolean(),
          storageGb: z.number().int().min(20).max(65_536),
          encrypted: z.boolean(),
          backupsEnabled: z.boolean(),
          publicAccess: z.boolean(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...componentBaseFields,
      kind: z.literal('nosql-database'),
      configuration: z
        .object({
          capacityMode: z.enum(['on-demand', 'provisioned']),
          encrypted: z.boolean(),
          globalTables: z.boolean(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...componentBaseFields,
      kind: z.literal('cache'),
      configuration: z
        .object({
          engine: z.literal('redis'),
          nodeType: z.string().trim().min(1).max(64),
          clusterMode: z.boolean(),
          encrypted: z.boolean(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...componentBaseFields,
      kind: z.literal('object-storage'),
      configuration: z
        .object({
          encrypted: z.boolean(),
          publicAccess: z.boolean(),
          versioning: z.boolean(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...componentBaseFields,
      kind: z.literal('queue'),
      configuration: z
        .object({
          queueType: z.enum(['standard', 'fifo']),
          deadLetterQueue: z.boolean(),
          encrypted: z.boolean(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...componentBaseFields,
      kind: z.literal('event-bus'),
      configuration: z
        .object({ schemaRegistry: z.boolean(), archiveEnabled: z.boolean() })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...componentBaseFields,
      kind: z.literal('identity'),
      configuration: z
        .object({
          identityType: z.enum(['workforce', 'customer', 'service']),
          mfaRequired: z.boolean(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...componentBaseFields,
      kind: z.literal('secrets-manager'),
      configuration: z
        .object({ automaticRotation: z.boolean(), encrypted: z.boolean() })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...componentBaseFields,
      kind: z.literal('monitoring'),
      configuration: z
        .object({
          logRetentionDays: z.number().int().min(1).max(3650),
          alertingEnabled: z.boolean(),
        })
        .strict(),
    })
    .strict(),
] as const;

export const architectureComponentSchema: z.ZodType<ArchitectureComponent> =
  z.discriminatedUnion('kind', componentSchemas);

export const architectureConnectionSchema = z
  .object({
    id: idSchema,
    source: idSchema,
    target: idSchema,
    type: z.enum(['request', 'async', 'data', 'replication', 'management']),
    protocol: z.string().trim().min(1).max(64).optional(),
    encrypted: z.boolean(),
    critical: z.boolean(),
    metadata: metadataSchema,
  })
  .strict();

export const architectureSchema: z.ZodType<Architecture> = z
  .object({
    schemaVersion: z.literal(ARCHITECTURE_SCHEMA_VERSION),
    revision: z.number().int().nonnegative(),
    id: idSchema,
    name: shortTextSchema,
    description: z.string().max(2000),
    provider: providerContextSchema,
    region: regionSchema,
    components: z.array(architectureComponentSchema).max(1000),
    connections: z.array(architectureConnectionSchema).max(5000),
    constraints: architectureConstraintsSchema,
    metadata: metadataSchema,
  })
  .strict()
  .superRefine((architecture, context) => {
    const componentIds = new Set<string>();

    architecture.components.forEach((component, index) => {
      if (componentIds.has(component.id)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate component id: ${component.id}`,
          path: ['components', index, 'id'],
        });
      }
      componentIds.add(component.id);
    });

    const connectionIds = new Set<string>();
    architecture.connections.forEach((connection, index) => {
      if (connectionIds.has(connection.id)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate connection id: ${connection.id}`,
          path: ['connections', index, 'id'],
        });
      }
      connectionIds.add(connection.id);

      if (!componentIds.has(connection.source)) {
        context.addIssue({
          code: 'custom',
          message: `Connection source does not exist: ${connection.source}`,
          path: ['connections', index, 'source'],
        });
      }

      if (!componentIds.has(connection.target)) {
        context.addIssue({
          code: 'custom',
          message: `Connection target does not exist: ${connection.target}`,
          path: ['connections', index, 'target'],
        });
      }

      if (connection.source === connection.target) {
        context.addIssue({
          code: 'custom',
          message: 'A component cannot connect to itself.',
          path: ['connections', index],
        });
      }
    });
  });

export const activityEntrySchema: z.ZodType<ActivityEntry> = z
  .object({
    id: idSchema,
    timestamp: z.string().datetime(),
    actor: z.enum(['human', 'agent', 'system']),
    action: z.enum([
      'architecture.created',
      'architecture.loaded',
      'architecture.renamed',
      'architecture.reset',
      'component.added',
      'component.updated',
      'component.removed',
      'component.locked',
      'component.unlocked',
      'component.moved',
      'connection.created',
      'connection.updated',
      'connection.removed',
      'constraints.updated',
      'history.undo',
      'history.redo',
    ]),
    summary: z.string().trim().min(1).max(500),
    details: metadataSchema.optional(),
  })
  .strict();
