import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import { serializeArchitecture } from '../../src/architecture/serialization';
import { createEmptyArchitecture } from '../../src/architecture/model';
import { AgentSessionComparison } from '../../src/components/agent/AgentSessionComparison';
import { WebMcpStatus } from '../../src/components/agent/WebMcpStatus';
import { useArchitectureStore } from '../../src/stores/architecture-store';
import { useIntelligenceStore } from '../../src/stores/intelligence-store';
import { useWorkspaceUiStore } from '../../src/stores/workspace-ui-store';
import { getArchitectureTemplate } from '../../src/templates';
import { useWebMcpStore } from '../../src/webmcp';
import { WEBMCP_READ_TOOL_NAMES } from '../../src/webmcp/tools/read-tools';
import { WEBMCP_MUTATION_TOOL_NAMES } from '../../src/webmcp/tools/mutation-tools';

function pendingFile() {
  let finish!: (value: string) => void;
  const file = new File(['pending'], 'architecture.json', {
    type: 'application/json',
  });
  const text = vi.fn(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  Object.defineProperty(file, 'text', { value: text });
  return { file, text, finish: (value: string) => finish(value) };
}
function choose(file: File) {
  fireEvent.change(screen.getByLabelText('Architecture JSON file'), {
    target: { files: [file] },
  });
}

describe('submission hardening', () => {
  beforeEach(() => {
    delete (document as Document & { modelContext?: unknown }).modelContext;
    useWebMcpStore.getState().reset();
    useWorkspaceUiStore.setState(useWorkspaceUiStore.getInitialState());
    useArchitectureStore.setState({
      architecture: getArchitectureTemplate('ecommerce-production'),
      past: [],
      future: [],
      activity: [],
      persistenceUnavailable: false,
      persistenceRecoveryNotice: null,
    });
    useIntelligenceStore.getState().runAnalysis();
  });

  it('switches between assessed and unassessed scores when adding a node and undoing it', async () => {
    render(<App />);
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Architecture template' }),
      { target: { value: 'blank' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));
    await waitFor(() =>
      expect(
        within(
          screen.getByRole('contentinfo', { name: 'Architecture status' }),
        ).getAllByText('Not assessed'),
      ).toHaveLength(2),
    );
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0);
    expect(
      screen.getByText(
        'Not assessed. Add components to assess resilience and security.',
      ),
    ).toBeVisible();
    expect(
      screen.queryByText('No findings for this analysis focus.'),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add DNS' }));
    fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rerun' }));
    await waitFor(() =>
      expect(
        screen.getByRole('progressbar', { name: 'Resilience score' }),
      ).toHaveAttribute('aria-valuenow', '90'),
    );
    expect(
      within(
        screen.getByRole('contentinfo', { name: 'Architecture status' }),
      ).queryByText('Not assessed'),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(screen.queryAllByRole('progressbar')).toHaveLength(0),
    );
    expect(
      within(
        screen.getByRole('contentinfo', { name: 'Architecture status' }),
      ).getAllByText('Not assessed'),
    ).toHaveLength(2);
  });

  it('shows empty comparison endpoints as unassessed without numeric score deltas', () => {
    useWebMcpStore.setState({
      agentSessionBaseline: createEmptyArchitecture({
        name: 'Empty architecture',
      }),
      comparisonOpen: true,
    });
    render(<AgentSessionComparison />);
    const metrics = within(screen.getByTestId('agent-session-score-deltas'));
    expect(metrics.getAllByText('Not assessed')).toHaveLength(2);
    expect(metrics.getAllByText('No score comparison')).toHaveLength(2);
    expect(metrics.getByText('57')).toBeVisible();
    expect(metrics.getByText('76')).toBeVisible();
  });

  it('rejects oversized files before allocating their contents', () => {
    render(<App />);
    const pending = pendingFile();
    Object.defineProperty(pending.file, 'size', { value: 16_000_001 });
    choose(pending.file);
    expect(pending.text).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('16 MB');
    expect(useArchitectureStore.getState().past).toHaveLength(0);
  });

  it('cannot overwrite Reset Demo with a slow import', async () => {
    render(<App />);
    const pending = pendingFile();
    choose(pending.file);
    fireEvent.click(screen.getByRole('button', { name: 'Reset Demo' }));
    const restored = useArchitectureStore.getState().architecture;
    await act(() =>
      Promise.resolve(
        pending.finish(
          serializeArchitecture(getArchitectureTemplate('serverless-api')),
        ),
      ),
    );
    expect(useArchitectureStore.getState().architecture).toBe(restored);
    expect(useArchitectureStore.getState().past).toEqual([]);
  });

  it('preserves edits committed while an import is being read', async () => {
    render(<App />);
    const pending = pendingFile();
    choose(pending.file);
    fireEvent.click(screen.getByRole('button', { name: 'Add DNS' }));
    const edited = useArchitectureStore.getState().architecture;
    await act(() =>
      Promise.resolve(
        pending.finish(
          serializeArchitecture(getArchitectureTemplate('serverless-api')),
        ),
      ),
    );
    expect(useArchitectureStore.getState().architecture).toBe(edited);
    expect(
      screen.getByText(/Import cancelled because the architecture changed/),
    ).toBeVisible();
  });

  it('only commits the most recently selected import', async () => {
    render(<App />);
    const older = pendingFile();
    const newer = pendingFile();
    choose(older.file);
    choose(newer.file);
    await act(() =>
      Promise.resolve(
        newer.finish(
          serializeArchitecture(getArchitectureTemplate('event-processing')),
        ),
      ),
    );
    await act(() =>
      Promise.resolve(
        older.finish(
          serializeArchitecture(getArchitectureTemplate('serverless-api')),
        ),
      ),
    );
    expect(useArchitectureStore.getState().architecture.name).toBe(
      'Event Processing',
    );
    expect(useArchitectureStore.getState().past).toHaveLength(1);
  });

  it('rejects duplicate imported relationships without changing the current workspace', async () => {
    render(<App />);
    const duplicate = getArchitectureTemplate('ecommerce-production');
    duplicate.connections.push({
      ...duplicate.connections[0],
      id: 'duplicate',
    });
    const pending = pendingFile();
    const before = useArchitectureStore.getState().architecture;
    choose(pending.file);
    await act(() => Promise.resolve(pending.finish(JSON.stringify(duplicate))));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Duplicate typed connection',
    );
    expect(useArchitectureStore.getState().architecture).toBe(before);
  });

  it('keyboard selection and movement update the inspector, IR and undo together', async () => {
    render(<App />);
    const node = await screen.findByTestId('rf__node-ecommerce-ecs');
    const before = useArchitectureStore.getState().architecture;
    fireEvent.keyDown(node, { key: 'Enter' });
    expect(screen.getByRole('textbox', { name: 'Component name' })).toHaveValue(
      'Storefront API',
    );
    fireEvent.keyDown(node, { key: 'ArrowRight' });
    const original = before.components.find(
      (item) => item.id === 'ecommerce-ecs',
    )!;
    expect(
      useArchitectureStore
        .getState()
        .architecture.components.find((item) => item.id === original.id)
        ?.position.x,
    ).toBe(original.position.x + 16);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(useArchitectureStore.getState().architecture).toEqual(before);
  });

  it('shows live registration and returns keyboard focus when the tool directory closes', async () => {
    useWebMcpStore.getState().markReadReady(WEBMCP_READ_TOOL_NAMES);
    render(<WebMcpStatus />);
    const user = userEvent.setup();
    const opener = screen.getByRole('button', { name: 'Explore WebMCP tools' });
    await user.click(opener);
    const directory = screen.getByRole('dialog', {
      name: 'WebMCP tool directory',
    });
    expect(within(directory).getByText(/4 registered/)).toBeVisible();
    expect(
      within(directory).getAllByText('Registered', { exact: true }),
    ).toHaveLength(4);
    expect(
      screen.getByRole('button', { name: 'Close tool directory' }),
    ).toHaveFocus();
    act(() => {
      useWebMcpStore
        .getState()
        .enableAgentEditing(useArchitectureStore.getState().architecture);
      useWebMcpStore.getState().markEditReady(WEBMCP_MUTATION_TOOL_NAMES);
    });
    expect(
      within(directory).getAllByText('Registered', { exact: true }),
    ).toHaveLength(9);
    act(() => useWebMcpStore.getState().disableAgentEditing());
    expect(
      within(directory).getAllByText('Registered', { exact: true }),
    ).toHaveLength(4);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(opener).toHaveFocus();
  });
});
