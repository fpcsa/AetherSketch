import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../src/app/App';
import { CONNECTION_PORTS } from '../../src/architecture/model';
import { ArchitectureCanvas } from '../../src/components/canvas/ArchitectureCanvas';
import { useArchitectureStore } from '../../src/stores/architecture-store';
import { useIntelligenceStore } from '../../src/stores/intelligence-store';
import { useWorkspaceUiStore } from '../../src/stores/workspace-ui-store';
import { useWebMcpStore } from '../../src/webmcp';

// JSDOM has no layout. Supply node/handle geometry while exercising the real
// XYFlow handles, connection gestures, edge renderer, and architecture store.
function mockCanvasLayout() {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(
    function (this: HTMLElement) {
      return this.classList.contains('react-flow__handle') ? 10 : 216;
    },
  );
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(
    function (this: HTMLElement) {
      return this.classList.contains('react-flow__handle') ? 10 : 104;
    },
  );
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      const node = this.closest<HTMLElement>('.react-flow__node');
      const component = useArchitectureStore
        .getState()
        .architecture.components.find(
          (candidate) => candidate.id === node?.dataset.id,
        );
      let x = component?.position.x ?? 0;
      let y = component?.position.y ?? 0;
      let width = node ? 216 : 1200;
      let height = node ? 104 : 800;
      if (this.classList.contains('react-flow__handle')) {
        const port = this.dataset.handleid;
        x += port === 'left' ? -5 : port === 'right' ? 211 : 103;
        y += port === 'top' ? -5 : port === 'bottom' ? 99 : 47;
        width = height = 10;
      }
      return {
        x,
        y,
        width,
        height,
        top: y,
        left: x,
        right: x + width,
        bottom: y + height,
        toJSON: () => ({}),
      };
    },
  );
}

describe('four-sided canvas connections', () => {
  beforeEach(() => {
    useWorkspaceUiStore.setState(useWorkspaceUiStore.getInitialState());
    useIntelligenceStore.getState().clearSimulation();
    useWebMcpStore.getState().reset();
    const state = useArchitectureStore.getState();
    state.createArchitecture({ name: 'Connection ports' });
    state.addComponent({
      id: 'source',
      kind: 'virtual-machine',
      name: 'Source',
      position: { x: 100, y: 80 },
    });
    state.addComponent({
      id: 'target',
      kind: 'container-service',
      name: 'Target',
      position: { x: 400, y: 400 },
    });
    mockCanvasLayout();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it.each(
    CONNECTION_PORTS.flatMap((sourcePort) =>
      CONNECTION_PORTS.map((targetPort) => [sourcePort, targetPort] as const),
    ),
  )(
    'connects %s → %s through the real handles without reversing direction',
    async (sourcePort, targetPort) => {
      render(<ArchitectureCanvas />);
      expect(
        document.querySelectorAll(
          '[data-component-id="source"] .react-flow__handle',
        ),
      ).toHaveLength(4);
      fireEvent.click(
        screen.getByLabelText(`Connect Source via ${sourcePort}`),
      );
      fireEvent.click(
        screen.getByLabelText(`Connect Target via ${targetPort}`),
      );
      await waitFor(() =>
        expect(
          useArchitectureStore.getState().architecture.connections,
        ).toHaveLength(1),
      );
      const connection =
        useArchitectureStore.getState().architecture.connections[0];
      expect(connection).toMatchObject({
        source: 'source',
        target: 'target',
        sourcePort,
        targetPort,
      });
      await waitFor(() =>
        expect(
          document.querySelector(`[data-edge-id="${connection.id}"] path`),
        ).toBeInTheDocument(),
      );
      const path = document
        .querySelector(`[data-edge-id="${connection.id}"] path`)!
        .getAttribute('d')!;
      const coordinates = path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      const anchor = (port: string, x: number, y: number) => [
        x + (port === 'left' ? -5 : port === 'right' ? 221 : 108),
        y + (port === 'top' ? -5 : port === 'bottom' ? 109 : 52),
      ];
      expect(coordinates.slice(0, 2)).toEqual(anchor(sourcePort, 100, 80));
      expect(coordinates.slice(-2)).toEqual(anchor(targetPort, 400, 400));
      expect(path).not.toMatch(/NaN|Infinity/);
      await waitFor(() =>
        expect(useWorkspaceUiStore.getState().selectedConnectionId).toBe(
          connection.id,
        ),
      );
    },
  );

  it('uses right → left for older diagrams and updates existing edges from the inspector', async () => {
    const id = useArchitectureStore.getState().connectComponents({
      source: 'source',
      target: 'target',
      type: 'request',
    });
    useWorkspaceUiStore.getState().selectConnection(id);
    render(<App />);
    expect(screen.getByRole('combobox', { name: 'Source side' })).toHaveValue(
      'right',
    );
    expect(screen.getByRole('combobox', { name: 'Target side' })).toHaveValue(
      'left',
    );
    await waitFor(() =>
      expect(
        document.querySelector(`[data-edge-id="${id}"] path`),
      ).toBeInTheDocument(),
    );
    const legacyPath = document
      .querySelector(`[data-edge-id="${id}"] path`)!
      .getAttribute('d')!;
    const legacyCoordinates = legacyPath.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    expect(legacyCoordinates.slice(0, 2)).toEqual([321, 132]);
    expect(legacyCoordinates.slice(-2)).toEqual([395, 452]);
    fireEvent.change(screen.getByRole('combobox', { name: 'Source side' }), {
      target: { value: 'bottom' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Target side' }), {
      target: { value: 'top' },
    });
    expect(
      useArchitectureStore.getState().architecture.connections[0],
    ).toMatchObject({ sourcePort: 'bottom', targetPort: 'top' });
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    fireEvent.click(screen.getByTestId(`rf__edge-${id}`));
    expect(screen.getByRole('combobox', { name: 'Target side' })).toHaveValue(
      'left',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    fireEvent.click(screen.getByTestId(`rf__edge-${id}`));
    expect(screen.getByRole('combobox', { name: 'Target side' })).toHaveValue(
      'top',
    );
    await waitFor(() =>
      expect(
        document.querySelector(`[data-edge-id="${id}"] path`),
      ).toBeInTheDocument(),
    );
  });

  it.each([
    ['bottom', 'top'],
    ['top', 'bottom'],
  ])('drags a %s → %s connection', async (sourcePort, targetPort) => {
    render(<ArchitectureCanvas />);
    const source = screen.getByLabelText(`Connect Source via ${sourcePort}`);
    const target = screen.getByLabelText(`Connect Target via ${targetPort}`);
    const start = source.getBoundingClientRect();
    const end = target.getBoundingClientRect();
    const elementFromPoint = vi
      .spyOn(document, 'elementFromPoint')
      .mockReturnValue(source);
    fireEvent.mouseDown(source, {
      button: 0,
      clientX: start.x + 5,
      clientY: start.y + 5,
    });
    elementFromPoint.mockReturnValue(target);
    fireEvent.mouseMove(document, {
      clientX: end.x + 5,
      clientY: end.y + 5,
    });
    fireEvent.mouseUp(document, {
      clientX: end.x + 5,
      clientY: end.y + 5,
    });
    await waitFor(() =>
      expect(
        useArchitectureStore.getState().architecture.connections,
      ).toHaveLength(1),
    );
    expect(
      useArchitectureStore.getState().architecture.connections[0],
    ).toMatchObject({
      source: 'source',
      target: 'target',
      sourcePort,
      targetPort,
    });
    await waitFor(() =>
      expect(
        useWorkspaceUiStore.getState().selectedConnectionId,
      ).not.toBeNull(),
    );
  });

  it('does not add traffic handles to network boundaries or attachment-only components', () => {
    act(() => {
      useArchitectureStore
        .getState()
        .addComponent({ id: 'boundary', kind: 'virtual-network' });
      useArchitectureStore
        .getState()
        .addComponent({ id: 'policy', kind: 'security-group' });
    });
    render(<ArchitectureCanvas />);
    for (const id of ['boundary', 'policy']) {
      expect(
        document.querySelectorAll(
          `[data-component-id="${id}"] .react-flow__handle`,
        ),
      ).toHaveLength(0);
    }
  });
});
