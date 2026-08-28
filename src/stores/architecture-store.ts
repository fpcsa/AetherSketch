import { referencedComponentIds } from '../architecture/network/structure';
import { create } from 'zustand';
import {
  createJSONStorage,
  persist,
  type PersistStorage,
  type StateStorage,
  type StorageValue,
} from 'zustand/middleware';

import { createComponentFromCatalog } from '../architecture/catalog';
import { jsonSafetyIssue } from '../architecture/model/json-safety';
import { useWebMcpStore } from '../webmcp/webmcp-store';
import {
  ArchitectureDomainError,
  activityEntrySchema,
  architectureSchema,
  cloneArchitecture,
  createEmptyArchitecture,
  isArchitectureDomainError,
  validateArchitecture,
  withIncrementedRevision,
} from '../architecture/model';
import type {
  Actor,
  ActivityEntry,
  AddComponentInput,
  Architecture,
  ArchitectureComponent,
  ArchitectureConnection,
  ArchitectureConstraints,
  ComponentKind,
  ComponentPosition,
  ComponentUpdate,
  ConnectionUpdate,
  ConnectComponentsInput,
  CreateArchitectureInput,
  JsonObject,
} from '../architecture/model';
import {
  DEFAULT_ARCHITECTURE_TEMPLATE_ID,
  getArchitectureTemplate,
  type ArchitectureTemplateId,
} from '../templates';

export const ARCHITECTURE_STORAGE_KEY = 'aethersketch.architecture.v1';
const PERSISTENCE_VERSION = 1;
const HISTORY_LIMIT = 100;
const ACTIVITY_LIMIT = 500;

export type PersistedArchitectureState = {
  architecture: Architecture;
  activity: ActivityEntry[];
  past: Architecture[];
  future: Architecture[];
};

export type RecordActivityInput = Pick<
  ActivityEntry,
  'actor' | 'action' | 'summary' | 'details'
>;

export type ArchitectureStore = PersistedArchitectureState & {
  persistenceRecoveryNotice: string | null;
  persistenceUnavailable: boolean;
  createArchitecture: (
    input: CreateArchitectureInput,
    actor?: Actor,
  ) => Architecture;
  loadArchitecture: (architecture: unknown, actor?: Actor) => Architecture;
  addComponent: (
    input: AddComponentInput,
    actor?: Actor,
  ) => ArchitectureComponent;
  updateComponent: <K extends ComponentKind>(
    componentId: string,
    changes: ComponentUpdate<K>,
    actor?: Actor,
  ) => ArchitectureComponent;
  removeComponent: (componentId: string, actor?: Actor) => void;
  connectComponents: (input: ConnectComponentsInput, actor?: Actor) => string;
  updateConnection: (
    connectionId: string,
    changes: ConnectionUpdate,
    actor?: Actor,
  ) => ArchitectureConnection;
  disconnectComponents: (connectionId: string, actor?: Actor) => void;
  setConstraints: (
    constraints: Partial<ArchitectureConstraints>,
    actor?: Actor,
  ) => ArchitectureConstraints;
  lockComponent: (componentId: string, actor?: Actor) => ArchitectureComponent;
  unlockComponent: (
    componentId: string,
    actor?: Actor,
  ) => ArchitectureComponent;
  moveComponent: (
    componentId: string,
    position: ComponentPosition,
    actor?: Actor,
  ) => ArchitectureComponent;
  renameArchitecture: (name: string, actor?: Actor) => void;
  resetArchitecture: (
    templateId?: ArchitectureTemplateId,
    actor?: Actor,
  ) => Architecture;
  resetDemo: () => Architecture;
  recordActivity: (input: RecordActivityInput) => ActivityEntry;
  clearPersistenceRecoveryNotice: () => void;
  undo: (actor?: Actor) => boolean;
  redo: (actor?: Actor) => boolean;
};

type ArchitectureStoreOptions = {
  isAgentEditingEnabled?: () => boolean;
  initialArchitecture?: Architecture;
  storage?: PersistStorage<PersistedArchitectureState>;
  storageKey?: string;
  skipHydration?: boolean;
};

function getSafeStateStorage(
  onUnavailable: () => void,
): StateStorage | undefined {
  if (typeof window === 'undefined') {
    onUnavailable();
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    onUnavailable();
    return undefined;
  }
}

function createActivity(
  actor: Actor,
  action: ActivityEntry['action'],
  summary: string,
  details?: JsonObject,
): ActivityEntry {
  return activityEntrySchema.parse({
    id: `activity-${crypto.randomUUID()}`,
    timestamp: new Date().toISOString(),
    actor,
    action,
    summary,
    details,
  });
}

function requireComponent(
  architecture: Architecture,
  componentId: string,
): ArchitectureComponent {
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

  return component;
}

function requireUnlockedComponent(
  architecture: Architecture,
  componentId: string,
): ArchitectureComponent {
  const component = requireComponent(architecture, componentId);

  if (component.locked) {
    throw new ArchitectureDomainError(
      'COMPONENT_LOCKED',
      `Component is locked: ${component.name}`,
      { componentId },
    );
  }

  return component;
}

function mutationConfigurationError(
  error: unknown,
  componentId?: string,
): never {
  if (
    isArchitectureDomainError(error) &&
    error.code !== 'INVALID_ARCHITECTURE'
  ) {
    throw error;
  }

  throw new ArchitectureDomainError(
    'INVALID_CONFIGURATION',
    isArchitectureDomainError(error) &&
      Array.isArray(error.details?.issues) &&
      error.details.issues[0] &&
      typeof error.details.issues[0] === 'object' &&
      !Array.isArray(error.details.issues[0]) &&
      typeof error.details.issues[0].message === 'string'
      ? `Invalid configuration: ${error.details.issues[0].message}`
      : 'The component configuration is invalid.',
    {
      componentId,
      details:
        isArchitectureDomainError(error) && error.details
          ? error.details
          : undefined,
      cause: error,
    },
  );
}

function parsedPersistedState(
  value: unknown,
): PersistedArchitectureState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  if (
    jsonSafetyIssue(value, {
      maxDepth: 28,
      maxNodes: 300_000,
      maxCharacters: 8_000_000,
    })
  )
    return null;

  const candidate = value as Partial<PersistedArchitectureState>;
  const architecture = architectureSchema.safeParse(candidate.architecture);
  const activity = activityEntrySchema
    .array()
    .max(ACTIVITY_LIMIT)
    .safeParse(candidate.activity);
  const past = architectureSchema
    .array()
    .max(HISTORY_LIMIT)
    .safeParse(candidate.past);
  const future = architectureSchema
    .array()
    .max(HISTORY_LIMIT)
    .safeParse(candidate.future);

  if (
    !architecture.success ||
    !activity.success ||
    !past.success ||
    !future.success
  ) {
    return null;
  }

  return {
    architecture: architecture.data,
    activity: activity.data,
    past: past.data,
    future: future.data,
  };
}

export function createArchitectureStore(
  options: ArchitectureStoreOptions = {},
) {
  const initialArchitecture = cloneArchitecture(
    options.initialArchitecture ??
      getArchitectureTemplate(DEFAULT_ARCHITECTURE_TEMPLATE_ID),
  );
  let persistenceUnavailable = false;
  let notifyPersistenceUnavailable = () => {};
  const failPersistence = () => {
    if (persistenceUnavailable) return;
    persistenceUnavailable = true;
    notifyPersistenceUnavailable();
  };
  const memoryValues = new Map<
    string,
    StorageValue<PersistedArchitectureState>
  >();
  const stateStorage = options.storage
    ? undefined
    : getSafeStateStorage(failPersistence);
  const storage =
    options.storage ??
    (stateStorage
      ? createJSONStorage<PersistedArchitectureState>(() => stateStorage)
      : undefined);
  let persistenceReadFailed = false;
  const recoverStorageRead = () => {
    persistenceReadFailed = true;
    return null;
  };
  const recoverableStorage: PersistStorage<PersistedArchitectureState> = {
    getItem: (name) => {
      if (persistenceUnavailable) return memoryValues.get(name) ?? null;
      persistenceReadFailed = false;
      try {
        const saved = storage?.getItem(name) ?? null;
        return saved instanceof Promise
          ? saved.catch(recoverStorageRead)
          : saved;
      } catch {
        // Let hydration complete and surface recovery without overwriting the saved data.
        return recoverStorageRead();
      }
    },
    setItem: (name, value) => {
      memoryValues.set(name, value);
      if (persistenceUnavailable) return;
      try {
        const saved = storage?.setItem(name, value);
        if (saved instanceof Promise) return saved.catch(failPersistence);
      } catch {
        // A quota/policy failure must not turn a committed domain action into an error.
        failPersistence();
      }
    },
    removeItem: (name) => {
      memoryValues.delete(name);
      if (persistenceUnavailable) return;
      try {
        const removed = storage?.removeItem(name);
        if (removed instanceof Promise) return removed.catch(failPersistence);
      } catch {
        failPersistence();
      }
    },
  };

  return create<ArchitectureStore>()(
    persist<ArchitectureStore, [], [], PersistedArchitectureState>(
      (set, get) => {
        notifyPersistenceUnavailable = () => {
          if (get()) set({ persistenceUnavailable: true });
        };
        const requireAgentPermission = (actor: Actor) => {
          if (actor === 'agent' && !options.isAgentEditingEnabled?.()) {
            throw new ArchitectureDomainError(
              'EDIT_MODE_DISABLED',
              'Agent editing is disabled. Ask the human to enable Agent Edit Mode.',
            );
          }
        };
        const requireHuman = (actor: Actor) => {
          if (actor === 'agent') {
            throw new ArchitectureDomainError(
              'HUMAN_ACTION_REQUIRED',
              'This architecture action requires the human UI.',
            );
          }
        };
        const requireAgentFields = (
          actor: Actor,
          value: object,
          fields: string[],
        ) => {
          requireAgentPermission(actor);
          if (
            actor === 'agent' &&
            Object.keys(value).some((key) => !fields.includes(key))
          ) {
            throw new ArchitectureDomainError(
              'HUMAN_ACTION_REQUIRED',
              'The requested fields are outside agent edit authority.',
            );
          }
        };
        const commit = (
          architecture: Architecture,
          actor: Actor,
          action: ActivityEntry['action'],
          summary: string,
          details?: JsonObject,
        ) => {
          requireAgentPermission(actor);
          const nextArchitecture = validateArchitecture(architecture);
          set((state) => ({
            architecture: nextArchitecture,
            past: [...state.past, cloneArchitecture(state.architecture)].slice(
              -HISTORY_LIMIT,
            ),
            future: [],
            activity: [
              ...state.activity,
              createActivity(actor, action, summary, details),
            ].slice(-ACTIVITY_LIMIT),
          }));
          return nextArchitecture;
        };

        return {
          architecture: initialArchitecture,
          activity: [],
          past: [],
          future: [],
          persistenceRecoveryNotice: null,
          persistenceUnavailable,

          createArchitecture: (input, actor = 'human') => {
            requireHuman(actor);
            const architecture = createEmptyArchitecture(input);
            return commit(
              architecture,
              actor,
              'architecture.created',
              `Created architecture “${architecture.name}”`,
              { architectureId: architecture.id },
            );
          },

          loadArchitecture: (value, actor = 'human') => {
            requireHuman(actor);
            const architecture = validateArchitecture(value);
            return commit(
              cloneArchitecture(architecture),
              actor,
              'architecture.loaded',
              `Loaded architecture “${architecture.name}”`,
              { architectureId: architecture.id },
            );
          },

          addComponent: (input, actor = 'human') => {
            requireAgentFields(actor, input, [
              'kind',
              'name',
              'region',
              'availabilityZones',
              'replicas',
              'critical',
              'configuration',
              'network',
              'position',
            ]);
            const current = get().architecture;
            const componentId = input.id;

            if (
              componentId &&
              current.components.some(
                (component) => component.id === componentId,
              )
            ) {
              throw new ArchitectureDomainError(
                'DUPLICATE_COMPONENT_ID',
                `Component id already exists: ${componentId}`,
                { componentId },
              );
            }

            let component: ArchitectureComponent;
            let next: Architecture;

            try {
              component = createComponentFromCatalog(input, {
                provider: current.provider.provider,
                region: current.region,
              });
              next = withIncrementedRevision(current, {
                components: [...current.components, component],
              });
            } catch (error) {
              mutationConfigurationError(error, componentId);
            }

            commit(next, actor, 'component.added', `Added ${component.name}`, {
              componentId: component.id,
              kind: component.kind,
            });
            return component;
          },

          updateComponent: (componentId, changes, actor = 'human') => {
            requireAgentFields(actor, changes, [
              'name',
              'region',
              'availabilityZones',
              'replicas',
              'critical',
              'configuration',
              'network',
            ]);
            const current = get().architecture;
            const component = requireUnlockedComponent(current, componentId);
            let updatedComponent: ArchitectureComponent;
            let next: Architecture;

            try {
              updatedComponent = {
                ...component,
                ...changes,
                configuration: changes.configuration
                  ? {
                      ...component.configuration,
                      ...changes.configuration,
                    }
                  : component.configuration,
                metadata: changes.metadata ?? component.metadata,
              } as ArchitectureComponent;
              next = withIncrementedRevision(current, {
                components: current.components.map((candidate) =>
                  candidate.id === componentId ? updatedComponent : candidate,
                ),
              });
            } catch (error) {
              mutationConfigurationError(error, componentId);
            }

            commit(
              next,
              actor,
              'component.updated',
              `Updated ${updatedComponent.name}`,
              { componentId },
            );
            return updatedComponent;
          },

          removeComponent: (componentId, actor = 'human') => {
            requireAgentPermission(actor);
            const current = get().architecture;
            const component = requireUnlockedComponent(current, componentId);
            const dependent = current.components.find(
              (candidate) =>
                candidate.id !== componentId &&
                referencedComponentIds(candidate).includes(componentId),
            );
            if (dependent)
              throw new ArchitectureDomainError(
                'INVALID_CONFIGURATION',
                `Detach network references from ${dependent.name} before deleting ${component.name}.`,
                { componentId },
              );
            const removedConnections = current.connections.filter(
              (connection) =>
                connection.source === componentId ||
                connection.target === componentId,
            ).length;
            const next = withIncrementedRevision(current, {
              components: current.components.filter(
                (candidate) => candidate.id !== componentId,
              ),
              connections: current.connections.filter(
                (connection) =>
                  connection.source !== componentId &&
                  connection.target !== componentId,
              ),
            });

            commit(
              next,
              actor,
              'component.removed',
              `Removed ${component.name}`,
              { componentId, removedConnections },
            );
          },

          connectComponents: (input, actor = 'human') => {
            requireAgentFields(actor, input, [
              'source',
              'target',
              'type',
              'protocol',
              'encrypted',
            ]);
            const current = get().architecture;
            requireComponent(current, input.source);
            requireComponent(current, input.target);

            if (input.source === input.target) {
              throw new ArchitectureDomainError(
                'INVALID_CONNECTION',
                'A component cannot connect to itself.',
                { details: { source: input.source, target: input.target } },
              );
            }

            const connectionId =
              input.id ?? `connection-${crypto.randomUUID()}`;
            if (
              current.connections.some(
                (connection) => connection.id === connectionId,
              )
            ) {
              throw new ArchitectureDomainError(
                'DUPLICATE_EDGE_ID',
                `Connection id already exists: ${connectionId}`,
                { edgeId: connectionId },
              );
            }

            const next = withIncrementedRevision(current, {
              connections: [
                ...current.connections,
                {
                  id: connectionId,
                  source: input.source,
                  target: input.target,
                  type: input.type,
                  protocol: input.protocol,
                  encrypted: input.encrypted ?? true,
                  critical: input.critical ?? false,
                  metadata: input.metadata ?? {},
                },
              ],
            });

            commit(
              next,
              actor,
              'connection.created',
              `Connected ${input.source} to ${input.target}`,
              { connectionId, source: input.source, target: input.target },
            );
            return connectionId;
          },

          updateConnection: (connectionId, changes, actor = 'human') => {
            requireHuman(actor);
            const current = get().architecture;
            const connection = current.connections.find(
              (candidate) => candidate.id === connectionId,
            );

            if (!connection) {
              throw new ArchitectureDomainError(
                'EDGE_NOT_FOUND',
                `Connection not found: ${connectionId}`,
                { edgeId: connectionId },
              );
            }

            const updatedConnection: ArchitectureConnection = {
              ...connection,
              ...changes,
              metadata: changes.metadata ?? connection.metadata,
            };
            const next = withIncrementedRevision(current, {
              connections: current.connections.map((candidate) =>
                candidate.id === connectionId ? updatedConnection : candidate,
              ),
            });
            commit(
              next,
              actor,
              'connection.updated',
              `Updated connection ${connectionId}`,
              { connectionId },
            );
            return updatedConnection;
          },

          disconnectComponents: (connectionId, actor = 'human') => {
            requireAgentPermission(actor);
            const current = get().architecture;
            const connection = current.connections.find(
              (candidate) => candidate.id === connectionId,
            );

            if (!connection) {
              throw new ArchitectureDomainError(
                'EDGE_NOT_FOUND',
                `Connection not found: ${connectionId}`,
                { edgeId: connectionId },
              );
            }

            const next = withIncrementedRevision(current, {
              connections: current.connections.filter(
                (candidate) => candidate.id !== connectionId,
              ),
            });
            commit(
              next,
              actor,
              'connection.removed',
              `Disconnected ${connection.source} from ${connection.target}`,
              { connectionId },
            );
          },

          setConstraints: (constraints, actor = 'human') => {
            requireHuman(actor);
            const current = get().architecture;
            const nextConstraints = {
              ...current.constraints,
              ...constraints,
            };
            const next = withIncrementedRevision(current, {
              constraints: nextConstraints,
            });
            commit(
              next,
              actor,
              'constraints.updated',
              'Updated architecture constraints',
            );
            return next.constraints;
          },

          lockComponent: (componentId, actor = 'human') => {
            requireHuman(actor);
            const current = get().architecture;
            const component = requireComponent(current, componentId);
            if (component.locked) {
              return component;
            }
            const updatedComponent = { ...component, locked: true };
            const next = withIncrementedRevision(current, {
              components: current.components.map((candidate) =>
                candidate.id === componentId ? updatedComponent : candidate,
              ),
            });
            commit(
              next,
              actor,
              'component.locked',
              `Locked ${component.name}`,
              { componentId },
            );
            return updatedComponent;
          },

          unlockComponent: (componentId, actor = 'human') => {
            requireHuman(actor);
            const current = get().architecture;
            const component = requireComponent(current, componentId);
            if (!component.locked) {
              return component;
            }
            const updatedComponent = { ...component, locked: false };
            const next = withIncrementedRevision(current, {
              components: current.components.map((candidate) =>
                candidate.id === componentId ? updatedComponent : candidate,
              ),
            });
            commit(
              next,
              actor,
              'component.unlocked',
              `Unlocked ${component.name}`,
              { componentId },
            );
            return updatedComponent;
          },

          moveComponent: (componentId, position, actor = 'human') => {
            requireHuman(actor);
            const current = get().architecture;
            const component = requireComponent(current, componentId);
            const updatedComponent = { ...component, position };
            let next: Architecture;

            try {
              next = withIncrementedRevision(current, {
                components: current.components.map((candidate) =>
                  candidate.id === componentId ? updatedComponent : candidate,
                ),
              });
            } catch (error) {
              mutationConfigurationError(error, componentId);
            }

            commit(next, actor, 'component.moved', `Moved ${component.name}`, {
              componentId,
              x: position.x,
              y: position.y,
            });
            return updatedComponent;
          },

          renameArchitecture: (name, actor = 'human') => {
            requireHuman(actor);
            const current = get().architecture;
            const next = withIncrementedRevision(current, { name });
            commit(
              next,
              actor,
              'architecture.renamed',
              `Renamed architecture to “${next.name}”`,
              { architectureId: next.id },
            );
          },

          resetArchitecture: (
            templateId = DEFAULT_ARCHITECTURE_TEMPLATE_ID,
            actor = 'human',
          ) => {
            requireHuman(actor);
            const architecture = getArchitectureTemplate(templateId);
            return commit(
              architecture,
              actor,
              'architecture.reset',
              `Reset architecture to ${architecture.name}`,
              { templateId },
            );
          },

          resetDemo: () => {
            const architecture = getArchitectureTemplate(
              DEFAULT_ARCHITECTURE_TEMPLATE_ID,
            );
            set({
              architecture,
              activity: [],
              past: [],
              future: [],
            });
            return architecture;
          },

          recordActivity: (input) => {
            const entry = createActivity(
              input.actor,
              input.action,
              input.summary,
              input.details,
            );
            set((state) => ({
              activity: [...state.activity, entry].slice(-ACTIVITY_LIMIT),
            }));
            return entry;
          },

          clearPersistenceRecoveryNotice: () =>
            set({ persistenceRecoveryNotice: null }),

          undo: (actor = 'human') => {
            requireHuman(actor);
            const state = get();
            const previous = state.past.at(-1);
            if (!previous) {
              return false;
            }

            set({
              architecture: cloneArchitecture(previous),
              past: state.past.slice(0, -1),
              future: [
                cloneArchitecture(state.architecture),
                ...state.future,
              ].slice(0, HISTORY_LIMIT),
              activity: [
                ...state.activity,
                createActivity(actor, 'history.undo', 'Undid the last change', {
                  restoredRevision: previous.revision,
                }),
              ].slice(-ACTIVITY_LIMIT),
            });
            return true;
          },

          redo: (actor = 'human') => {
            requireHuman(actor);
            const state = get();
            const nextArchitecture = state.future[0];
            if (!nextArchitecture) {
              return false;
            }

            set({
              architecture: cloneArchitecture(nextArchitecture),
              past: [
                ...state.past,
                cloneArchitecture(state.architecture),
              ].slice(-HISTORY_LIMIT),
              future: state.future.slice(1),
              activity: [
                ...state.activity,
                createActivity(actor, 'history.redo', 'Redid the last change', {
                  restoredRevision: nextArchitecture.revision,
                }),
              ].slice(-ACTIVITY_LIMIT),
            });
            return true;
          },
        };
      },
      {
        name: options.storageKey ?? ARCHITECTURE_STORAGE_KEY,
        version: PERSISTENCE_VERSION,
        storage: recoverableStorage,
        skipHydration: options.skipHydration,
        partialize: (state) => ({
          architecture: state.architecture,
          activity: state.activity,
          past: state.past,
          future: state.future,
        }),
        merge: (persistedState, currentState) => {
          const persisted = parsedPersistedState(persistedState);
          if (persisted) {
            return { ...currentState, ...persisted };
          }
          return persistedState || persistenceReadFailed
            ? {
                ...currentState,
                persistenceRecoveryNotice:
                  'Saved workspace data was invalid. The canonical Ecommerce demo was restored safely.',
              }
            : currentState;
        },
      },
    ),
  );
}

export const useArchitectureStore = createArchitectureStore({
  isAgentEditingEnabled: () => {
    const state = useWebMcpStore.getState();
    return (
      state.status === 'ready' &&
      state.mode === 'edit' &&
      state.editRegistrationStatus === 'ready'
    );
  },
});
