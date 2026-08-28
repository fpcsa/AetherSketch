import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../src/app/App';
import { RenderErrorBoundary } from '../../src/components/layout/RenderErrorBoundary';
import { serializeArchitecture } from '../../src/architecture/serialization';
import { useArchitectureStore } from '../../src/stores/architecture-store';
import { useIntelligenceStore } from '../../src/stores/intelligence-store';
import { useWorkspaceUiStore } from '../../src/stores/workspace-ui-store';
import { getArchitectureTemplate } from '../../src/templates';
import { useWebMcpStore } from '../../src/webmcp';

const runAnalysis = useIntelligenceStore.getState().runAnalysis;
const addComponent = useArchitectureStore.getState().addComponent;

describe('production recovery', () => {
  beforeEach(() => {
    delete (document as Document & { modelContext?: unknown }).modelContext;
    useWebMcpStore.getState().reset();
    useWorkspaceUiStore.setState({
      activePanel: 'inspector',
      activePaletteCategory: 'network',
      selectedComponentId: null,
      selectedConnectionId: null,
      notice: null,
      activityOpen: false,
    });
    useArchitectureStore.setState({
      architecture: getArchitectureTemplate('ecommerce-production'),
      past: [],
      future: [],
      activity: [],
      persistenceUnavailable: false,
      persistenceRecoveryNotice: null,
    });
    runAnalysis();
  });

  afterEach(() => {
    useIntelligenceStore.setState({ runAnalysis });
    useArchitectureStore.setState({
      addComponent,
      persistenceUnavailable: false,
    });
    vi.restoreAllMocks();
  });

  it('shows a persistent storage warning while keeping export and editing available', () => {
    useArchitectureStore.setState({ persistenceUnavailable: true });
    render(<App />);
    expect(screen.getByText(/Changes are kept only in this tab/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Add DNS' }));
    expect(
      useArchitectureStore.getState().architecture.components,
    ).toHaveLength(6);
  });

  it('reports unexpected domain exceptions and lets the human retry', async () => {
    useArchitectureStore.setState({
      addComponent: vi.fn(() => {
        throw new Error('private internal detail');
      }),
    });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Add DNS' }));
    expect(screen.getByText(/The component could not be added/)).toBeVisible();
    expect(screen.queryByText(/private internal detail/)).toBeNull();
    expect(
      useArchitectureStore.getState().architecture.components,
    ).toHaveLength(5);
    await act(() =>
      Promise.resolve(useArchitectureStore.setState({ addComponent })),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add DNS' }));
    expect(
      useArchitectureStore.getState().architecture.components,
    ).toHaveLength(6);
  });

  it('catches analysis button failure and still restores the canonical reset state', async () => {
    useIntelligenceStore.setState({
      runAnalysis: vi.fn(() => {
        throw new Error('engine failed');
      }),
    });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Run analysis' }));
    expect(screen.getByText(/Analysis could not complete/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Reset Demo' }));
    expect(
      screen.getByText('Demo restored, but analysis failed. Retry analysis.'),
    ).toBeVisible();
    expect(
      useArchitectureStore.getState().architecture.components,
    ).toHaveLength(5);
    expect(useArchitectureStore.getState().past).toEqual([]);
    expect(useWebMcpStore.getState().mode).toBe('review');
    await act(() =>
      Promise.resolve(useIntelligenceStore.setState({ runAnalysis })),
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Run analysis|Rerun analysis/ }),
    );
    expect(useIntelligenceStore.getState().analysis?.estimatedMonthlyCost).toBe(
      675,
    );
  });

  it('does not claim an import was unchanged when only the follow-up analysis fails', async () => {
    useIntelligenceStore.setState({
      runAnalysis: vi.fn(() => {
        throw new Error('engine failed');
      }),
    });
    render(<App />);
    const file = new File(['fixture'], 'serverless.json', {
      type: 'application/json',
    });
    Object.defineProperty(file, 'text', {
      value: () =>
        Promise.resolve(
          serializeArchitecture(getArchitectureTemplate('serverless-api')),
        ),
    });
    fireEvent.change(screen.getByLabelText('Architecture JSON file'), {
      target: { files: [file] },
    });
    await waitFor(() =>
      expect(
        screen.getByText(
          'Architecture imported, but analysis failed. Retry analysis.',
        ),
      ).toBeVisible(),
    );
    expect(useArchitectureStore.getState().architecture.name).toBe(
      'Serverless API',
    );
    expect(screen.queryByText(/current project was left unchanged/)).toBeNull();
  });

  it('recovers a failed root render without exposing exception details or resetting the model', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let fail = true;
    function UnstableView() {
      if (fail) throw new Error('private render detail');
      return <p>Workspace resumed</p>;
    }
    const before = useArchitectureStore.getState().architecture;
    render(
      <RenderErrorBoundary scope="workspace">
        <UnstableView />
      </RenderErrorBoundary>,
    );
    expect(screen.getByText('Workspace rendering paused')).toBeVisible();
    expect(screen.queryByText('private render detail')).toBeNull();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Restart workspace' }));
    expect(screen.getByText('Workspace resumed')).toBeVisible();
    expect(useArchitectureStore.getState().architecture).toBe(before);
  });
});
