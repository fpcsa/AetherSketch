import { useEffect } from 'react';

import { useArchitectureStore } from '../../stores/architecture-store';
import { useIntelligenceStore } from '../../stores/intelligence-store';
import { useWorkspaceUiStore } from '../../stores/workspace-ui-store';
import { createWebMcpReadTools } from '../tools/read-tools';
import { createWebMcpMutationTools } from '../tools/mutation-tools';
import { useWebMcpStore } from '../webmcp-store';
import { getDocumentModelContext } from './model-context';
import {
  registerWebMcpReadTools,
  registerWebMcpTools,
} from './register-read-tools';

export function WebMcpRuntime() {
  const status = useWebMcpStore((state) => state.status);
  const mode = useWebMcpStore((state) => state.mode);

  useEffect(() => {
    const webMcpState = useWebMcpStore.getState();
    const context = getDocumentModelContext();
    if (!context) {
      webMcpState.markUnavailable();
      return;
    }

    webMcpState.markInitializing();
    const controller = new AbortController();
    let cancelled = false;
    const tools = createWebMcpReadTools({
      getArchitecture: () => useArchitectureStore.getState().architecture,
      getAnalysisSnapshot: () => {
        const intelligence = useIntelligenceStore.getState();
        return {
          analysis: intelligence.analysis,
          stale: intelligence.analysisStale,
        };
      },
      runAnalysis: (options) =>
        useIntelligenceStore.getState().runAnalysis(options),
      runSimulation: (input) =>
        useIntelligenceStore.getState().runSimulation(input),
      showAnalysis: () =>
        useWorkspaceUiStore.getState().setActivePanel('analysis'),
      showSimulation: () =>
        useWorkspaceUiStore.getState().setActivePanel('simulation'),
      reporter: {
        invocation: (toolName, input) =>
          useWebMcpStore.getState().recordInvocation(toolName, input),
        result: (toolName, result) =>
          useWebMcpStore.getState().recordResult(toolName, result),
        error: (toolName, error) =>
          useWebMcpStore.getState().recordError(toolName, error),
      },
    });

    void registerWebMcpReadTools(context, tools, controller)
      .then((registration) => {
        if (cancelled) {
          registration.dispose();
          return;
        }
        useWebMcpStore.getState().markReadReady(registration.toolNames);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          useWebMcpStore
            .getState()
            .markRegistrationError(
              error instanceof Error ? error.message : 'Registration failed.',
            );
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (status !== 'ready' || mode !== 'edit') {
      return;
    }

    const context = getDocumentModelContext();
    if (!context) {
      useWebMcpStore.getState().disableAgentEditing();
      return;
    }

    useWebMcpStore.getState().markEditInitializing();
    const controller = new AbortController();
    let cancelled = false;
    const tools = createWebMcpMutationTools({
      isEditModeEnabled: () => useWebMcpStore.getState().mode === 'edit',
      getArchitecture: () => useArchitectureStore.getState().architecture,
      addComponent: (input) =>
        useArchitectureStore.getState().addComponent(input, 'agent'),
      updateComponent: (componentId, changes) =>
        useArchitectureStore
          .getState()
          .updateComponent(componentId, changes, 'agent'),
      removeComponent: (componentId) =>
        useArchitectureStore.getState().removeComponent(componentId, 'agent'),
      connectComponents: (input) =>
        useArchitectureStore.getState().connectComponents(input, 'agent'),
      disconnectComponents: (connectionId) =>
        useArchitectureStore
          .getState()
          .disconnectComponents(connectionId, 'agent'),
      showComponent: (componentId) =>
        useWorkspaceUiStore.getState().focusComponent(componentId),
      showConnection: (connectionId) =>
        useWorkspaceUiStore.getState().selectConnection(connectionId),
      clearSelection: () => useWorkspaceUiStore.getState().clearSelection(),
      reporter: {
        invocation: (toolName, input) =>
          useWebMcpStore.getState().recordInvocation(toolName, input),
        result: (toolName, result) =>
          useWebMcpStore.getState().recordResult(toolName, result),
        error: (toolName, error) =>
          useWebMcpStore.getState().recordError(toolName, error),
      },
    });

    void registerWebMcpTools(context, tools, controller)
      .then((registration) => {
        if (cancelled || useWebMcpStore.getState().mode !== 'edit') {
          registration.dispose();
          return;
        }
        useWebMcpStore.getState().markEditReady(registration.toolNames);
      })
      .catch((error: unknown) => {
        if (!cancelled && useWebMcpStore.getState().mode === 'edit') {
          useWebMcpStore
            .getState()
            .markEditRegistrationError(
              error instanceof Error
                ? error.message
                : 'Edit-tool registration failed.',
            );
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [mode, status]);

  return null;
}
