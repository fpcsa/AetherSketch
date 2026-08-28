import type { z } from 'zod';

import { nextAutomaticPosition } from '../../architecture/catalog';
import type {
  AddComponentInput,
  Architecture,
  ArchitectureComponent,
  ArchitectureConnection,
  ComponentUpdate,
  ConnectComponentsInput,
} from '../../architecture/model';
import { ArchitectureDomainError } from '../../architecture/model';
import { assertSafeToolInput } from '../schemas/input-safety';
import {
  type WebMcpToolResult,
  toWebMcpToolError,
  WebMcpExecutionError,
} from '../errors/tool-error';
import {
  addComponentInputJsonSchema,
  addComponentInputSchema,
  type AddComponentToolInput,
  connectComponentsInputJsonSchema,
  connectComponentsInputSchema,
  type ConnectComponentsToolInput,
  disconnectComponentsInputJsonSchema,
  disconnectComponentsInputSchema,
  type DisconnectComponentsToolInput,
  parseConfigurationPatch,
  removeComponentInputJsonSchema,
  removeComponentInputSchema,
  type RemoveComponentToolInput,
  updateComponentInputJsonSchema,
  updateComponentInputSchema,
  type UpdateComponentToolInput,
} from '../schemas/mutation-tool-schemas';

export const WEBMCP_MUTATION_TOOL_NAMES = [
  'add_component',
  'update_component',
  'remove_component',
  'connect_components',
  'disconnect_components',
] as const;

export type WebMcpMutationToolName =
  (typeof WEBMCP_MUTATION_TOOL_NAMES)[number];

export type WebMcpMutationReporter = {
  invocation: (toolName: WebMcpMutationToolName, input: unknown) => void;
  result: (toolName: WebMcpMutationToolName, result: unknown) => void;
  error: (toolName: WebMcpMutationToolName, error: unknown) => void;
};

export type WebMcpMutationToolDependencies = {
  isEditModeEnabled: () => boolean;
  getArchitecture: () => Architecture;
  addComponent: (input: AddComponentInput) => ArchitectureComponent;
  updateComponent: (
    componentId: string,
    changes: ComponentUpdate,
  ) => ArchitectureComponent;
  removeComponent: (componentId: string) => void;
  connectComponents: (input: ConnectComponentsInput) => string;
  disconnectComponents: (connectionId: string) => void;
  showComponent: (componentId: string) => void;
  showConnection: (connectionId: string) => void;
  clearSelection: () => void;
  reporter?: WebMcpMutationReporter;
};

type MutationResult<T> = {
  mutation: T;
  architectureRevision: number;
  analysisStatus: 'stale';
  constraintPolicy: 'soft-goals-evaluated-after-mutation';
};

const mutationAnnotations: WebMCP.ToolAnnotations = {
  readOnlyHint: false,
  // Every mutation echoes names, IDs, protocols or configuration from user data.
  untrustedContentHint: true,
};

function assertEditMode(isEditModeEnabled: () => boolean): void {
  if (!isEditModeEnabled()) {
    throw new WebMcpExecutionError(
      'EDIT_MODE_DISABLED',
      'Agent editing is disabled. Ask the human to enable Agent Edit Mode.',
    );
  }
}

function componentSummary(component: ArchitectureComponent) {
  return {
    id: component.id,
    kind: component.kind,
    name: component.name,
    service: component.service,
    region: component.region,
    availabilityZones: component.availabilityZones,
    replicas: component.replicas,
    critical: component.critical,
    locked: component.locked,
    configuration: component.configuration,
  };
}

function connectionSummary(connection: ArchitectureConnection) {
  return {
    id: connection.id,
    sourceComponentId: connection.source,
    targetComponentId: connection.target,
    type: connection.type,
    protocol: connection.protocol,
    encrypted: connection.encrypted,
  };
}

function mutationResult<T>(
  dependencies: WebMcpMutationToolDependencies,
  mutation: T,
): MutationResult<T> {
  return {
    mutation,
    architectureRevision: dependencies.getArchitecture().revision,
    analysisStatus: 'stale',
    constraintPolicy: 'soft-goals-evaluated-after-mutation',
  };
}

function createMutationTool<TInput extends Record<string, unknown>, TOutput>(
  name: WebMcpMutationToolName,
  title: string,
  description: string,
  inputSchema: object,
  parser: z.ZodType<TInput>,
  handler: (input: TInput) => TOutput,
  dependencies: WebMcpMutationToolDependencies,
): WebMCP.ModelContextTool {
  return {
    name,
    title,
    description,
    inputSchema,
    annotations: mutationAnnotations,
    execute: async (input, options) => {
      try {
        assertEditMode(dependencies.isEditModeEnabled);
        if (options?.signal?.aborted) {
          throw options.signal.reason;
        }
        assertSafeToolInput(input);
        const data = parser.parse(input);
        dependencies.reporter?.invocation(name, data);

        // Yield once so a human disabling Edit Mode during an in-flight call
        // wins before the synchronous domain mutation begins.
        await Promise.resolve();
        assertEditMode(dependencies.isEditModeEnabled);
        if (options?.signal?.aborted) {
          throw options.signal.reason;
        }

        const result: WebMcpToolResult<TOutput> = {
          ok: true,
          data: handler(data),
        };
        dependencies.reporter?.result(name, result);
        return result;
      } catch (error) {
        const translated = toWebMcpToolError(error, options?.signal);
        const result: WebMcpToolResult<TOutput> = {
          ok: false,
          error: translated,
        };
        dependencies.reporter?.error(name, translated);
        return result;
      }
    },
  };
}

export function createWebMcpMutationTools(
  dependencies: WebMcpMutationToolDependencies,
): readonly WebMCP.ModelContextTool[] {
  return [
    createMutationTool<AddComponentToolInput, MutationResult<object>>(
      'add_component',
      'Add component',
      'Add a catalog component using safe architecture fields and automatic canvas placement. Human locks and constraints cannot be changed.',
      addComponentInputJsonSchema,
      addComponentInputSchema,
      (input) => {
        const architecture = dependencies.getArchitecture();
        const configuration = parseConfigurationPatch(
          input.kind,
          input.configuration,
        );
        const component = dependencies.addComponent({
          ...input,
          configuration,
          position: nextAutomaticPosition(architecture),
        } as AddComponentInput);
        dependencies.showComponent(component.id);
        return mutationResult(dependencies, {
          action: 'component-added',
          component: componentSummary(component),
        });
      },
      dependencies,
    ),
    createMutationTool<UpdateComponentToolInput, MutationResult<object>>(
      'update_component',
      'Update component',
      'Update only safe architecture-domain fields. Locked components are protected and lock state is human-only.',
      updateComponentInputJsonSchema,
      updateComponentInputSchema,
      ({ componentId, changes }) => {
        const component = dependencies
          .getArchitecture()
          .components.find((candidate) => candidate.id === componentId);
        if (!component) {
          throw new ArchitectureDomainError(
            'COMPONENT_NOT_FOUND',
            `Component not found: ${componentId}`,
            { componentId },
          );
        }
        const configuration = parseConfigurationPatch(
          component.kind,
          changes.configuration,
          componentId,
        );
        const updated = dependencies.updateComponent(componentId, {
          ...changes,
          configuration,
        });
        dependencies.showComponent(updated.id);
        return mutationResult(dependencies, {
          action: 'component-updated',
          component: componentSummary(updated),
        });
      },
      dependencies,
    ),
    createMutationTool<RemoveComponentToolInput, MutationResult<object>>(
      'remove_component',
      'Remove component',
      'Remove an unlocked component and its connected edges. Locked components are protected.',
      removeComponentInputJsonSchema,
      removeComponentInputSchema,
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
        const removedConnectionCount = architecture.connections.filter(
          (connection) =>
            connection.source === componentId ||
            connection.target === componentId,
        ).length;
        dependencies.removeComponent(componentId);
        dependencies.clearSelection();
        return mutationResult(dependencies, {
          action: 'component-removed',
          componentId,
          componentName: component.name,
          removedConnectionCount,
        });
      },
      dependencies,
    ),
    createMutationTool<ConnectComponentsToolInput, MutationResult<object>>(
      'connect_components',
      'Connect components',
      'Create a validated typed connection between two architecture components.',
      connectComponentsInputJsonSchema,
      connectComponentsInputSchema,
      ({ sourceComponentId, targetComponentId, ...connection }) => {
        const connectionId = dependencies.connectComponents({
          source: sourceComponentId,
          target: targetComponentId,
          ...connection,
        });
        const created = dependencies
          .getArchitecture()
          .connections.find((candidate) => candidate.id === connectionId);
        if (!created) {
          throw new ArchitectureDomainError(
            'EDGE_NOT_FOUND',
            `Connection not found after creation: ${connectionId}`,
            { edgeId: connectionId },
          );
        }
        dependencies.showConnection(connectionId);
        return mutationResult(dependencies, {
          action: 'components-connected',
          connection: connectionSummary(created),
        });
      },
      dependencies,
    ),
    createMutationTool<DisconnectComponentsToolInput, MutationResult<object>>(
      'disconnect_components',
      'Disconnect components',
      'Remove one architecture connection by ID.',
      disconnectComponentsInputJsonSchema,
      disconnectComponentsInputSchema,
      ({ connectionId }) => {
        const connection = dependencies
          .getArchitecture()
          .connections.find((candidate) => candidate.id === connectionId);
        if (!connection) {
          throw new ArchitectureDomainError(
            'EDGE_NOT_FOUND',
            `Connection not found: ${connectionId}`,
            { edgeId: connectionId },
          );
        }
        dependencies.disconnectComponents(connectionId);
        dependencies.clearSelection();
        return mutationResult(dependencies, {
          action: 'components-disconnected',
          connection: connectionSummary(connection),
        });
      },
      dependencies,
    ),
  ];
}
