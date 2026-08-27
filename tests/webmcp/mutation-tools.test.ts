import { createJSONStorage, type StateStorage } from 'zustand/middleware';
import { describe, expect, it, vi } from 'vitest';

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
  const architectureStore = createArchitectureStore({
    initialArchitecture: getArchitectureTemplate('ecommerce-production'),
    storage: createJSONStorage<PersistedArchitectureState>(() =>
      memoryStorage(),
    )!,
    skipHydration: true,
  });
  const intelligenceStore = createIntelligenceStore(architectureStore);
  let editModeEnabled = true;
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
  it('exposes exactly five strict, explicitly mutating tools', () => {
    const { tools } = createHarness();

    expect(tools.map((tool) => tool.name)).toEqual(WEBMCP_MUTATION_TOOL_NAMES);
    expect(tools.map((tool) => tool.name)).not.toContain('unlock_component');
    expect(tools.map((tool) => tool.name)).not.toContain('set_constraints');
    for (const tool of tools) {
      expect(tool.annotations).toEqual({
        readOnlyHint: false,
        untrustedContentHint: false,
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
});
