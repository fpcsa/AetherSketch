import { writeFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { createJSONStorage } from 'zustand/middleware';
import { z } from 'zod';

import { analyzeArchitecture } from '../../src/architecture/analysis';
import { createComponentFromCatalog } from '../../src/architecture/catalog';
import { validateArchitecture } from '../../src/architecture/model';
import {
  createArchitectureStore,
  type PersistedArchitectureState,
} from '../../src/stores/architecture-store';
import { createIntelligenceStore } from '../../src/stores/intelligence-store';
import { getArchitectureTemplate } from '../../src/templates';
import {
  createWebMcpMutationTools,
  createWebMcpReadTools,
  registerWebMcpTools,
  WEBMCP_MUTATION_TOOL_NAMES,
} from '../../src/webmcp';
import { getAgentImprovedLockedEcommerceArchitecture } from '../../tests/helpers/architecture-fixtures';
import casesJson from './cases.json';

const stepSchema = z
  .object({
    name: z.string(),
    arguments: z.record(z.string(), z.unknown()),
    expect: z.record(z.string(), z.unknown()),
    capture: z.string().optional(),
  })
  .strict();
const cases = z
  .array(
    z
      .object({
        id: z.string(),
        prompt: z.string(),
        mode: z.enum(['review', 'edit']),
        fixture: z.enum([
          'baseline',
          'locked-baseline',
          'checkout-workers',
          'resilient',
        ]),
        expectedCalls: z.array(stepSchema),
        probeCalls: z.array(stepSchema).optional(),
        unchanged: z.boolean(),
        rubric: z.string(),
        componentCount: z.number().optional(),
        connectionCount: z.number().optional(),
        maxCost: z.number().optional(),
        minResilience: z.number().optional(),
      })
      .strict(),
  )
  .parse(casesJson);

function fixture(name: (typeof cases)[number]['fixture']) {
  if (name === 'resilient')
    return getAgentImprovedLockedEcommerceArchitecture();
  const architecture = getArchitectureTemplate('ecommerce-production');
  if (name === 'locked-baseline') {
    architecture.components.find(
      (c) => c.id === 'ecommerce-postgresql',
    )!.locked = true;
    architecture.constraints.maximumMonthlyCost = 3000;
    architecture.constraints.targetResilienceScore = 90;
  }
  if (name === 'checkout-workers') {
    architecture.components = [
      createComponentFromCatalog(
        { id: 'checkout', kind: 'container-service', name: 'Checkout' },
        { provider: 'aws', region: 'eu-west-1' },
      ),
      createComponentFromCatalog(
        { id: 'workers', kind: 'worker', name: 'Workers' },
        { provider: 'aws', region: 'eu-west-1' },
      ),
    ];
    architecture.connections = [
      {
        id: 'checkout-workers-direct',
        source: 'checkout',
        target: 'workers',
        type: 'request',
        encrypted: true,
        critical: false,
        metadata: {},
      },
    ];
  }
  return validateArchitecture(architecture);
}

const traces: unknown[] = [];
afterAll(() => {
  if (process.env.AETHERSKETCH_EVAL_REPORT)
    writeFileSync(
      process.env.AETHERSKETCH_EVAL_REPORT,
      JSON.stringify(
        {
          runType: 'deterministic-reference-replay',
          llmExecuted: false,
          caseCount: cases.length,
          passed: traces.length,
          traces,
        },
        null,
        2,
      ) + '\n',
    );
});

describe('WebMCP deterministic evaluation reference traces (not LLM tool selection)', () => {
  it.each(cases)('$id: $prompt', async (testCase) => {
    let editEnabled = testCase.mode === 'edit';
    const saved = new Map<string, string>();
    const store = createArchitectureStore({
      initialArchitecture: fixture(testCase.fixture),
      skipHydration: true,
      isAgentEditingEnabled: () => editEnabled,
      storage: createJSONStorage<PersistedArchitectureState>(() => ({
        getItem: (key) => saved.get(key) ?? null,
        setItem: (key, value) => {
          saved.set(key, value);
        },
        removeItem: (key) => {
          saved.delete(key);
        },
      })),
    });
    const intelligence = createIntelligenceStore(store);
    const active = new Map<string, WebMCP.ModelContextTool>();
    const context = {
      registerTool: (
        tool: WebMCP.ModelContextTool,
        options?: WebMCP.ModelContextRegisterToolOptions,
      ) => {
        if (active.has(tool.name))
          throw new Error('Duplicate registration: ' + tool.name);
        active.set(tool.name, tool);
        options!.signal!.addEventListener('abort', () => {
          if (active.get(tool.name) === tool) active.delete(tool.name);
        });
        return Promise.resolve();
      },
    };
    const reads = createWebMcpReadTools({
      getArchitecture: () => store.getState().architecture,
      getAnalysisSnapshot: () => ({
        analysis: intelligence.getState().analysis,
        stale: intelligence.getState().analysisStale,
      }),
      runAnalysis: (options) => intelligence.getState().runAnalysis(options),
      runSimulation: (input) => intelligence.getState().runSimulation(input),
      showAnalysis: () => {},
      showSimulation: () => {},
    });
    const edits = createWebMcpMutationTools({
      isEditModeEnabled: () => editEnabled,
      getArchitecture: () => store.getState().architecture,
      addComponent: (input) => store.getState().addComponent(input, 'agent'),
      updateComponent: (id, changes) =>
        store.getState().updateComponent(id, changes, 'agent'),
      removeComponent: (id) => store.getState().removeComponent(id, 'agent'),
      connectComponents: (input) =>
        store.getState().connectComponents(input, 'agent'),
      disconnectComponents: (id) =>
        store.getState().disconnectComponents(id, 'agent'),
      showComponent: () => {},
      showConnection: () => {},
      clearSelection: () => {},
    });
    const registration = await registerWebMcpTools(context, [
      ...reads,
      ...(editEnabled ? edits : []),
    ]);
    const before = store.getState();
    const persistenceBefore = [...saved.entries()];
    const aliases = new Map<string, string>();
    const calls: unknown[] = [];
    try {
      expect(active.size).toBe(editEnabled ? 9 : 4);
      if (!editEnabled)
        for (const name of WEBMCP_MUTATION_TOOL_NAMES)
          expect(active.has(name)).toBe(false);
      for (const [kind, steps] of [
        ['expected', testCase.expectedCalls],
        ['probe', testCase.probeCalls ?? []],
      ] as const) {
        for (const step of steps) {
          const args = Object.fromEntries(
            Object.entries(step.arguments).map(([key, value]) => {
              if (typeof value === 'string' && value.startsWith('$')) {
                const resolved = aliases.get(value.slice(1));
                expect(
                  resolved,
                  'Returned ID must exist before chaining',
                ).toBeDefined();
                return [key, resolved];
              }
              return [key, value];
            }),
          );
          const tool =
            active.get(step.name) ??
            (kind === 'probe'
              ? edits.find((candidate) => candidate.name === step.name)
              : undefined);
          expect(tool, 'Expected tool must be discoverable').toBeDefined();
          const result = await tool!.execute(args, {
            signal: new AbortController().signal,
          });
          expect(result).toMatchObject(step.expect);
          if (step.capture) {
            const captured = z
              .object({
                ok: z.literal(true),
                data: z.object({
                  mutation: z.object({
                    component: z.object({ id: z.string().min(1) }),
                  }),
                }),
              })
              .parse(result);
            aliases.set(step.capture, captured.data.mutation.component.id);
          }
          calls.push({
            kind,
            name: step.name,
            arguments: args,
            result,
            outputCharacters: JSON.stringify(result).length,
          });
        }
      }
      const after = store.getState();
      if (testCase.unchanged) {
        expect(after.architecture).toBe(before.architecture);
        expect(after.past).toBe(before.past);
        expect([...saved.entries()]).toEqual(persistenceBefore);
      }
      if (testCase.componentCount)
        expect(after.architecture.components).toHaveLength(
          testCase.componentCount,
        );
      if (testCase.connectionCount)
        expect(after.architecture.connections).toHaveLength(
          testCase.connectionCount,
        );
      for (const locked of before.architecture.components.filter(
        (c) => c.locked,
      ))
        expect(
          after.architecture.components.find((c) => c.id === locked.id),
        ).toEqual(locked);
      const analysis = analyzeArchitecture(after.architecture);
      if (testCase.maxCost)
        expect(analysis.estimatedMonthlyCost).toBeLessThanOrEqual(
          testCase.maxCost,
        );
      if (testCase.minResilience)
        expect(analysis.resilienceScore).toBeGreaterThanOrEqual(
          testCase.minResilience,
        );
      traces.push({
        id: testCase.id,
        status: 'passed',
        mode: testCase.mode,
        calls,
        finalMetrics: {
          cost: analysis.estimatedMonthlyCost,
          resilience: analysis.resilienceScore,
          security: analysis.securityScore,
        },
      });
    } finally {
      editEnabled = false;
      registration.dispose();
      intelligence.getState().dispose();
      expect(active.size).toBe(0);
    }
  });
});
