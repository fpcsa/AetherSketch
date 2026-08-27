import { describe, expect, it, vi } from 'vitest';

import { analyzeArchitecture } from '../../src/architecture/analysis';
import { simulateFailure } from '../../src/architecture/simulation';
import { getArchitectureTemplate } from '../../src/templates';
import {
  createWebMcpReadTools,
  type WebMcpReadToolDependencies,
  type WebMcpToolResult,
  WEBMCP_READ_TOOL_NAMES,
} from '../../src/webmcp';

function createHarness() {
  const architecture = getArchitectureTemplate('ecommerce-production');
  let analysis = analyzeArchitecture(architecture);
  const showAnalysis = vi.fn();
  const showSimulation = vi.fn();
  const reporter = {
    invocation: vi.fn(),
    result: vi.fn(),
    error: vi.fn(),
  };
  const dependencies: WebMcpReadToolDependencies = {
    getArchitecture: () => architecture,
    getAnalysisSnapshot: () => ({ analysis, stale: false }),
    runAnalysis: (options) => {
      analysis = analyzeArchitecture(architecture, options);
      return analysis;
    },
    runSimulation: (input) => simulateFailure(architecture, input),
    showAnalysis,
    showSimulation,
    reporter,
  };
  const tools = createWebMcpReadTools(dependencies);

  return {
    architecture,
    tools,
    showAnalysis,
    showSimulation,
    reporter,
  };
}

function toolNamed(
  tools: readonly WebMCP.ModelContextTool[],
  name: (typeof WEBMCP_READ_TOOL_NAMES)[number],
) {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`Missing test tool: ${name}`);
  }
  return tool;
}

async function execute<T>(
  tool: WebMCP.ModelContextTool,
  input: Record<string, unknown>,
) {
  return (await tool.execute(input, {
    signal: new AbortController().signal,
  })) as WebMcpToolResult<T>;
}

describe('WebMCP read tools', () => {
  it('exposes exactly four strictly-described read-only tools', () => {
    const { tools } = createHarness();

    expect(tools.map((tool) => tool.name)).toEqual(WEBMCP_READ_TOOL_NAMES);
    for (const tool of tools) {
      expect(tool.annotations).toEqual({
        readOnlyHint: true,
        untrustedContentHint: false,
      });
      expect(tool.inputSchema).toMatchObject({
        type: 'object',
        additionalProperties: false,
      });
    }
    expect(toolNamed(tools, 'inspect_component').inputSchema).toMatchObject({
      required: ['componentId'],
    });
    expect(toolNamed(tools, 'simulate_failure').inputSchema).toMatchObject({
      required: ['scope', 'target'],
    });
  });

  it('returns a compact live architecture without UI, history, or positions', async () => {
    const { tools, architecture } = createHarness();
    const result = await execute<{
      id: string;
      metricsStatus: string;
      components: Record<string, unknown>[];
      lockedComponentIds: string[];
    }>(toolNamed(tools, 'get_architecture'), {});

    expect(result).toMatchObject({
      ok: true,
      data: {
        id: architecture.id,
        name: architecture.name,
        metricsStatus: 'current',
        metrics: {
          estimatedMonthlyCost: 675,
          resilienceScore: 57,
          securityScore: 76,
        },
        lockedComponentIds: [],
      },
    });
    if (result.ok) {
      expect(result.data.components[0]).not.toHaveProperty('position');
      expect(result.data).not.toHaveProperty('activity');
      expect(result.data).not.toHaveProperty('history');
      expect(result.data).not.toHaveProperty('metadata');
    }
  });

  it('inspects typed configuration and returns COMPONENT_NOT_FOUND', async () => {
    const { tools } = createHarness();
    const inspectTool = toolNamed(tools, 'inspect_component');
    const found = await execute<Record<string, unknown>>(inspectTool, {
      componentId: 'ecommerce-postgresql',
    });

    expect(found).toMatchObject({
      ok: true,
      data: {
        id: 'ecommerce-postgresql',
        kind: 'sql-database',
        category: 'data',
        configuration: {
          engine: 'postgresql',
          multiAZ: false,
          encrypted: true,
        },
        relationships: [
          {
            connectionId: 'ecommerce-edge-4',
            direction: 'incoming',
            otherComponentId: 'ecommerce-ecs',
          },
        ],
      },
    });

    const missing = await execute(inspectTool, {
      componentId: 'missing-component',
    });
    expect(missing).toEqual({
      ok: false,
      error: {
        code: 'COMPONENT_NOT_FOUND',
        message: 'Component not found: missing-component',
        componentId: 'missing-component',
        edgeId: undefined,
        details: undefined,
      },
    });
  });

  it('runs shared analysis and requests the visible analysis panel', async () => {
    const { tools, showAnalysis } = createHarness();
    const result = await execute<Record<string, unknown>>(
      toolNamed(tools, 'analyze_architecture'),
      { focus: 'security' },
    );

    expect(result).toMatchObject({
      ok: true,
      data: {
        focus: 'security',
        estimatedMonthlyCost: 675,
        resilienceScore: 57,
        securityScore: 76,
        validationStatus: 'valid',
      },
    });
    expect(showAnalysis).toHaveBeenCalledOnce();
  });

  it('runs shared simulation, returns compact impact, and requests its overlay', async () => {
    const { tools, showSimulation } = createHarness();
    const result = await execute<Record<string, unknown>>(
      toolNamed(tools, 'simulate_failure'),
      { scope: 'availability-zone', target: 'eu-west-1a' },
    );

    expect(result).toMatchObject({
      ok: true,
      data: {
        scope: 'availability-zone',
        target: 'eu-west-1a',
        status: 'unavailable',
        failedCount: 2,
        degradedCount: 1,
        criticalPathRemaining: false,
      },
    });
    expect(showSimulation).toHaveBeenCalledOnce();
    if (result.ok) {
      expect(result.data).not.toHaveProperty('survivingComponentIds');
    }
  });

  it('translates strict-schema and domain failures into corrective errors', async () => {
    const { tools, reporter } = createHarness();
    const invalidInput = await execute(
      toolNamed(tools, 'analyze_architecture'),
      { focus: 'all', unexpected: true },
    );

    expect(invalidInput).toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'Tool input does not match the required schema.',
      },
    });

    const invalidTarget = await execute(toolNamed(tools, 'simulate_failure'), {
      scope: 'component',
      target: 'missing-component',
    });
    expect(invalidTarget).toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_FAILURE_TARGET',
        componentId: 'missing-component',
      },
    });
    expect(reporter.invocation).toHaveBeenCalled();
    expect(reporter.error).toHaveBeenCalledWith(
      'simulate_failure',
      expect.objectContaining({ code: 'INVALID_FAILURE_TARGET' }),
    );
  });

  it('honors an invocation abort signal', async () => {
    const { tools } = createHarness();
    const controller = new AbortController();
    controller.abort('test cancellation');
    const result = (await toolNamed(tools, 'get_architecture').execute(
      {},
      { signal: controller.signal },
    )) as WebMcpToolResult<unknown>;

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'EXECUTION_ABORTED',
        message: 'The WebMCP tool invocation was cancelled.',
      },
    });
  });
});
