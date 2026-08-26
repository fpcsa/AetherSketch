import { create, type StoreApi } from 'zustand';

import {
  analyzeArchitecture,
  type AnalyzeArchitectureOptions,
  type ArchitectureAnalysis,
} from '../architecture/analysis';
import type { Architecture } from '../architecture/model';
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

function analyzeCurrentArchitecture(
  architecture: Architecture,
): ArchitectureAnalysis {
  return analyzeArchitecture(architecture);
}

export function createIntelligenceStore(
  architectureSource: ArchitectureStateSource = useArchitectureStore,
) {
  const initialArchitecture = architectureSource.getState().architecture;
  const initialAnalysis = analyzeCurrentArchitecture(initialArchitecture);
  let unsubscribeFromArchitecture: () => void = () => undefined;

  const useStore = create<IntelligenceStore>((set) => ({
    analysis: initialAnalysis,
    analysisRevision: initialArchitecture.revision,
    analysisStale: false,
    simulation: null,
    simulationRevision: null,

    runAnalysis: (options) => {
      const architecture = architectureSource.getState().architecture;
      const analysis = analyzeArchitecture(architecture, options);
      set({
        analysis,
        analysisRevision: architecture.revision,
        analysisStale: false,
      });
      return analysis;
    },

    clearAnalysis: () => {
      set({ analysis: null, analysisRevision: null, analysisStale: false });
    },

    runSimulation: (input) => {
      const architecture = architectureSource.getState().architecture;
      const simulation = simulateFailure(architecture, input);
      set({ simulation, simulationRevision: architecture.revision });
      return simulation;
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
