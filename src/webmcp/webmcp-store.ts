import { create } from 'zustand';

export type WebMcpLifecycleStatus =
  'unavailable' | 'initializing' | 'ready' | 'error';

type InvocationRecord = {
  toolName: string;
  timestamp: string;
  input: unknown;
};

type OutcomeRecord = {
  toolName: string;
  timestamp: string;
  value: unknown;
};

type WebMcpState = {
  status: WebMcpLifecycleStatus;
  mode: 'agent-review';
  registeredTools: string[];
  registrationError: string | null;
  lastInvocation: InvocationRecord | null;
  lastResult: OutcomeRecord | null;
  lastError: OutcomeRecord | null;
  markUnavailable: () => void;
  markInitializing: () => void;
  markReady: (toolNames: readonly string[]) => void;
  markRegistrationError: (message: string) => void;
  recordInvocation: (toolName: string, input: unknown) => void;
  recordResult: (toolName: string, value: unknown) => void;
  recordError: (toolName: string, value: unknown) => void;
  reset: () => void;
};

const initialState = {
  status: 'unavailable' as const,
  mode: 'agent-review' as const,
  registeredTools: [] as string[],
  registrationError: null,
  lastInvocation: null,
  lastResult: null,
  lastError: null,
};

function timestamp(): string {
  return new Date().toISOString();
}

export const useWebMcpStore = create<WebMcpState>((set) => ({
  ...initialState,
  markUnavailable: () => set({ ...initialState }),
  markInitializing: () =>
    set({
      status: 'initializing',
      registeredTools: [],
      registrationError: null,
    }),
  markReady: (registeredTools) =>
    set({
      status: 'ready',
      registeredTools: [...registeredTools],
      registrationError: null,
    }),
  markRegistrationError: (registrationError) =>
    set({ status: 'error', registeredTools: [], registrationError }),
  recordInvocation: (toolName, input) =>
    set({
      lastInvocation: { toolName, timestamp: timestamp(), input },
      lastResult: null,
      lastError: null,
    }),
  recordResult: (toolName, value) =>
    set({
      lastResult: { toolName, timestamp: timestamp(), value },
      lastError: null,
    }),
  recordError: (toolName, value) =>
    set({
      lastError: { toolName, timestamp: timestamp(), value },
      lastResult: null,
    }),
  reset: () => set({ ...initialState }),
}));
