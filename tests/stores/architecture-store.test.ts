import { createJSONStorage, type StateStorage } from 'zustand/middleware';
import { describe, expect, it, vi } from 'vitest';

import {
  ArchitectureDomainError,
  type AddComponentInput,
} from '../../src/architecture/model';
import {
  ARCHITECTURE_STORAGE_KEY,
  createArchitectureStore,
  type PersistedArchitectureState,
} from '../../src/stores/architecture-store';
import { getArchitectureTemplate } from '../../src/templates';

function createMemoryStorage(): StateStorage {
  const values = new Map<string, string>();
  return {
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => {
      values.set(name, value);
    },
    removeItem: (name) => {
      values.delete(name);
    },
  };
}

function createPersistStorage(storage: StateStorage) {
  return createJSONStorage<PersistedArchitectureState>(() => storage)!;
}

function createTestStore(isAgentEditingEnabled = () => false) {
  return createArchitectureStore({
    isAgentEditingEnabled,
    initialArchitecture: getArchitectureTemplate('ecommerce-production'),
    storage: createPersistStorage(createMemoryStorage()),
    skipHydration: true,
  });
}

describe('architecture store mutations', () => {
  it('rehydrates network membership, nested rules, pending subnet edits, and undo history', () => {
    const storage = createPersistStorage(createMemoryStorage());
    const first = createArchitectureStore({ storage });
    first
      .getState()
      .loadArchitecture(getArchitectureTemplate('private-network'));
    first
      .getState()
      .updateComponent('net-private-b', { configuration: { routes: [] } });
    first.getState().undo();
    first.getState().addComponent({ kind: 'subnet' });
    const second = createArchitectureStore({ storage });
    expect(second.getState().persistenceRecoveryNotice).toBeNull();
    expect(second.getState().architecture).toEqual(
      first.getState().architecture,
    );
    expect(second.getState().past).toEqual(first.getState().past);
    expect(second.getState().activity).toEqual(first.getState().activity);
  });

  it('enforces agent permission at the domain boundary, including after revocation', () => {
    let enabled = false;
    const store = createTestStore(() => enabled);
    const operations = [
      () => store.getState().addComponent({ kind: 'queue' }, 'agent'),
      () =>
        store
          .getState()
          .updateComponent('ecommerce-ecs', { replicas: 2 }, 'agent'),
      () => store.getState().removeComponent('ecommerce-ecs', 'agent'),
      () =>
        store.getState().connectComponents(
          {
            source: 'ecommerce-internet',
            target: 'ecommerce-ecs',
            type: 'request',
          },
          'agent',
        ),
      () => store.getState().disconnectComponents('ecommerce-edge-1', 'agent'),
    ];
    const before = store.getState();
    for (const run of operations)
      expect(run).toThrowError(
        expect.objectContaining({ code: 'EDIT_MODE_DISABLED' }),
      );
    expect(store.getState()).toBe(before);
    enabled = true;
    store.getState().addComponent({ kind: 'queue' }, 'agent');
    enabled = false;
    const revoked = store.getState();
    for (const run of operations)
      expect(run).toThrowError(
        expect.objectContaining({ code: 'EDIT_MODE_DISABLED' }),
      );
    expect(store.getState()).toBe(revoked);
  });

  it('keeps human controls and protected fields out of agent domain authority', () => {
    const store = createTestStore(() => true);
    const state = store.getState();
    for (const run of [
      () => state.lockComponent('ecommerce-postgresql', 'agent'),
      () => state.unlockComponent('ecommerce-postgresql', 'agent'),
      () => state.setConstraints({ maximumMonthlyCost: 1 }, 'agent'),
      () => state.loadArchitecture(state.architecture, 'agent'),
      () => state.resetArchitecture('serverless-api', 'agent'),
      () => state.undo('agent'),
      () => state.redo('agent'),
      () => state.renameArchitecture('Unauthorized', 'agent'),
      () => state.moveComponent('ecommerce-ecs', { x: 10, y: 10 }, 'agent'),
      () =>
        state.updateConnection(
          'ecommerce-edge-1',
          { encrypted: false },
          'agent',
        ),
      () =>
        state.updateComponent(
          'ecommerce-ecs',
          { metadata: { injected: true } },
          'agent',
        ),
      () => state.addComponent({ kind: 'queue', id: 'chosen-id' }, 'agent'),
    ])
      expect(run).toThrowError(
        expect.objectContaining({ code: 'HUMAN_ACTION_REQUIRED' }),
      );
    expect(store.getState()).toBe(state);
  });

  it('creates and loads validated architectures without corrupting state on failure', () => {
    const store = createTestStore();
    const created = store.getState().createArchitecture(
      {
        id: 'architecture-greenfield',
        name: 'Greenfield Platform',
        region: 'eu-central-1',
      },
      'human',
    );

    expect(created).toMatchObject({
      id: 'architecture-greenfield',
      name: 'Greenfield Platform',
      region: 'eu-central-1',
      components: [],
      connections: [],
    });

    const serverless = getArchitectureTemplate('serverless-api');
    store.getState().loadArchitecture(serverless, 'system');
    expect(store.getState().architecture.name).toBe('Serverless API');

    const beforeInvalidLoad = store.getState().architecture;
    expect(() =>
      store.getState().loadArchitecture({ invalid: true }),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_ARCHITECTURE' }));
    expect(store.getState().architecture).toBe(beforeInvalidLoad);
  });

  it('adds, updates, and removes components through domain actions', () => {
    const store = createTestStore();
    const queue = store.getState().addComponent(
      {
        id: 'orders-queue',
        kind: 'queue',
        name: 'Orders Queue',
      },
      'human',
    );

    expect(store.getState().architecture.components).toContainEqual(queue);

    const updated = store.getState().updateComponent<'queue'>(
      queue.id,
      {
        name: 'Checkout Queue',
        configuration: { queueType: 'fifo' },
      },
      'human',
    );
    expect(updated.name).toBe('Checkout Queue');
    if (updated.kind === 'queue') {
      expect(updated.configuration.queueType).toBe('fifo');
      expect(updated.configuration.encrypted).toBe(true);
    }

    const edgeId = store.getState().connectComponents({
      id: 'ecs-to-queue',
      source: 'ecommerce-ecs',
      target: queue.id,
      type: 'async',
    });
    expect(edgeId).toBe('ecs-to-queue');

    const updatedEdge = store.getState().updateConnection(edgeId, {
      type: 'data',
      protocol: 'HTTPS',
      encrypted: false,
    });
    expect(updatedEdge).toMatchObject({
      type: 'data',
      protocol: 'HTTPS',
      encrypted: false,
    });

    store.getState().removeComponent(queue.id);
    expect(
      store
        .getState()
        .architecture.components.some((component) => component.id === queue.id),
    ).toBe(false);
    expect(
      store
        .getState()
        .architecture.connections.some(
          (connection) => connection.id === edgeId,
        ),
    ).toBe(false);
  });

  it('validates edge endpoints, self-connections, and missing edges', () => {
    const store = createTestStore();

    expect(() =>
      store.getState().connectComponents({
        source: 'missing',
        target: 'ecommerce-ecs',
        type: 'request',
      }),
    ).toThrowError(expect.objectContaining({ code: 'COMPONENT_NOT_FOUND' }));

    expect(() =>
      store.getState().connectComponents({
        source: 'ecommerce-ecs',
        target: 'ecommerce-ecs',
        type: 'request',
      }),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_CONNECTION' }));

    expect(() =>
      store.getState().disconnectComponents('missing-edge'),
    ).toThrowError(expect.objectContaining({ code: 'EDGE_NOT_FOUND' }));
  });

  it('enforces locked configuration while allowing visual movement', () => {
    const store = createTestStore();
    const componentId = 'ecommerce-postgresql';

    store.getState().lockComponent(componentId);

    expect(() =>
      store.getState().updateComponent<'sql-database'>(componentId, {
        configuration: { multiAZ: true },
      }),
    ).toThrowError(expect.objectContaining({ code: 'COMPONENT_LOCKED' }));
    expect(() => store.getState().removeComponent(componentId)).toThrowError(
      expect.objectContaining({ code: 'COMPONENT_LOCKED' }),
    );

    const moved = store
      .getState()
      .moveComponent(componentId, { x: 1200, y: 320 });
    expect(moved.position).toEqual({ x: 1200, y: 320 });
    expect(moved.locked).toBe(true);

    store.getState().unlockComponent(componentId);
    const updated = store
      .getState()
      .updateComponent<'sql-database'>(componentId, {
        configuration: { multiAZ: true },
      });
    if (updated.kind === 'sql-database') {
      expect(updated.configuration.multiAZ).toBe(true);
    }
  });

  it('updates human-defined constraints with schema validation', () => {
    const store = createTestStore();
    const constraints = store.getState().setConstraints({
      maximumMonthlyCost: 3000,
      targetResilienceScore: 90,
      targetSecurityScore: 85,
      requiredRegion: 'eu-west-1',
      requireMultiAZ: true,
      requireEncryptionAtRest: true,
      notes: { decision: 'Keep PostgreSQL' },
    });

    expect(constraints).toEqual({
      maximumMonthlyCost: 3000,
      targetResilienceScore: 90,
      targetSecurityScore: 85,
      requiredRegion: 'eu-west-1',
      requireMultiAZ: true,
      requireEncryptionAtRest: true,
      notes: { decision: 'Keep PostgreSQL' },
    });
    expect(() =>
      store.getState().setConstraints({ targetResilienceScore: 101 }),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_ARCHITECTURE' }));
  });

  it('rejects duplicate component ids with a typed domain error', () => {
    const store = createTestStore();

    try {
      store.getState().addComponent({
        id: 'ecommerce-ecs',
        kind: 'queue',
      });
      throw new Error('Expected addComponent to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(ArchitectureDomainError);
      expect(error).toMatchObject({
        code: 'DUPLICATE_COMPONENT_ID',
        componentId: 'ecommerce-ecs',
      });
    }
  });

  it('translates invalid runtime component input into a structured error', () => {
    const store = createTestStore();
    const invalidInput = {
      id: 'invalid-database',
      kind: 'sql-database',
      configuration: { storageGb: 1 },
    } as unknown as AddComponentInput;

    expect(() => store.getState().addComponent(invalidInput)).toThrowError(
      expect.objectContaining({
        code: 'INVALID_CONFIGURATION',
        componentId: 'invalid-database',
      }),
    );
  });
});

describe('architecture history and activity', () => {
  it('supports undo, redo, and future invalidation', () => {
    const store = createTestStore();
    const originalName = store.getState().architecture.name;

    store.getState().renameArchitecture('Resilient Ecommerce');
    expect(store.getState().architecture.name).toBe('Resilient Ecommerce');
    expect(store.getState().undo()).toBe(true);
    expect(store.getState().architecture.name).toBe(originalName);
    expect(store.getState().redo()).toBe(true);
    expect(store.getState().architecture.name).toBe('Resilient Ecommerce');

    store.getState().undo();
    store.getState().renameArchitecture('Alternative Design');
    expect(store.getState().future).toHaveLength(0);
    expect(store.getState().redo()).toBe(false);
  });

  it('records the actor and action for every mutation', () => {
    const store = createTestStore(() => true);

    const added = store.getState().addComponent(
      {
        kind: 'queue',
        name: 'Agent Queue',
      },
      'agent',
    );

    expect(store.getState().activity.at(-1)).toMatchObject({
      actor: 'agent',
      action: 'component.added',
      summary: 'Added Agent Queue',
      details: { componentId: added.id, kind: 'queue' },
    });

    store.getState().undo('human');
    expect(store.getState().activity.at(-1)).toMatchObject({
      actor: 'human',
      action: 'history.undo',
    });
  });

  it('loads ecommerce by default and can reset to another template', () => {
    const storage = createPersistStorage(createMemoryStorage());
    const store = createArchitectureStore({ storage, skipHydration: true });

    expect(store.getState().architecture.name).toBe('Ecommerce Production');
    store.getState().resetArchitecture('serverless-api', 'system');
    expect(store.getState().architecture.name).toBe('Serverless API');
    expect(store.getState().activity.at(-1)).toMatchObject({
      actor: 'system',
      action: 'architecture.reset',
    });
  });
});

describe('architecture local persistence', () => {
  it('keeps edits and history usable when storage fills after hydration', () => {
    const memory = createMemoryStorage();
    const storage = createPersistStorage(memory);
    const store = createArchitectureStore({ storage });
    store.getState().renameArchitecture('Saved project');
    const saved = memory.getItem(ARCHITECTURE_STORAGE_KEY);
    const failingWrite = vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is full', 'QuotaExceededError');
    });
    expect(() =>
      store.getState().renameArchitecture('In memory project'),
    ).not.toThrow();
    expect(store.getState().persistenceUnavailable).toBe(true);
    expect(store.getState().architecture.name).toBe('In memory project');
    expect(store.getState().undo()).toBe(true);
    expect(store.getState().architecture.name).toBe('Saved project');
    expect(store.getState().redo()).toBe(true);
    expect(store.getState().architecture.name).toBe('In memory project');
    expect(memory.getItem(ARCHITECTURE_STORAGE_KEY)).toBe(saved);
    expect(failingWrite).toHaveBeenCalledTimes(1);
  });

  it('handles asynchronous write rejection without an unhandled promise or lost commit', async () => {
    const storage = createPersistStorage(createMemoryStorage());
    storage.setItem = () => Promise.reject(new Error('Storage unavailable'));
    const store = createArchitectureStore({ storage, skipHydration: true });
    store.getState().renameArchitecture('Current session');
    await Promise.resolve();
    expect(store.getState().persistenceUnavailable).toBe(true);
    expect(store.getState().architecture.name).toBe('Current session');
    expect(store.getState().past).toHaveLength(1);
    expect(store.getState().activity).toHaveLength(1);
  });

  it('starts a usable memory-only workspace when localStorage access is denied', () => {
    const denied = vi
      .spyOn(window, 'localStorage', 'get')
      .mockImplementation(() => {
        throw new DOMException('Access denied', 'SecurityError');
      });
    try {
      const store = createArchitectureStore();
      expect(store.getState().persistenceUnavailable).toBe(true);
      expect(() =>
        store.getState().addComponent({ kind: 'queue' }),
      ).not.toThrow();
      expect(store.getState().architecture.components).toHaveLength(6);
      expect(() => store.getState().resetDemo()).not.toThrow();
      expect(store.getState().architecture.components).toHaveLength(5);
      expect(store.getState().past).toEqual([]);
    } finally {
      denied.mockRestore();
    }
  });
  it('recovers from malicious metadata and oversized history without overwriting the saved source', () => {
    const template = getArchitectureTemplate('ecommerce-production');
    for (const state of [
      {
        architecture: {
          ...template,
          metadata: JSON.parse('{"__proto__":{"polluted":true}}') as unknown,
        },
        activity: [],
        past: [],
        future: [],
      },
      {
        architecture: template,
        activity: [],
        past: Array.from({ length: 101 }, () => template),
        future: [],
      },
    ]) {
      const memory = createMemoryStorage();
      const saved = JSON.stringify({ version: 1, state });
      memory.setItem(ARCHITECTURE_STORAGE_KEY, saved);
      const store = createArchitectureStore({
        storage: createPersistStorage(memory),
      });
      expect(store.persist.hasHydrated()).toBe(true);
      expect(store.getState().persistenceRecoveryNotice).toContain(
        'restored safely',
      );
      expect(store.getState().past).toEqual([]);
      expect(memory.getItem(ARCHITECTURE_STORAGE_KEY)).toBe(saved);
    }
    expect(Object.prototype).not.toHaveProperty('polluted');
  });

  it('rehydrates the current project from the versioned storage key', () => {
    const memoryStorage = createMemoryStorage();
    const storage = createPersistStorage(memoryStorage);
    const firstStore = createArchitectureStore({ storage });

    firstStore.getState().renameArchitecture('Persisted Architecture');
    firstStore.getState().addComponent({
      id: 'persisted-queue',
      kind: 'queue',
    });

    expect(memoryStorage.getItem(ARCHITECTURE_STORAGE_KEY)).toContain(
      'Persisted Architecture',
    );

    const secondStore = createArchitectureStore({ storage });
    expect(secondStore.getState().architecture.name).toBe(
      'Persisted Architecture',
    );
    expect(
      secondStore
        .getState()
        .architecture.components.some(
          (component) => component.id === 'persisted-queue',
        ),
    ).toBe(true);
  });

  it('falls back to the default template when persisted state is invalid', () => {
    const memoryStorage = createMemoryStorage();
    memoryStorage.setItem(
      ARCHITECTURE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        state: { architecture: { invalid: true } },
      }),
    );
    const storage = createPersistStorage(memoryStorage);
    const store = createArchitectureStore({ storage });

    expect(store.getState().architecture.name).toBe('Ecommerce Production');
    expect(store.getState().past).toEqual([]);
    expect(store.getState().persistenceRecoveryNotice).toContain(
      'canonical Ecommerce demo was restored safely',
    );
  });

  it('reports recovery when saved JSON cannot be parsed', () => {
    const memoryStorage = createMemoryStorage();
    const malformedJson = '{"version":1,"state":';
    memoryStorage.setItem(ARCHITECTURE_STORAGE_KEY, malformedJson);

    const store = createArchitectureStore({
      storage: createPersistStorage(memoryStorage),
    });

    expect(store.persist.hasHydrated()).toBe(true);
    expect(store.getState().architecture.name).toBe('Ecommerce Production');
    expect(store.getState().past).toEqual([]);
    expect(store.getState().persistenceRecoveryNotice).toContain(
      'canonical Ecommerce demo was restored safely',
    );
    expect(memoryStorage.getItem(ARCHITECTURE_STORAGE_KEY)).toBe(malformedJson);
  });

  it('completes hydration and reports an asynchronous storage read failure', async () => {
    const memoryStorage = createMemoryStorage();
    const storage = createPersistStorage({
      ...memoryStorage,
      getItem: () => Promise.reject(new Error('Storage read failed')),
    });
    const store = createArchitectureStore({ storage, skipHydration: true });

    await store.persist.rehydrate();

    expect(store.persist.hasHydrated()).toBe(true);
    expect(store.getState().architecture.name).toBe('Ecommerce Production');
    expect(store.getState().persistenceRecoveryNotice).toContain(
      'canonical Ecommerce demo was restored safely',
    );
    expect(memoryStorage.getItem(ARCHITECTURE_STORAGE_KEY)).toBeNull();
  });

  it('uses browser localStorage through the versioned production key', () => {
    localStorage.removeItem(ARCHITECTURE_STORAGE_KEY);
    expect(ARCHITECTURE_STORAGE_KEY).toMatch(/\.v1$/);

    const store = createArchitectureStore();
    store.getState().renameArchitecture('Browser Local Project');

    expect(localStorage.getItem(ARCHITECTURE_STORAGE_KEY)).toContain(
      'Browser Local Project',
    );
    localStorage.removeItem(ARCHITECTURE_STORAGE_KEY);
  });
});
