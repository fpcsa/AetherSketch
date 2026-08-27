import { create } from 'zustand';

export type WebMcpLifecycleStatus =
  'unavailable' | 'initializing' | 'ready' | 'error';
export type AgentAuthorityMode = 'review' | 'edit';
export type EditToolRegistrationStatus =
  'disabled' | 'initializing' | 'ready' | 'error';

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
  mode: AgentAuthorityMode;
  editRegistrationStatus: EditToolRegistrationStatus;
  readTools: string[];
  editTools: string[];
  registeredTools: string[];
  registrationError: string | null;
  editRegistrationError: string | null;
  lastInvocation: InvocationRecord | null;
  lastResult: OutcomeRecord | null;
  lastError: OutcomeRecord | null;
  markUnavailable: () => void;
  markInitializing: () => void;
  markReadReady: (toolNames: readonly string[]) => void;
  markRegistrationError: (message: string) => void;
  enableAgentEditing: () => void;
  disableAgentEditing: () => void;
  markEditInitializing: () => void;
  markEditReady: (toolNames: readonly string[]) => void;
  markEditRegistrationError: (message: string) => void;
  recordInvocation: (toolName: string, input: unknown) => void;
  recordResult: (toolName: string, value: unknown) => void;
  recordError: (toolName: string, value: unknown) => void;
  reset: () => void;
};

const initialState = {
  status: 'unavailable' as const,
  mode: 'review' as const,
  editRegistrationStatus: 'disabled' as const,
  readTools: [] as string[],
  editTools: [] as string[],
  registeredTools: [] as string[],
  registrationError: null,
  editRegistrationError: null,
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
      mode: 'review',
      editRegistrationStatus: 'disabled',
      readTools: [],
      editTools: [],
      registeredTools: [],
      registrationError: null,
      editRegistrationError: null,
    }),
  markReadReady: (readTools) =>
    set({
      status: 'ready',
      readTools: [...readTools],
      registeredTools: [...readTools],
      registrationError: null,
    }),
  markRegistrationError: (registrationError) =>
    set({
      status: 'error',
      mode: 'review',
      editRegistrationStatus: 'disabled',
      readTools: [],
      editTools: [],
      registeredTools: [],
      registrationError,
    }),
  enableAgentEditing: () =>
    set((state) =>
      state.status === 'ready'
        ? {
            mode: 'edit',
            editRegistrationStatus: 'initializing',
            editTools: [],
            registeredTools: [...state.readTools],
            editRegistrationError: null,
          }
        : state,
    ),
  disableAgentEditing: () =>
    set((state) => ({
      mode: 'review',
      editRegistrationStatus: 'disabled',
      editTools: [],
      registeredTools: [...state.readTools],
      editRegistrationError: null,
    })),
  markEditInitializing: () =>
    set((state) => ({
      editRegistrationStatus: 'initializing',
      editTools: [],
      registeredTools: [...state.readTools],
      editRegistrationError: null,
    })),
  markEditReady: (editTools) =>
    set((state) => ({
      editRegistrationStatus: 'ready',
      editTools: [...editTools],
      registeredTools: [...state.readTools, ...editTools],
      editRegistrationError: null,
    })),
  markEditRegistrationError: (editRegistrationError) =>
    set((state) => ({
      editRegistrationStatus: 'error',
      editTools: [],
      registeredTools: [...state.readTools],
      editRegistrationError,
    })),
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
