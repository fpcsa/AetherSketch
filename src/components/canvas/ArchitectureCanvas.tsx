import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type NodeChange,
  type NodeMouseHandler,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import { Boxes, Grid3X3, MousePointer2 } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from 'react';

import { componentKinds } from '../../architecture/catalog';
import type { ComponentKind, ConnectionType } from '../../architecture/model';
import { useArchitectureStore } from '../../stores/architecture-store';
import { useIntelligenceStore } from '../../stores/intelligence-store';
import { useWorkspaceUiStore } from '../../stores/workspace-ui-store';
import { ArchitectureEdge } from './ArchitectureEdge';
import { ArchitectureNode } from './ArchitectureNode';
import { getComponentVisual } from './component-visuals';
import type { ArchitectureFlowEdge, ArchitectureFlowNode } from './flow-types';

export const COMPONENT_DRAG_TYPE = 'application/aethersketch-component';

const nodeTypes = { 'architecture-component': ArchitectureNode };
const edgeTypes = { 'architecture-connection': ArchitectureEdge };

const connectionColors: Record<ConnectionType, string> = {
  request: '#38bdf8',
  async: '#fbbf24',
  data: '#34d399',
  replication: '#a78bfa',
  management: '#94a3b8',
};

function ArchitectureCanvasInner() {
  const architecture = useArchitectureStore((state) => state.architecture);
  const addComponent = useArchitectureStore((state) => state.addComponent);
  const moveComponent = useArchitectureStore((state) => state.moveComponent);
  const removeComponent = useArchitectureStore(
    (state) => state.removeComponent,
  );
  const connectComponents = useArchitectureStore(
    (state) => state.connectComponents,
  );
  const disconnectComponents = useArchitectureStore(
    (state) => state.disconnectComponents,
  );
  const simulation = useIntelligenceStore((state) => state.simulation);
  const selectedComponentId = useWorkspaceUiStore(
    (state) => state.selectedComponentId,
  );
  const selectedConnectionId = useWorkspaceUiStore(
    (state) => state.selectedConnectionId,
  );
  const focusRequest = useWorkspaceUiStore((state) => state.focusRequest);
  const selectComponent = useWorkspaceUiStore((state) => state.selectComponent);
  const selectConnection = useWorkspaceUiStore(
    (state) => state.selectConnection,
  );
  const clearSelection = useWorkspaceUiStore((state) => state.clearSelection);
  const setActivePanel = useWorkspaceUiStore((state) => state.setActivePanel);
  const setNotice = useWorkspaceUiStore((state) => state.setNotice);
  const { screenToFlowPosition, fitView, getNode } = useReactFlow<
    ArchitectureFlowNode,
    ArchitectureFlowEdge
  >();
  const draggingRef = useRef(false);

  const projectedNodes = useMemo<ArchitectureFlowNode[]>(
    () =>
      architecture.components.map((component) => {
        const failed = simulation?.failedComponentIds.includes(component.id);
        const degraded = simulation?.degradedComponentIds.includes(
          component.id,
        );
        const visual = getComponentVisual(component.kind);

        return {
          id: component.id,
          type: 'architecture-component',
          position: component.position,
          selected: component.id === selectedComponentId,
          deletable: !component.locked,
          data: {
            component,
            simulationState: failed
              ? 'failed'
              : degraded
                ? 'degraded'
                : 'normal',
          },
          ariaLabel: `${component.name}, ${visual.label} component`,
        };
      }),
    [architecture.components, selectedComponentId, simulation],
  );
  const [nodes, setNodes] = useState(projectedNodes);

  useEffect(() => {
    if (!draggingRef.current) {
      setNodes(projectedNodes);
    }
  }, [projectedNodes]);

  const edges = useMemo<ArchitectureFlowEdge[]>(
    () =>
      architecture.connections.map((connection) => {
        const impacted =
          simulation?.impactedEdgeIds.includes(connection.id) ?? false;
        return {
          id: connection.id,
          type: 'architecture-connection',
          source: connection.source,
          target: connection.target,
          selected: connection.id === selectedConnectionId,
          animated: connection.type === 'async' && !impacted,
          data: { connection, impacted },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: impacted ? '#fb7185' : connectionColors[connection.type],
            width: 14,
            height: 14,
          },
          ariaLabel: `${connection.type} connection${connection.protocol ? ` using ${connection.protocol}` : ''}`,
        };
      }),
    [architecture.connections, selectedConnectionId, simulation],
  );

  useEffect(() => {
    if (!selectedComponentId || focusRequest === 0) {
      return;
    }
    const node = getNode(selectedComponentId);
    if (node) {
      void fitView({
        nodes: [node],
        padding: 1.8,
        duration: 400,
        maxZoom: 1.15,
      });
    }
  }, [fitView, focusRequest, getNode, selectedComponentId]);

  const onNodesChange = useCallback(
    (changes: NodeChange<ArchitectureFlowNode>[]) => {
      setNodes((current) => applyNodeChanges(changes, current));
    },
    [],
  );

  const handleNodeClick: NodeMouseHandler<ArchitectureFlowNode> = useCallback(
    (_event, node) => {
      selectComponent(node.id);
      setActivePanel('inspector');
    },
    [selectComponent, setActivePanel],
  );

  const handleSelectionChange = useCallback(
    ({
      nodes: selectedNodes,
      edges: selectedEdges,
    }: OnSelectionChangeParams<ArchitectureFlowNode, ArchitectureFlowEdge>) => {
      if (selectedNodes[0]) {
        selectComponent(selectedNodes[0].id);
      } else if (selectedEdges[0]) {
        selectConnection(selectedEdges[0].id);
      }
    },
    [selectComponent, selectConnection],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) {
        return;
      }
      try {
        const connectionId = connectComponents({
          source: connection.source,
          target: connection.target,
          type: 'request',
          protocol: 'HTTPS',
          encrypted: true,
        });
        selectConnection(connectionId);
        setActivePanel('inspector');
      } catch (error) {
        setNotice({
          kind: 'error',
          message:
            error instanceof Error ? error.message : 'Connection failed.',
        });
      }
    },
    [connectComponents, selectConnection, setActivePanel, setNotice],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData(COMPONENT_DRAG_TYPE);
      if (!componentKinds.includes(kind as ComponentKind)) {
        return;
      }
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const component = addComponent({
        kind: kind as ComponentKind,
        position,
      });
      selectComponent(component.id);
      setActivePanel('inspector');
    },
    [addComponent, screenToFlowPosition, selectComponent, setActivePanel],
  );

  return (
    <section
      className="relative flex h-full min-h-0 flex-col overflow-hidden"
      aria-labelledby="canvas-title"
    >
      <div className="flex h-10 shrink-0 items-center border-b border-slate-800/80 bg-[#0b0f15]/95 px-3">
        <MousePointer2
          className="mr-2 size-3.5 text-cyan-400"
          aria-hidden="true"
        />
        <h1
          id="canvas-title"
          className="text-[11px] font-medium text-slate-300"
        >
          Architecture Canvas
        </h1>
        <span className="mx-2 text-slate-700" aria-hidden="true">
          /
        </span>
        <span className="truncate text-[10px] text-slate-600">
          {architecture.name}
        </span>
        <span className="ml-auto font-mono text-[9px] text-slate-600">
          {architecture.components.length} nodes ·{' '}
          {architecture.connections.length} edges · rev {architecture.revision}
        </span>
        {simulation ? (
          <span
            className="ml-3 border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-amber-300"
            data-testid="simulation-edge-count"
          >
            Simulation active · {simulation.impactedEdgeIds.length} impacted
            edges
          </span>
        ) : null}
      </div>

      <div
        className="relative min-h-0 flex-1"
        onDrop={handleDrop}
        onDragOver={(event) => event.preventDefault()}
      >
        <ReactFlow<ArchitectureFlowNode, ArchitectureFlowEdge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={handleNodeClick}
          onEdgeClick={(_event, edge) => {
            selectConnection(edge.id);
            setActivePanel('inspector');
          }}
          onNodeDragStart={() => {
            draggingRef.current = true;
          }}
          onNodeDragStop={(_event, node) => {
            draggingRef.current = false;
            moveComponent(node.id, node.position);
          }}
          onEdgesDelete={(deletedEdges) => {
            deletedEdges.forEach((edge) => disconnectComponents(edge.id));
            clearSelection();
          }}
          onNodesDelete={(deletedNodes) => {
            deletedNodes.forEach((node) => removeComponent(node.id));
            clearSelection();
          }}
          onConnect={handleConnect}
          onSelectionChange={handleSelectionChange}
          onPaneClick={clearSelection}
          deleteKeyCode={['Backspace', 'Delete']}
          selectionKeyCode="Shift"
          multiSelectionKeyCode="Shift"
          fitView
          fitViewOptions={{ padding: 0.28, maxZoom: 1 }}
          minZoom={0.25}
          maxZoom={1.8}
          snapToGrid
          snapGrid={[16, 16]}
          proOptions={{ hideAttribution: true }}
          colorMode="dark"
          defaultEdgeOptions={{ type: 'architecture-connection' }}
          aria-label="Interactive architecture diagram"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={16}
            size={1}
            color="#273448"
          />
          <Controls
            position="bottom-left"
            showInteractive={false}
            aria-label="Canvas zoom and fit controls"
          />
          <MiniMap
            position="bottom-right"
            pannable
            zoomable
            nodeColor={(node) => {
              const component = (node as ArchitectureFlowNode).data.component;
              return getComponentVisual(component.kind).accent;
            }}
            maskColor="rgba(4, 7, 11, 0.72)"
            bgColor="#0b0f15"
            aria-label="Architecture minimap"
          />

          {nodes.length === 0 ? (
            <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
              <div className="border border-dashed border-slate-700 bg-[#0b0f15]/90 px-8 py-7 text-center shadow-xl">
                <Boxes
                  className="mx-auto size-5 text-cyan-400"
                  aria-hidden="true"
                />
                <p className="mt-3 text-xs font-medium text-slate-300">
                  Blank architecture
                </p>
                <p className="mt-1 text-[10px] text-slate-600">
                  Click a catalog component or drag it onto the canvas.
                </p>
              </div>
            </div>
          ) : null}
        </ReactFlow>

        <div className="pointer-events-none absolute bottom-3 left-12 z-10 flex h-7 items-center gap-2 border border-slate-800/80 bg-[#0b0f15]/90 px-2 text-[9px] text-slate-600">
          <Grid3X3 className="size-3" aria-hidden="true" />
          Snap 16 px
        </div>
      </div>
    </section>
  );
}

export function ArchitectureCanvas() {
  return (
    <ReactFlowProvider>
      <ArchitectureCanvasInner />
    </ReactFlowProvider>
  );
}
