import { create, type StoreApi } from 'zustand';

import {
  analyzeArchitecture,
  type AnalyzeArchitectureOptions,
  type ArchitectureAnalysis,
} from '../architecture/analysis';
import {
  simulateFailure,
  type FailureSimulationInput,
  type FailureSimulationResult,
} from '../architecture/simulation';
import {
  useArchitectureStore,
  type ArchitectureStore,
} from './architecture-store';

type ArchitectureStateSource = Pick<
  StoreApi<ArchitectureStore>,
  'getState' | 'subscribe'
>;

export type IntelligenceStore = {
  analysis: ArchitectureAnalysis | null;
  analysisError: string | null;
  analysisRevision: number | null;
  analysisStale: boolean;
  simulation: FailureSimulationResult | null;
  simulationRevision: number | null;
  runAnalysis: (options?: AnalyzeArchitectureOptions) => ArchitectureAnalysis;
  clearAnalysis: () => void;
  runSimulation: (input: FailureSimulationInput) => FailureSimulationResult;
  clearSimulation: () => void;
  dispose: () => void;
};

export function createIntelligenceStore(
  architectureSource: ArchitectureStateSource = useArchitectureStore,
  analyze: typeof analyzeArchitecture = analyzeArchitecture,
) {
  const initialArchitecture = architectureSource.getState().architecture;
  let initialAnalysis: ArchitectureAnalysis | null = null;
  let initialError: string | null = null;
  try {
    initialAnalysis = analyze(initialArchitecture);
  } catch {
    initialError =
      'Analysis could not complete. Your architecture is still available; retry analysis.';
  }
  let unsubscribeFromArchitecture: () => void = () => undefined;

  const useStore = create<IntelligenceStore>((set) => ({
    analysis: initialAnalysis,
    analysisError: initialError,
    analysisRevision: initialAnalysis ? initialArchitecture.revision : null,
    analysisStale: false,
    simulation: null,
    simulationRevision: null,

    runAnalysis: (options) => {
      const architecture = architectureSource.getState().architecture;
      try {
        const analysis = analyze(architecture, options);
        set({
          analysis,
          analysisError: null,
          analysisRevision: architecture.revision,
          analysisStale: false,
        });
        return analysis;
      } catch (error) {
        set((state) => ({
          analysisError:
            'Analysis could not complete. Your architecture is still available; retry analysis.',
          analysisStale: state.analysis !== null,
        }));
        throw error;
      }
    },

    clearAnalysis: () => {
      set({
        analysis: null,
        analysisError: null,
        analysisRevision: null,
        analysisStale: false,
      });
    },

    runSimulation: (input) => {
      const architecture = architectureSource.getState().architecture;
      try {
        const simulation = simulateFailure(architecture, input);
        set({ simulation, simulationRevision: architecture.revision });
        return simulation;
      } catch (error) {
        set({ simulation: null, simulationRevision: null });
        throw error;
      }
    },

    clearSimulation: () => {
      set({ simulation: null, simulationRevision: null });
    },

    dispose: () => {
      unsubscribeFromArchitecture();
    },
  }));

  let previousArchitecture = initialArchitecture;
  unsubscribeFromArchitecture = architectureSource.subscribe((state) => {
    if (state.architecture === previousArchitecture) {
      return;
    }

    previousArchitecture = state.architecture;
    useStore.setState((intelligence) => ({
      analysisStale: intelligence.analysis !== null,
      simulation: null,
      simulationRevision: null,
    }));
  });

  return useStore;
}

export const useIntelligenceStore = createIntelligenceStore();
