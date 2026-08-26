import type { ArchitectureFinding } from '../analysis';

export type FailureScope = 'component' | 'availability-zone' | 'region';

export type FailureSimulationInput = {
  scope: FailureScope;
  target: string;
};

export type FailureSimulationStatus =
  'operational' | 'degraded' | 'unavailable';

export type FailureSimulationResult = {
  architectureId: string;
  architectureRevision: number;
  scope: FailureScope;
  target: string;
  failedComponentIds: string[];
  degradedComponentIds: string[];
  impactedEdgeIds: string[];
  survivingComponentIds: string[];
  criticalPathsRemaining: boolean;
  status: FailureSimulationStatus;
  explanation: string;
  findings: ArchitectureFinding[];
};
