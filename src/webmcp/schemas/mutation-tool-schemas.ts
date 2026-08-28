import { z } from 'zod';

import { componentKinds } from '../../architecture/catalog';
import {
  componentSchemas,
  CONNECTION_TYPES,
  type ComponentConfigurationMap,
  type ComponentKind,
} from '../../architecture/model';
import { WebMcpExecutionError } from '../errors/tool-error';

const idSchema = z.string().trim().min(1).max(128);
const shortTextSchema = z.string().trim().min(1).max(240);
const regionSchema = z.string().trim().min(1).max(64);
const availabilityZonesSchema = z
  .array(z.string().trim().min(1).max(64))
  .max(32)
  .refine((zones) => new Set(zones).size === zones.length, {
    message: 'Availability zones must be unique.',
  });
const configurationValueSchema = z.union([
  z.string().max(240),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);
const configurationPatchSchema = z
  .record(z.string().trim().min(1).max(128), configurationValueSchema)
  .refine(
    (value) => Object.keys(value).length <= 16,
    'At most 16 configuration fields are accepted.',
  );

export const addComponentInputSchema = z
  .object({
    kind: z.enum(componentKinds).describe('Catalog component kind.'),
    name: shortTextSchema.optional(),
    region: regionSchema.optional(),
    availabilityZones: availabilityZonesSchema.optional(),
    replicas: z.number().int().min(1).max(10_000).optional(),
    configuration: configurationPatchSchema
      .optional()
      .describe('Kind-specific initial configuration overrides.'),
    critical: z.boolean().optional(),
  })
  .strict();

export const updateComponentInputSchema = z
  .object({
    componentId: idSchema,
    changes: z
      .object({
        name: shortTextSchema.optional(),
        region: regionSchema.optional(),
        availabilityZones: availabilityZonesSchema.optional(),
        replicas: z.number().int().min(1).max(10_000).optional(),
        configuration: configurationPatchSchema
          .optional()
          .describe('Kind-specific configuration changes.'),
        critical: z.boolean().optional(),
      })
      .strict()
      .refine((changes) => Object.keys(changes).length > 0, {
        message: 'At least one safe component change is required.',
      }),
  })
  .strict();

export const removeComponentInputSchema = z
  .object({ componentId: idSchema })
  .strict();

export const connectComponentsInputSchema = z
  .object({
    sourceComponentId: idSchema,
    targetComponentId: idSchema,
    type: z.enum(CONNECTION_TYPES),
    protocol: z.string().trim().min(1).max(64).optional(),
    encrypted: z.boolean().optional(),
  })
  .strict();

export const disconnectComponentsInputSchema = z
  .object({ connectionId: idSchema })
  .strict();

type ConfigurationObjectSchema = z.ZodObject<z.ZodRawShape>;

const configurationSchemasByKind = Object.fromEntries(
  componentSchemas.map((schema) => [
    schema.shape.kind.value,
    schema.shape.configuration,
  ]),
) as unknown as Record<ComponentKind, ConfigurationObjectSchema>;

export function parseConfigurationPatch<K extends ComponentKind>(
  kind: K,
  configuration: Record<string, unknown> | undefined,
  componentId?: string,
): Partial<ComponentConfigurationMap[K]> | undefined {
  if (configuration === undefined) {
    return undefined;
  }

  const result = configurationSchemasByKind[kind]
    .partial()
    .safeParse(configuration);
  if (!result.success) {
    throw new WebMcpExecutionError(
      'INVALID_CONFIGURATION',
      `Configuration changes are invalid for component kind “${kind}”.`,
      {
        componentId,
        details: {
          kind,
          issues: result.error.issues.slice(0, 8).map((issue) => ({
            path: issue.path.map(String).join('.').slice(0, 160),
            message: issue.message.slice(0, 240),
          })),
          issuesTruncated: result.error.issues.length > 8,
        },
      },
    );
  }

  return result.data as Partial<ComponentConfigurationMap[K]>;
}

function toInputJsonSchema(schema: z.ZodType): object {
  const inputSchema = z.toJSONSchema(schema, {
    target: 'draft-7',
  });
  delete inputSchema.$schema;
  return inputSchema;
}

const configurationJsonSchemas = Object.fromEntries(
  Object.entries(configurationSchemasByKind).map(([kind, schema]) => [
    kind,
    toInputJsonSchema(schema.partial()),
  ]),
);

export const addComponentInputJsonSchema = {
  ...toInputJsonSchema(addComponentInputSchema),
  allOf: componentKinds.map((kind) => ({
    if: { properties: { kind: { const: kind } }, required: ['kind'] },
    then: { properties: { configuration: configurationJsonSchemas[kind] } },
  })),
};
const updateJsonSchema = z.toJSONSchema(updateComponentInputSchema, {
  target: 'draft-7',
});
delete updateJsonSchema.$schema;
const changesJsonSchema = updateJsonSchema.properties!.changes as Record<
  string,
  unknown
>;
changesJsonSchema.minProperties = 1;
const changesProperties = changesJsonSchema.properties as Record<
  string,
  unknown
>;
changesProperties.configuration = {
  description:
    'Partial configuration for the existing kind; inspect_component returns current keys and values.',
  anyOf: Object.values(configurationJsonSchemas),
};
export const updateComponentInputJsonSchema = updateJsonSchema;
export const removeComponentInputJsonSchema = toInputJsonSchema(
  removeComponentInputSchema,
);
export const connectComponentsInputJsonSchema = toInputJsonSchema(
  connectComponentsInputSchema,
);
export const disconnectComponentsInputJsonSchema = toInputJsonSchema(
  disconnectComponentsInputSchema,
);

export type AddComponentToolInput = z.infer<typeof addComponentInputSchema>;
export type UpdateComponentToolInput = z.infer<
  typeof updateComponentInputSchema
>;
export type RemoveComponentToolInput = z.infer<
  typeof removeComponentInputSchema
>;
export type ConnectComponentsToolInput = z.infer<
  typeof connectComponentsInputSchema
>;
export type DisconnectComponentsToolInput = z.infer<
  typeof disconnectComponentsInputSchema
>;
