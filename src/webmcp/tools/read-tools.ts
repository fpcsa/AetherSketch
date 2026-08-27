import type { z } from 'zod';

import type {
  AnalyzeArchitectureOptions,
  ArchitectureAnalysis,
} from '../../architecture/analysis';
import {
  ArchitectureDomainError,
  type Architecture,
} from '../../architecture/model';
import type {
  FailureSimulationInput,
  FailureSimulationResult,
} from '../../architecture/simulation';
import { type WebMcpToolResult, toWebMcpToolError } from '../errors/tool-error';
import {
  analyzeArchitectureInputJsonSchema,
  analyzeArchitectureInputSchema,
  emptyInputJsonSchema,
  emptyInputSchema,
  inspectComponentInputJsonSchema,
  inspectComponentInputSchema,
  simulateFailureInputJsonSchema,
  simulateFailureInputSchema,
} from '../schemas/read-tool-schemas';
import {
  compactAnalysis,
  compactArchitecture,
  compactSimulation,
  inspectArchitectureComponent,
} from './read-outputs';

export const WEBMCP_READ_TOOL_NAMES = [
  'get_architecture',
  'inspect_component',
  'analyze_architecture',
  'simulate_failure',
] as const;

export type WebMcpToolName = (typeof WEBMCP_READ_TOOL_NAMES)[number];

export type WebMcpInvocationReporter = {
  invocation: (toolName: WebMcpToolName, input: unknown) => void;
  result: (toolName: WebMcpToolName, result: unknown) => void;
  error: (toolName: WebMcpToolName, error: unknown) => void;
};

export type WebMcpReadToolDependencies = {
  getArchitecture: () => Architecture;
  getAnalysisSnapshot: () => {
    analysis: ArchitectureAnalysis | null;
    stale: boolean;
  };
  runAnalysis: (options: AnalyzeArchitectureOptions) => ArchitectureAnalysis;
  runSimulation: (input: FailureSimulationInput) => FailureSimulationResult;
  showAnalysis: () => void;
  showSimulation: () => void;
  reporter?: WebMcpInvocationReporter;
};

const readAnnotations: WebMCP.ToolAnnotations = {
  readOnlyHint: true,
  untrustedContentHint: false,
};

function createTool<TInput extends Record<string, unknown>, TOutput>(
  name: WebMcpToolName,
  title: string,
  description: string,
  inputSchema: object,
  parser: z.ZodType<TInput>,
  handler: (input: TInput) => TOutput,
  reporter?: WebMcpInvocationReporter,
): WebMCP.ModelContextTool {
  return {
    name,
    title,
    description,
    inputSchema,
    annotations: readAnnotations,
    execute: (input, options) => {
      reporter?.invocation(name, input);
      try {
        if (options.signal.aborted) {
          throw options.signal.reason;
        }
        const data = handler(parser.parse(input));
        const result: WebMcpToolResult<TOutput> = { ok: true, data };
        reporter?.result(name, result);
        return result;
      } catch (error) {
        const translated = toWebMcpToolError(error, options.signal);
        const result: WebMcpToolResult<TOutput> = {
          ok: false,
          error: translated,
        };
        reporter?.error(name, translated);
        return result;
      }
    },
  };
}

export function createWebMcpReadTools(
  dependencies: WebMcpReadToolDependencies,
): readonly WebMCP.ModelContextTool[] {
  return [
    createTool(
      'get_architecture',
      'Get architecture',
      'Return the live architecture, constraints, compact graph, locks, and current metrics.',
      emptyInputJsonSchema,
      emptyInputSchema,
      () =>
        compactArchitecture(
          dependencies.getArchitecture(),
          dependencies.getAnalysisSnapshot(),
        ),
      dependencies.reporter,
    ),
    createTool(
      'inspect_component',
      'Inspect component',
      'Return detailed configuration and relationships for one component ID.',
      inspectComponentInputJsonSchema,
      inspectComponentInputSchema,
      ({ componentId }) => {
        const architecture = dependencies.getArchitecture();
        const component = architecture.components.find(
          (candidate) => candidate.id === componentId,
        );
        if (!component) {
          throw new ArchitectureDomainError(
            'COMPONENT_NOT_FOUND',
            `Component not found: ${componentId}`,
            { componentId },
          );
        }
        return inspectArchitectureComponent(architecture, component);
      },
      dependencies.reporter,
    ),
    createTool(
      'analyze_architecture',
      'Analyze architecture',
      'Run deterministic architecture analysis and show its results in the page UI.',
      analyzeArchitectureInputJsonSchema,
      analyzeArchitectureInputSchema,
      ({ focus }) => {
        const analysis = dependencies.runAnalysis({ focus });
        dependencies.showAnalysis();
        return compactAnalysis(analysis);
      },
      dependencies.reporter,
    ),
    createTool(
      'simulate_failure',
      'Simulate failure',
      'Run a non-mutating component, availability-zone, or region failure simulation and show its overlay.',
      simulateFailureInputJsonSchema,
      simulateFailureInputSchema,
      (input) => {
        const simulation = dependencies.runSimulation(input);
        dependencies.showSimulation();
        return compactSimulation(simulation);
      },
      dependencies.reporter,
    ),
  ];
}
