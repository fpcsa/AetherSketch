import { useEffect } from 'react';

import { useArchitectureStore } from '../../stores/architecture-store';
import { useIntelligenceStore } from '../../stores/intelligence-store';
import { useWorkspaceUiStore } from '../../stores/workspace-ui-store';
import { createWebMcpReadTools } from '../tools/read-tools';
import { useWebMcpStore } from '../webmcp-store';
import { getDocumentModelContext } from './model-context';
import { registerWebMcpReadTools } from './register-read-tools';

export function WebMcpRuntime() {
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
        useWebMcpStore.getState().markReady(registration.toolNames);
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

  return null;
}
