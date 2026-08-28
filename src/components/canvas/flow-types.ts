import type { Edge, Node } from '@xyflow/react';

import type {
  ArchitectureComponent,
  ArchitectureConnection,
} from '../../architecture/model';

export type SimulationVisualState = 'normal' | 'failed' | 'degraded';

export type ArchitectureNodeData = {
  component: ArchitectureComponent;
  boundary?: boolean;
  membershipNames?: string[];
  simulationState: SimulationVisualState;
};

export type ArchitectureFlowNode = Node<
  ArchitectureNodeData,
  'architecture-component'
>;

export type ArchitectureEdgeData = {
  connection: ArchitectureConnection;
  impacted: boolean;
  impactState: SimulationVisualState;
};

export type ArchitectureFlowEdge = Edge<
  ArchitectureEdgeData,
  'architecture-connection'
>;
