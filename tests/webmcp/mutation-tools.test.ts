import { createJSONStorage, type StateStorage } from 'zustand/middleware';
import { describe, expect, it, vi } from 'vitest';

import { analyzeArchitecture } from '../../src/architecture/analysis';
import { simulateFailure } from '../../src/architecture/simulation';
import {
  createArchitectureStore,
  type PersistedArchitectureState,
} from '../../src/stores/architecture-store';
import { createIntelligenceStore } from '../../src/stores/intelligence-store';
import { getArchitectureTemplate } from '../../src/templates';
import {
  createWebMcpMutationTools,
  type WebMcpMutationToolDependencies,
  type WebMcpToolResult,
  WEBMCP_MUTATION_TOOL_NAMES,
} from '../../src/webmcp';

function memoryStorage(): StateStorage {
  const values = new Map<string, string>();
  return {
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => values.set(name, value),
    removeItem: (name) => values.delete(name),
  };
}

function createHarness() {
  let editModeEnabled = true;
  const architectureStore = createArchitectureStore({
    isAgentEditingEnabled: () => editModeEnabled,
    initialArchitecture: getArchitectureTemplate('ecommerce-production'),
    storage: createJSONStorage<PersistedArchitectureState>(() =>
      memoryStorage(),
    )!,
    skipHydration: true,
  });
  const intelligenceStore = createIntelligenceStore(architectureStore);
  const reporter = {
    invocation: vi.fn(),
    result: vi.fn(),
    error: vi.fn(),
  };
  const showComponent = vi.fn();
  const showConnection = vi.fn();
  const clearSelection = vi.fn();
  const dependencies: WebMcpMutationToolDependencies = {
    isEditModeEnabled: () => editModeEnabled,
    getArchitecture: () => architectureStore.getState().architecture,
    addComponent: (input) =>
      architectureStore.getState().addComponent(input, 'agent'),
    updateComponent: (componentId, changes) =>
      architectureStore
        .getState()
        .updateComponent(componentId, changes, 'agent'),
    removeComponent: (componentId) =>
      architectureStore.getState().removeComponent(componentId, 'agent'),
    connectComponents: (input) =>
      architectureStore.getState().connectComponents(input, 'agent'),
    disconnectComponents: (connectionId) =>
      architectureStore.getState().disconnectComponents(connectionId, 'agent'),
    showComponent,
    showConnection,
    clearSelection,
    reporter,
  };
  const tools = createWebMcpMutationTools(dependencies);

  return {
    architectureStore,
    intelligenceStore,
    tools,
    reporter,
    showComponent,
    showConnection,
    clearSelection,
    setEditMode: (enabled: boolean) => {
      editModeEnabled = enabled;
    },
  };
}

function toolNamed(
  tools: readonly WebMCP.ModelContextTool[],
  name: (typeof WEBMCP_MUTATION_TOOL_NAMES)[number],
) {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`Missing mutation tool: ${name}`);
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

describe('WebMCP mutation tools', () => {
  it.each(WEBMCP_MUTATION_TOOL_NAMES)(
    'fails closed for malformed inputs, cancelled calls and Review Mode: %s',
    async (name) => {
      const { tools, architectureStore, setEditMode } = createHarness();
      const before = architectureStore.getState();
      const tool = toolNamed(tools, name);
      for (const input of [
        null,
        [],
        {},
        { unexpected: true },
        JSON.parse('{"constructor":{"prototype":{"polluted":true}}}'),
      ]) {
        expect(
          await execute(tool, input as Record<string, unknown>),
        ).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
      }
      const controller = new AbortController();
      controller.abort();
      expect(
        await tool.execute({}, { signal: controller.signal }),
      ).toMatchObject({ ok: false, error: { code: 'EXECUTION_ABORTED' } });
      setEditMode(false);
      expect(await execute(tool, {})).toMatchObject({
        ok: false,
        error: { code: 'EDIT_MODE_DISABLED' },
      });
      expect(architectureStore.getState()).toBe(before);
      expect(Object.prototype).not.toHaveProperty('polluted');
    },
  );

  it('cancels an in-flight edit before the synchronous domain commit', async () => {
    const { tools, architectureStore } = createHarness();
    const before = architectureStore.getState();
    const controller = new AbortController();
    const pending = toolNamed(tools, 'add_component').execute(
      { kind: 'queue' },
      { signal: controller.signal },
    );
    controller.abort();
    expect(await pending).toMatchObject({
      ok: false,
      error: { code: 'EXECUTION_ABORTED' },
    });
    expect(architectureStore.getState()).toBe(before);
  });

  it.each([
    { kind: 'not-a-kind' },
    { kind: 'queue', replicas: 10001 },
    { kind: 'queue', name: 'x'.repeat(241) },
    { kind: 'queue', availabilityZones: ['eu-west-1a', 'eu-west-1a'] },
    { kind: 'queue', configuration: { queueType: 'x'.repeat(241) } },
    { kind: 'queue', configuration: { encrypted: { nested: true } } },
    {
      kind: 'queue',
      configuration: JSON.parse('{"__proto__":{"polluted":true}}') as unknown,
    },
  ])('rejects invalid add input %j without side effects', async (input) => {
    const { tools, architectureStore } = createHarness();
    const before = architectureStore.getState();
    expect(
      await execute(toolNamed(tools, 'add_component'), input),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
    expect(architectureStore.getState()).toBe(before);
  });

  it('returns structured missing-ID errors for every applicable mutation', async () => {
    const { tools, architectureStore } = createHarness();
    const before = architectureStore.getState();
    for (const [name, input, code] of [
      [
        'update_component',
        { componentId: 'missing', changes: { name: 'Example' } },
        'COMPONENT_NOT_FOUND',
      ],
      ['remove_component', { componentId: 'missing' }, 'COMPONENT_NOT_FOUND'],
      [
        'connect_components',
        {
          sourceComponentId: 'missing',
          targetComponentId: 'ecommerce-ecs',
          type: 'request',
        },
        'COMPONENT_NOT_FOUND',
      ],
      ['disconnect_components', { connectionId: 'missing' }, 'EDGE_NOT_FOUND'],
    ] as const) {
      expect(await execute(toolNamed(tools, name), input)).toMatchObject({
        ok: false,
        error: { code },
      });
    }
    expect(architectureStore.getState()).toBe(before);
  });

  it('places demo additions in a compact grid without overlapping existing cards', async () => {
    const { tools, architectureStore } = createHarness();
    for (const kind of ['waf', 'queue', 'secrets-manager', 'sql-database']) {
      expect(
        await execute(toolNamed(tools, 'add_component'), { kind }),
      ).toMatchObject({ ok: true });
    }
    const components = architectureStore.getState().architecture.components;
    expect(components).toHaveLength(9);
    expect(Math.max(...components.map((item) => item.position.x))).toBe(656);
    for (let i = 0; i < components.length; i += 1) {
      for (let j = i + 1; j < components.length; j += 1) {
        const a = components[i].position;
        const b = components[j].position;
        expect(Math.abs(a.x - b.x) >= 248 || Math.abs(a.y - b.y) >= 160).toBe(
          true,
        );
      }
    }
  });

  it.each([undefined, {}])(
    'preserves edit authority and locks without a signal: %j',
    async (options) => {
      const { tools, architectureStore, setEditMode } = createHarness();
      const update = toolNamed(tools, 'update_component');
      const invoke = (componentId: string) =>
        update.execute(
          { componentId, changes: { replicas: 2 } },
          options as WebMCP.ToolExecuteCallbackOptions,
        );
      expect(await invoke('ecommerce-ecs')).toMatchObject({ ok: true });
      architectureStore.getState().lockComponent('ecommerce-postgresql');
      const before = architectureStore.getState().architecture;
      expect(await invoke('ecommerce-postgresql')).toMatchObject({
        ok: false,
        error: { code: 'COMPONENT_LOCKED' },
      });
      expect(architectureStore.getState().architecture).toBe(before);
      setEditMode(false);
      expect(await invoke('ecommerce-ecs')).toMatchObject({
        ok: false,
        error: { code: 'EDIT_MODE_DISABLED' },
      });
      expect(architectureStore.getState().architecture).toBe(before);
    },
  );

  it('exposes exactly five strict, explicitly mutating tools', () => {
    const { tools } = createHarness();

    expect(tools.map((tool) => tool.name)).toEqual(WEBMCP_MUTATION_TOOL_NAMES);
    expect(tools.map((tool) => tool.name)).not.toContain('unlock_component');
    expect(tools.map((tool) => tool.name)).not.toContain('set_constraints');
    for (const tool of tools) {
      expect(tool.annotations).toEqual({
        readOnlyHint: false,
        untrustedContentHint: true,
      });
      expect(tool.inputSchema).toMatchObject({
        type: 'object',
        additionalProperties: false,
      });
    }
  });

  it('fails direct or stale tool execution while edit mode is disabled', async () => {
    const { architectureStore, tools, setEditMode } = createHarness();
    const before = architectureStore.getState().architecture;
    setEditMode(false);

    const result = await execute(toolNamed(tools, 'add_component'), {
      kind: 'queue',
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'EDIT_MODE_DISABLED' },
    });
    expect(architectureStore.getState().architecture).toBe(before);
  });

  it('lets a human disable edit mode while a call is in flight', async () => {
    const { architectureStore, tools, setEditMode } = createHarness();
    const beforeCount =
      architectureStore.getState().architecture.components.length;

    const pending = execute(toolNamed(tools, 'add_component'), {
      kind: 'queue',
    });
    setEditMode(false);
    const result = await pending;

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'EDIT_MODE_DISABLED' },
    });
    expect(architectureStore.getState().architecture.components).toHaveLength(
      beforeCount,
    );
  });

  it('adds and updates through the domain store with agent history', async () => {
    const { architectureStore, intelligenceStore, tools, showComponent } =
      createHarness();

    const addedResult = await execute(toolNamed(tools, 'add_component'), {
      kind: 'queue',
      name: 'Agent Orders Queue',
      configuration: { deadLetterQueue: true },
    });
    expect(addedResult).toMatchObject({
      ok: true,
      data: {
        analysisStatus: 'stale',
        constraintPolicy: 'soft-goals-evaluated-after-mutation',
        mutation: {
          action: 'component-added',
          component: {
            kind: 'queue',
            name: 'Agent Orders Queue',
            locked: false,
            configuration: { deadLetterQueue: true, encrypted: true },
          },
        },
      },
    });
    const queue = architectureStore
      .getState()
      .architecture.components.find(
        (component) => component.name === 'Agent Orders Queue',
      );
    expect(queue?.position).not.toEqual({ x: 80, y: 80 });
    expect(showComponent).toHaveBeenCalledWith(queue?.id);
    expect(intelligenceStore.getState().analysisStale).toBe(true);
    expect(architectureStore.getState().activity.at(-1)).toMatchObject({
      actor: 'agent',
      action: 'component.added',
    });

    const updatedResult = await execute(toolNamed(tools, 'update_component'), {
      componentId: queue!.id,
      changes: {
        replicas: 2,
        critical: true,
        configuration: { queueType: 'fifo' },
      },
    });
    expect(updatedResult).toMatchObject({
      ok: true,
      data: {
        mutation: {
          component: {
            id: queue!.id,
            replicas: 2,
            critical: true,
            configuration: { queueType: 'fifo', deadLetterQueue: true },
          },
        },
      },
    });
    expect(architectureStore.getState().activity.at(-1)).toMatchObject({
      actor: 'agent',
      action: 'component.updated',
    });

    intelligenceStore.getState().dispose();
  });

  it('rejects update and removal of a human-locked component', async () => {
    const { architectureStore, tools } = createHarness();
    architectureStore.getState().lockComponent('ecommerce-postgresql', 'human');
    const before = architectureStore.getState().architecture;

    const update = await execute(toolNamed(tools, 'update_component'), {
      componentId: 'ecommerce-postgresql',
      changes: { configuration: { multiAZ: true } },
    });
    const remove = await execute(toolNamed(tools, 'remove_component'), {
      componentId: 'ecommerce-postgresql',
    });

    for (const result of [update, remove]) {
      expect(result).toMatchObject({
        ok: false,
        error: {
          code: 'COMPONENT_LOCKED',
          componentId: 'ecommerce-postgresql',
        },
      });
    }
    expect(architectureStore.getState().architecture).toBe(before);
  });

  it('connects, disconnects, and removes connected edges safely', async () => {
    const { architectureStore, tools, showConnection, clearSelection } =
      createHarness();

    const connect = await execute(toolNamed(tools, 'connect_components'), {
      sourceComponentId: 'ecommerce-cloudfront',
      targetComponentId: 'ecommerce-postgresql',
      type: 'data',
      protocol: 'HTTPS',
      encrypted: true,
    });
    expect(connect).toMatchObject({
      ok: true,
      data: {
        mutation: {
          connection: {
            sourceComponentId: 'ecommerce-cloudfront',
            targetComponentId: 'ecommerce-postgresql',
            type: 'data',
          },
        },
      },
    });
    const connectionId = architectureStore
      .getState()
      .architecture.connections.at(-1)!.id;
    expect(showConnection).toHaveBeenCalledWith(connectionId);
    expect(architectureStore.getState().activity.at(-1)?.actor).toBe('agent');

    const disconnect = await execute(
      toolNamed(tools, 'disconnect_components'),
      { connectionId },
    );
    expect(disconnect).toMatchObject({ ok: true });
    expect(
      architectureStore
        .getState()
        .architecture.connections.some((edge) => edge.id === connectionId),
    ).toBe(false);

    const connectedBefore = architectureStore
      .getState()
      .architecture.connections.filter(
        (edge) =>
          edge.source === 'ecommerce-ecs' || edge.target === 'ecommerce-ecs',
      ).length;
    const remove = await execute(toolNamed(tools, 'remove_component'), {
      componentId: 'ecommerce-ecs',
    });
    expect(remove).toMatchObject({
      ok: true,
      data: { mutation: { removedConnectionCount: connectedBefore } },
    });
    expect(
      architectureStore
        .getState()
        .architecture.connections.some(
          (edge) =>
            edge.source === 'ecommerce-ecs' || edge.target === 'ecommerce-ecs',
        ),
    ).toBe(false);
    expect(clearSelection).toHaveBeenCalledTimes(2);
  });

  it('rejects unsafe fields, kind-invalid configuration, and invalid edges', async () => {
    const { tools } = createHarness();

    const unsafe = await execute(toolNamed(tools, 'update_component'), {
      componentId: 'ecommerce-ecs',
      changes: { locked: true },
    });
    expect(unsafe).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    });

    const invalidConfiguration = await execute(
      toolNamed(tools, 'update_component'),
      {
        componentId: 'ecommerce-ecs',
        changes: { configuration: { multiAZ: true } },
      },
    );
    expect(invalidConfiguration).toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_CONFIGURATION',
        componentId: 'ecommerce-ecs',
      },
    });

    const selfConnection = await execute(
      toolNamed(tools, 'connect_components'),
      {
        sourceComponentId: 'ecommerce-ecs',
        targetComponentId: 'ecommerce-ecs',
        type: 'request',
      },
    );
    expect(selfConnection).toMatchObject({
      ok: false,
      error: { code: 'INVALID_CONNECTION' },
    });

    const missingEdge = await execute(
      toolNamed(tools, 'disconnect_components'),
      { connectionId: 'missing-edge' },
    );
    expect(missingEdge).toMatchObject({
      ok: false,
      error: { code: 'EDGE_NOT_FOUND', edgeId: 'missing-edge' },
    });
  });

  it('allows soft goal violations while preserving hard validation', async () => {
    const { architectureStore, tools } = createHarness();
    architectureStore
      .getState()
      .setConstraints({ maximumMonthlyCost: 1 }, 'human');

    const result = await execute(toolNamed(tools, 'add_component'), {
      kind: 'virtual-machine',
    });

    expect(result).toMatchObject({
      ok: true,
      data: {
        constraintPolicy: 'soft-goals-evaluated-after-mutation',
      },
    });
  });

  it('completes the canonical locked-PostgreSQL improvement workflow', async () => {
    const { architectureStore, tools } = createHarness();
    architectureStore.getState().setConstraints(
      {
        maximumMonthlyCost: 3000,
        targetResilienceScore: 90,
        targetSecurityScore: 90,
        requiredRegion: 'eu-west-1',
        requireEncryptionAtRest: true,
      },
      'human',
    );
    architectureStore.getState().lockComponent('ecommerce-postgresql', 'human');

    const update = toolNamed(tools, 'update_component');
    const add = toolNamed(tools, 'add_component');
    const connect = toolNamed(tools, 'connect_components');
    const disconnect = toolNamed(tools, 'disconnect_components');

    expect(
      await execute(update, {
        componentId: 'ecommerce-ecs',
        changes: {
          replicas: 2,
          availabilityZones: ['eu-west-1a', 'eu-west-1b'],
          configuration: { autoscaling: true },
        },
      }),
    ).toMatchObject({ ok: true });

    for (const input of [
      {
        kind: 'waf',
        name: 'Storefront WAF',
        critical: true,
      },
      {
        kind: 'queue',
        name: 'Order Buffer',
        configuration: { deadLetterQueue: true, encrypted: true },
      },
      {
        kind: 'secrets-manager',
        name: 'Application Secrets',
        configuration: { automaticRotation: true },
      },
      {
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
      },
    ]) {
      expect(await execute(add, input)).toMatchObject({ ok: true });
    }

    const byName = (name: string) =>
      architectureStore
        .getState()
        .architecture.components.find((component) => component.name === name)!
        .id;
    const wafId = byName('Storefront WAF');
    const queueId = byName('Order Buffer');
    const secretsId = byName('Application Secrets');
    const replicaId = byName('Orders Failover Replica');

    expect(
      await execute(disconnect, { connectionId: 'ecommerce-edge-2' }),
    ).toMatchObject({ ok: true });
    for (const input of [
      {
        sourceComponentId: 'ecommerce-cloudfront',
        targetComponentId: wafId,
        type: 'request',
        protocol: 'HTTPS',
        encrypted: true,
      },
      {
        sourceComponentId: wafId,
        targetComponentId: 'ecommerce-alb',
        type: 'request',
        protocol: 'HTTPS',
        encrypted: true,
      },
      {
        sourceComponentId: 'ecommerce-ecs',
        targetComponentId: queueId,
        type: 'async',
        protocol: 'HTTPS',
        encrypted: true,
      },
      {
        sourceComponentId: secretsId,
        targetComponentId: 'ecommerce-ecs',
        type: 'management',
        protocol: 'HTTPS',
        encrypted: true,
      },
      {
        sourceComponentId: 'ecommerce-postgresql',
        targetComponentId: replicaId,
        type: 'replication',
        protocol: 'PostgreSQL/TLS',
        encrypted: true,
      },
    ]) {
      expect(await execute(connect, input)).toMatchObject({ ok: true });
    }

    const architecture = architectureStore.getState().architecture;
    const primaryDatabase = architecture.components.find(
      (component) => component.id === 'ecommerce-postgresql',
    );
    const analysis = analyzeArchitecture(architecture);
    const simulation = simulateFailure(architecture, {
      scope: 'availability-zone',
      target: 'eu-west-1a',
    });

    expect(primaryDatabase).toMatchObject({
      locked: true,
      availabilityZones: ['eu-west-1a'],
      configuration: { multiAZ: false },
    });
    expect(analysis).toMatchObject({
      estimatedMonthlyCost: 1288,
      resilienceScore: 100,
      securityScore: 90,
      constraints: {
        withinBudget: true,
        allApplicableConstraintsMet: true,
      },
    });
    expect(simulation).toMatchObject({
      status: 'degraded',
      criticalPathsRemaining: true,
      failedComponentIds: [],
    });
  });
});
