import type { Edge, Node } from '@xyflow/react';

import type {
  ArchitectureComponent,
  ArchitectureConnection,
} from '../../architecture/model';

export type SimulationVisualState = 'normal' | 'failed' | 'degraded';

export type ArchitectureNodeData = {
  component: ArchitectureComponent;
  simulationState: SimulationVisualState;
};

export type ArchitectureFlowNode = Node<
  ArchitectureNodeData,
  'architecture-component'
>;

export type ArchitectureEdgeData = {
  connection: ArchitectureConnection;
  impacted: boolean;
};

export type ArchitectureFlowEdge = Edge<
  ArchitectureEdgeData,
  'architecture-connection'
>;
