import { z } from 'zod';

export const analysisFocusValues = [
  'all',
  'cost',
  'resilience',
  'security',
  'validation',
] as const;

export const failureScopeValues = [
  'component',
  'availability-zone',
  'region',
] as const;

export const emptyInputSchema = z.object({}).strict();

export const inspectComponentInputSchema = z
  .object({
    componentId: z.string().trim().min(1).max(128),
  })
  .strict();

export const analyzeArchitectureInputSchema = z
  .object({
    focus: z.enum(analysisFocusValues).default('all'),
  })
  .strict();

export const simulateFailureInputSchema = z
  .object({
    scope: z.enum(failureScopeValues),
    target: z.string().trim().min(1).max(128),
  })
  .strict();

export type InspectComponentInput = z.infer<typeof inspectComponentInputSchema>;
export type AnalyzeArchitectureInput = z.infer<
  typeof analyzeArchitectureInputSchema
>;
export type SimulateFailureInput = z.infer<typeof simulateFailureInputSchema>;

export const emptyInputJsonSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const;

export const inspectComponentInputJsonSchema = {
  type: 'object',
  properties: {
    componentId: {
      type: 'string',
      minLength: 1,
      maxLength: 128,
      description: 'Stable component ID from get_architecture.',
    },
  },
  required: ['componentId'],
  additionalProperties: false,
} as const;

export const analyzeArchitectureInputJsonSchema = {
  type: 'object',
  properties: {
    focus: {
      type: 'string',
      enum: analysisFocusValues,
      default: 'all',
      description:
        'Finding category to return; all metrics are always calculated.',
    },
  },
  additionalProperties: false,
} as const;

export const simulateFailureInputJsonSchema = {
  type: 'object',
  properties: {
    scope: {
      type: 'string',
      enum: failureScopeValues,
      description: 'Failure boundary to simulate.',
    },
    target: {
      type: 'string',
      minLength: 1,
      maxLength: 128,
      description: 'Component ID, availability-zone name, or region name.',
    },
  },
  required: ['scope', 'target'],
  additionalProperties: false,
} as const;
