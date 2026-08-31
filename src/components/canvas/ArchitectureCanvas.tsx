import { networkLayout } from '../../architecture/network/layout';
import {
  attachmentOnlyKinds,
  boundaryKinds,
  componentSubnets,
  effectiveZones,
  referencedComponentIds,
} from '../../architecture/network/structure';
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  type Connection,
  type EdgeMouseHandler,
  type NodeMouseHandler,
  type OnNodeDrag,
} from '@xyflow/react';
import {
  Boxes,
  CircleX,
  Grid3X3,
  MousePointer2,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from 'react';

import { componentKinds } from '../../architecture/catalog';
import {
  architectureConnectionSchema,
  type ComponentKind,
  type ConnectionType,
} from '../../architecture/model';
import { useArchitectureStore } from '../../stores/architecture-store';
import { useIntelligenceStore } from '../../stores/intelligence-store';
import { useThemeStore } from '../../stores/theme-store';
import { useWorkspaceUiStore } from '../../stores/workspace-ui-store';
import { runWorkspaceAction } from '../layout/workspace-actions';
import { protocolLabel } from '../service-labels';
import { ArchitectureEdge } from './ArchitectureEdge';
import { ArchitectureNode } from './ArchitectureNode';
import { getComponentVisual } from './component-visuals';
import type { ArchitectureFlowEdge, ArchitectureFlowNode } from './flow-types';

export const COMPONENT_DRAG_TYPE = 'application/aethersketch-component';

const nodeTypes = { 'architecture-component': ArchitectureNode };
const edgeTypes = { 'architecture-connection': ArchitectureEdge };
const deleteKeys = ['Backspace', 'Delete'];
const snapGrid: [number, number] = [16, 16];
const initialFitViewOptions = {
  padding: { top: '88px', right: '32px', bottom: '104px', left: '32px' },
  maxZoom: 1,
} as const;
const defaultEdgeOptions = { type: 'architecture-connection' as const };

const connectionColors: Record<
  'dark' | 'light',
  Record<ConnectionType, string>
> = {
  dark: {
    request: '#38bdf8',
    async: '#fbbf24',
    data: '#34d399',
    replication: '#a78bfa',
    trigger: '#f472b6',
    management: '#94a3b8',
  },
  light: {
    request: '#0284c7',
    async: '#b45309',
    data: '#059669',
    replication: '#7c3aed',
    trigger: '#be185d',
    management: '#475569',
  },
};

function ArchitectureCanvasInner() {
  const nodesInitialized = useNodesInitialized();
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
  const theme = useThemeStore((state) => state.theme);
  const catalogDescriptionMode = useWorkspaceUiStore(
    (state) => state.catalogDescriptionMode,
  );
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
  const {
    screenToFlowPosition,
    fitView,
    getNode,
    setNodes: setFlowNodes,
  } = useReactFlow<ArchitectureFlowNode, ArchitectureFlowEdge>();
  const draggingRef = useRef(false);
  const appliedFocusRequestRef = useRef(0);

  const projectedNodes = useMemo<ArchitectureFlowNode[]>(() => {
    const layout = networkLayout(architecture);
    return [...architecture.components]
      .sort(
        (a, b) =>
          Number(boundaryKinds.has(b.kind)) - Number(boundaryKinds.has(a.kind)),
      )
      .map((component) => {
        const failed = simulation?.failedComponentIds.includes(component.id);
        const degraded = simulation?.degradedComponentIds.includes(
          component.id,
        );
        const visual = getComponentVisual(component.kind);

        return {
          id: component.id,
          type: 'architecture-component',
          position: boundaryKinds.has(component.kind)
            ? { x: layout.get(component.id)!.x, y: layout.get(component.id)!.y }
            : component.position,
          style: boundaryKinds.has(component.kind)
            ? {
                width: layout.get(component.id)!.width,
                height: layout.get(component.id)!.height,
              }
            : undefined,
          zIndex:
            component.kind === 'virtual-network'
              ? -20
              : component.kind === 'subnet'
                ? -10
                : 0,
          draggable: !boundaryKinds.has(component.kind),
          connectable: !attachmentOnlyKinds.has(component.kind),
          selected: component.id === selectedComponentId,
          deletable: !component.locked,
          data: {
            component: {
              ...component,
              availabilityZones: effectiveZones(architecture, component),
            },
            boundary: boundaryKinds.has(component.kind),
            membershipNames: componentSubnets(architecture, component).map(
              (subnet) => subnet.name,
            ),
            simulationState: failed
              ? 'failed'
              : degraded
                ? 'degraded'
                : 'normal',
          },
          ariaLabel: `${component.name}, ${visual.label} component`,
        };
      });
  }, [architecture, selectedComponentId, simulation]);
  const [initialNodes] = useState(projectedNodes);

  useEffect(() => {
    if (!draggingRef.current) {
      setFlowNodes(projectedNodes);
    }
  }, [projectedNodes, setFlowNodes]);

  useEffect(() => {
    if (architecture.revision !== 0) return;
    const frame = window.requestAnimationFrame(() => {
      void fitView(initialFitViewOptions);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [architecture, fitView]);

  const edges = useMemo<ArchitectureFlowEdge[]>(
    () =>
      architecture.connections.map((connection) => {
        const impacted =
          simulation?.impactedEdgeIds.includes(connection.id) ?? false;
        const failed =
          simulation?.failedComponentIds.includes(connection.source) ||
          simulation?.failedComponentIds.includes(connection.target);
        const degraded =
          simulation?.degradedComponentIds.includes(connection.source) ||
          simulation?.degradedComponentIds.includes(connection.target);
        return {
          id: connection.id,
          type: 'architecture-connection',
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourcePort ?? 'right',
          targetHandle: connection.targetPort ?? 'left',
          selected: connection.id === selectedConnectionId,
          animated: connection.type === 'async' && !impacted,
          data: {
            connection,
            impacted,
            impactState: failed ? 'failed' : degraded ? 'degraded' : 'normal',
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: impacted
              ? failed
                ? theme === 'dark'
                  ? '#fb7185'
                  : '#e11d48'
                : theme === 'dark'
                  ? '#fbbf24'
                  : '#b45309'
              : connectionColors[theme][connection.type],
            width: 14,
            height: 14,
          },
          ariaLabel: `${connection.type} connection${connection.protocol ? ` using ${protocolLabel(connection.protocol, catalogDescriptionMode)}` : ''}`,
        };
      }),
    [
      architecture.connections,
      selectedConnectionId,
      simulation,
      theme,
      catalogDescriptionMode,
    ],
  );

  useEffect(() => {
    if (
      !nodesInitialized ||
      !selectedComponentId ||
      focusRequest === 0 ||
      focusRequest === appliedFocusRequestRef.current
    ) {
      return;
    }
    const node = getNode(selectedComponentId);
    if (node) {
      appliedFocusRequestRef.current = focusRequest;
      void fitView({
        nodes: [node],
        padding: 0.35,
        duration: 400,
        maxZoom: 1.15,
      });
    }
  }, [fitView, focusRequest, getNode, nodesInitialized, selectedComponentId]);

  const handleNodeClick: NodeMouseHandler<ArchitectureFlowNode> = useCallback(
    (_event, node) => {
      selectComponent(node.id);
      setActivePanel('inspector');
    },
    [selectComponent, setActivePanel],
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
          sourcePort: architectureConnectionSchema.shape.sourcePort.parse(
            connection.sourceHandle ?? undefined,
          ),
          targetPort: architectureConnectionSchema.shape.targetPort.parse(
            connection.targetHandle ?? undefined,
          ),
          type: 'request',
          protocol: 'HTTPS',
          encrypted: true,
        });
        // Let XYFlow finish cancelling the active gesture before changing its
        // controlled selection. Selecting synchronously can invalidate the
        // connection overlay while its pointer-up cleanup is still running.
        window.requestAnimationFrame(() => {
          selectConnection(connectionId);
          setActivePanel('inspector');
        });
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
      runWorkspaceAction(() => {
        const component = addComponent({
          kind: kind as ComponentKind,
          position,
        });
        selectComponent(component.id);
        setActivePanel('inspector');
      }, 'The component could not be added.');
    },
    [addComponent, screenToFlowPosition, selectComponent, setActivePanel],
  );

  const handleEdgeClick: EdgeMouseHandler<ArchitectureFlowEdge> = useCallback(
    (_event, edge) => {
      selectConnection(edge.id);
      setActivePanel('inspector');
    },
    [selectConnection, setActivePanel],
  );

  const handleNodeDragStart = useCallback(() => {
    draggingRef.current = true;
  }, []);

  const handleNodeDragStop: OnNodeDrag<ArchitectureFlowNode> = useCallback(
    (_event, node) => {
      draggingRef.current = false;
      if (
        !runWorkspaceAction(
          () => moveComponent(node.id, node.position),
          'The component could not be moved.',
        )
      ) {
        setFlowNodes(projectedNodes);
      }
    },
    [moveComponent, projectedNodes, setFlowNodes],
  );

  const handleEdgesDelete = useCallback(
    (deletedEdges: ArchitectureFlowEdge[]) => {
      deletedEdges.forEach((edge) => {
        // Node removal may already have removed the incident edge.
        if (
          useArchitectureStore
            .getState()
            .architecture.connections.some((item) => item.id === edge.id)
        ) {
          runWorkspaceAction(
            () => disconnectComponents(edge.id),
            'The connection could not be deleted.',
          );
        }
      });
      clearSelection();
    },
    [clearSelection, disconnectComponents],
  );

  const handleNodesDelete = useCallback(
    (deletedNodes: ArchitectureFlowNode[]) => {
      deletedNodes.forEach((node) =>
        runWorkspaceAction(
          () => removeComponent(node.id),
          'The component could not be deleted.',
        ),
      );
      clearSelection();
    },
    [clearSelection, removeComponent],
  );

  const handleCanvasKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    // XYFlow's default keyboard state is internal; commit through the same IR as pointer edits.
    const nodeId = target.matches('.react-flow__node')
      ? target.getAttribute('data-id')
      : undefined;
    const edgeId = target.matches('.react-flow__edge')
      ? target.getAttribute('data-id')
      : undefined;
    if (!nodeId && !edgeId) return;
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') clearSelection();
      else {
        if (nodeId) selectComponent(nodeId);
        else if (edgeId) selectConnection(edgeId);
        setActivePanel('inspector');
      }
      return;
    }
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const direction = directions[event.key];
    if (!nodeId || !direction || selectedComponentId !== nodeId) return;
    event.preventDefault();
    event.stopPropagation();
    const component = useArchitectureStore
      .getState()
      .architecture.components.find((item) => item.id === nodeId);
    if (!component || boundaryKinds.has(component.kind)) return;
    const step = event.shiftKey ? 64 : 16;
    runWorkspaceAction(
      () =>
        moveComponent(nodeId, {
          x: component.position.x + direction[0] * step,
          y: component.position.y + direction[1] * step,
        }),
      'The component could not be moved.',
    );
  };

  return (
    <section
      className="relative flex h-full min-h-0 flex-col overflow-hidden"
      aria-labelledby="canvas-title"
    >
      <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-y-1 border-b border-slate-800/80 bg-[#0b0f15]/95 px-3 py-1">
        <MousePointer2
          className="mr-2 size-3.5 text-cyan-400"
          aria-hidden="true"
        />
        <h1
          id="canvas-title"
          className="shrink-0 whitespace-nowrap text-[13px] font-medium text-slate-300"
        >
          Architecture Canvas
        </h1>
        <span className="mx-2 text-slate-700" aria-hidden="true">
          /
        </span>
        <span
          className="min-w-0 truncate text-[12px] text-slate-600"
          title={architecture.name}
        >
          {architecture.name}
        </span>
        <span className="ml-auto shrink-0 whitespace-nowrap pl-3 font-mono text-[11px] text-slate-600">
          {architecture.components.length} nodes ·{' '}
          {architecture.connections.length} edges · rev {architecture.revision}
        </span>
        {simulation ? (
          <span
            className="ml-3 shrink-0 whitespace-nowrap border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-300"
            data-testid="simulation-edge-count"
          >
            <span className="max-[1450px]:sr-only">Simulation active · </span>
            {simulation.impactedEdgeIds.length} impacted edges
          </span>
        ) : null}
      </div>

      <div
        className="relative min-h-0 flex-1"
        onDrop={handleDrop}
        onDragOver={(event) => event.preventDefault()}
      >
        {simulation ? (
          <div
            className={`pointer-events-none absolute left-1/2 top-3 z-20 flex min-w-80 -translate-x-1/2 items-center gap-3 border px-4 py-2.5 shadow-xl backdrop-blur-sm ${
              simulation.status === 'unavailable'
                ? 'border-rose-400/50 bg-rose-950/95'
                : simulation.status === 'degraded'
                  ? 'border-amber-400/45 bg-amber-950/90'
                  : 'border-emerald-400/35 bg-emerald-950/95'
            }`}
            role="status"
            aria-live="polite"
          >
            {simulation.status === 'unavailable' ? (
              <CircleX
                className="size-5 shrink-0 text-rose-300"
                aria-hidden="true"
              />
            ) : simulation.status === 'degraded' ? (
              <TriangleAlert
                className="size-5 shrink-0 text-amber-300"
                aria-hidden="true"
              />
            ) : (
              <ShieldCheck
                className="size-5 shrink-0 text-emerald-300"
                aria-hidden="true"
              />
            )}
            <div>
              <p className="text-base font-bold text-slate-100">
                {simulation.status === 'unavailable'
                  ? 'System is unavailable'
                  : `System remains ${simulation.status}`}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {simulation.target} failure ·{' '}
                {simulation.failedComponentIds.length} failed ·{' '}
                {simulation.degradedComponentIds.length} degraded
              </p>
            </div>
          </div>
        ) : null}

        <ReactFlow<ArchitectureFlowNode, ArchitectureFlowEdge>
          defaultNodes={initialNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onNodeDragStart={handleNodeDragStart}
          onNodeDragStop={handleNodeDragStop}
          onEdgesDelete={handleEdgesDelete}
          onNodesDelete={handleNodesDelete}
          onKeyDownCapture={handleCanvasKeyDown}
          onBeforeDelete={({ nodes }) => {
            const graph = useArchitectureStore.getState().architecture;
            const blocked = nodes.find((node) =>
              graph.components.some(
                (component) =>
                  component.id !== node.id &&
                  referencedComponentIds(component).includes(node.id),
              ),
            );
            if (!blocked) return Promise.resolve(true);
            setNotice({
              kind: 'error',
              message:
                'Detach dependent network references before deleting this component. Nothing was deleted.',
            });
            return Promise.resolve(false);
          }}
          onConnect={handleConnect}
          connectionMode={ConnectionMode.Loose}
          onPaneClick={clearSelection}
          deleteKeyCode={deleteKeys}
          selectionKeyCode="Shift"
          multiSelectionKeyCode="Shift"
          fitView
          fitViewOptions={initialFitViewOptions}
          minZoom={0.25}
          maxZoom={1.8}
          elevateNodesOnSelect={false}
          snapToGrid
          snapGrid={snapGrid}
          colorMode={theme}
          defaultEdgeOptions={defaultEdgeOptions}
          aria-label="Interactive architecture diagram"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={16}
            size={1}
            color={theme === 'dark' ? '#273448' : '#cbd5e1'}
          />
          <Controls
            position="bottom-left"
            showInteractive={false}
            fitViewOptions={initialFitViewOptions}
            aria-label="Canvas zoom and fit controls"
          />
          <MiniMap
            style={{ width: 128, height: 88 }}
            position="bottom-right"
            pannable
            zoomable
            nodeColor={(node) => {
              const component = (node as ArchitectureFlowNode).data.component;
              return getComponentVisual(component.kind).accent;
            }}
            maskColor={
              theme === 'dark'
                ? 'rgba(4, 7, 11, 0.72)'
                : 'rgba(226, 232, 240, 0.72)'
            }
            bgColor={theme === 'dark' ? '#0b0f15' : '#f8fafc'}
            aria-label="Architecture minimap"
          />

          {architecture.components.length === 0 ? (
            <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
              <div className="border border-dashed border-slate-700 bg-[#0b0f15]/90 px-8 py-7 text-center shadow-xl">
                <Boxes
                  className="mx-auto size-5 text-cyan-400"
                  aria-hidden="true"
                />
                <p className="mt-3 text-xs font-medium text-slate-300">
                  Blank architecture
                </p>
                <p className="mt-1 text-[12px] text-slate-600">
                  Click a catalog component or drag it onto the canvas.
                </p>
              </div>
            </div>
          ) : null}
        </ReactFlow>

        <div className="pointer-events-none absolute bottom-3 left-12 z-10 flex h-7 items-center gap-2 border border-slate-800/80 bg-[#0b0f15]/90 px-2 text-[11px] text-slate-600">
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
