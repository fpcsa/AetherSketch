import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../src/app/App';
import { serializeArchitecture } from '../../src/architecture/serialization';
import { useArchitectureStore } from '../../src/stores/architecture-store';
import { useIntelligenceStore } from '../../src/stores/intelligence-store';
import { THEME_STORAGE_KEY, useThemeStore } from '../../src/stores/theme-store';
import { useWorkspaceUiStore } from '../../src/stores/workspace-ui-store';
import { getArchitectureTemplate } from '../../src/templates';

function resetWorkspace() {
  useWorkspaceUiStore.setState({
    activePaletteCategory: 'network',
    selectedComponentId: null,
    selectedConnectionId: null,
    activePanel: 'inspector',
    focusRequest: 0,
    activityOpen: false,
    notice: null,
  });
  useArchitectureStore.setState({
    architecture: getArchitectureTemplate('ecommerce-production'),
    activity: [],
    past: [],
    future: [],
  });
  useIntelligenceStore.getState().clearSimulation();
  useIntelligenceStore.getState().runAnalysis();
  useThemeStore.getState().setTheme('dark');
}

describe('human architecture workspace', () => {
  beforeEach(() => {
    delete (document as Document & { modelContext?: unknown }).modelContext;
    resetWorkspace();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads templates and supports a blank architecture', () => {
    render(<App />);
    const template = screen.getByRole('combobox', {
      name: 'Architecture template',
    });

    fireEvent.change(template, { target: { value: 'serverless-api' } });
    expect(useArchitectureStore.getState().architecture.name).toBe(
      'Serverless API',
    );
    expect(
      useArchitectureStore.getState().architecture.components,
    ).toHaveLength(5);

    fireEvent.change(template, { target: { value: 'blank' } });
    expect(useArchitectureStore.getState().architecture).toMatchObject({
      name: 'Blank Architecture',
      components: [],
      connections: [],
    });
    expect(screen.getByText('Blank architecture')).toBeInTheDocument();
  });

  it('adds, removes, undoes, and redoes a catalog component', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Compute' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Add Container Service' }),
    );

    const added = useArchitectureStore
      .getState()
      .architecture.components.find(
        (component) =>
          component.kind === 'container-service' &&
          component.id !== 'ecommerce-ecs',
      );
    expect(added).toBeDefined();
    expect(useWorkspaceUiStore.getState().selectedComponentId).toBe(added?.id);
    expect(screen.getByLabelText('Component name')).toHaveValue(
      'Container Service',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(
      useArchitectureStore
        .getState()
        .architecture.components.some(
          (component) => component.id === added?.id,
        ),
    ).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(
      useArchitectureStore
        .getState()
        .architecture.components.some(
          (component) => component.id === added?.id,
        ),
    ).toBe(true);

    act(() => useWorkspaceUiStore.getState().selectComponent(added!.id));
    fireEvent.click(
      screen.getByRole('button', { name: `Delete ${added!.name}` }),
    );
    expect(
      useArchitectureStore
        .getState()
        .architecture.components.some(
          (component) => component.id === added?.id,
        ),
    ).toBe(false);
  });

  it('adds and configures serverless AI and agent components', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'AI' }));
    expect(
      screen.getByText('Foundation models and autonomous agent orchestration'),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Add Serverless AI / LLM' }),
    );
    const serverlessAi = useArchitectureStore
      .getState()
      .architecture.components.find(
        (component) => component.kind === 'serverless-ai',
      );
    expect(serverlessAi).toMatchObject({
      service: 'bedrock-runtime',
      configuration: {
        modality: 'text',
        guardrailsEnabled: true,
        privateAccess: true,
        encrypted: true,
      },
    });
    expect(screen.getByText('Amazon Bedrock · serverless-ai')).toBeVisible();

    fireEvent.change(screen.getByRole('combobox', { name: 'Modality' }), {
      target: { value: 'multimodal' },
    });
    expect(
      useArchitectureStore
        .getState()
        .architecture.components.find(
          (component) => component.id === serverlessAi?.id,
        ),
    ).toMatchObject({ configuration: { modality: 'multimodal' } });

    fireEvent.click(screen.getByRole('button', { name: 'Add AI Agent' }));
    const agent = useArchitectureStore
      .getState()
      .architecture.components.find(
        (component) => component.kind === 'ai-agent',
      );
    expect(agent).toMatchObject({
      service: 'bedrock-agent',
      configuration: {
        orchestrationMode: 'single-agent',
        memoryEnabled: true,
        humanApprovalRequired: true,
        guardrailsEnabled: true,
        encrypted: true,
      },
    });
    expect(
      screen.getByText('Agents for Amazon Bedrock · ai-agent'),
    ).toBeVisible();

    fireEvent.change(
      screen.getByRole('combobox', { name: 'Orchestration Mode' }),
      { target: { value: 'supervisor' } },
    );
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Human Approval Required' }),
    );
    expect(
      useArchitectureStore
        .getState()
        .architecture.components.find(
          (component) => component.id === agent?.id,
        ),
    ).toMatchObject({
      configuration: {
        orchestrationMode: 'supervisor',
        humanApprovalRequired: false,
      },
    });
  });

  it('edits typed component properties and enforces locking visually', () => {
    render(<App />);

    fireEvent.click(screen.getByText('Orders Database'));
    const nameInput = screen.getByLabelText('Component name');
    fireEvent.change(nameInput, { target: { value: 'Primary Orders DB' } });
    fireEvent.blur(nameInput);
    expect(
      useArchitectureStore
        .getState()
        .architecture.components.find(
          (component) => component.id === 'ecommerce-postgresql',
        )?.name,
    ).toBe('Primary Orders DB');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Multi AZ' }));
    const database = useArchitectureStore
      .getState()
      .architecture.components.find(
        (component) => component.id === 'ecommerce-postgresql',
      );
    expect(database?.kind).toBe('sql-database');
    if (database?.kind === 'sql-database') {
      expect(database.configuration.multiAZ).toBe(true);
    }

    fireEvent.click(screen.getByRole('button', { name: 'Lock component' }));
    expect(screen.getByLabelText('Component name')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Delete Primary Orders DB' }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Unlock component' }));
    expect(screen.getByLabelText('Component name')).toBeEnabled();
  });

  it('edits connection properties through the edge inspector', () => {
    useWorkspaceUiStore.getState().selectConnection('ecommerce-edge-4');
    render(<App />);

    fireEvent.change(
      screen.getByRole('combobox', { name: 'Connection type' }),
      { target: { value: 'trigger' } },
    );
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Encrypted transport' }),
    );

    expect(
      useArchitectureStore
        .getState()
        .architecture.connections.find(
          (connection) => connection.id === 'ecommerce-edge-4',
        ),
    ).toMatchObject({ type: 'trigger', encrypted: false });
  });

  it('connects canvas handles without blanking the workspace', async () => {
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    const connectionCount =
      useArchitectureStore.getState().architecture.connections.length;

    fireEvent.click(
      screen.getByLabelText('Connect from Public Application Load Balancer'),
    );
    fireEvent.click(screen.getByLabelText('Connect into Orders Database'));

    await waitFor(() =>
      expect(
        useArchitectureStore.getState().architecture.connections,
      ).toHaveLength(connectionCount + 1),
    );
    expect(
      screen.getByRole('heading', { name: 'Architecture Canvas' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText('Public Application Load Balancer').length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('Orders Database').length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(screen.getAllByText('Connection').length).toBeGreaterThan(0),
    );
  });

  it('switches between persisted dark and light workspace themes', () => {
    render(<App />);

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(document.querySelector('.react-flow')).toHaveClass('dark');

    fireEvent.click(
      screen.getByRole('button', { name: 'Switch to light mode' }),
    );

    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(document.querySelector('[data-theme="light"]')).toBeInTheDocument();
    expect(document.querySelector('.react-flow')).toHaveClass('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(
      screen.getByRole('button', { name: 'Switch to dark mode' }),
    ).toBeInTheDocument();
  });

  it('stores constraints and presents their deterministic evaluation', () => {
    render(<App />);

    const budget = screen.getByLabelText('Maximum monthly cost');
    fireEvent.change(budget, { target: { value: '600' } });
    fireEvent.blur(budget);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Require Multi-AZ' }));

    expect(
      useArchitectureStore.getState().architecture.constraints,
    ).toMatchObject({
      maximumMonthlyCost: 600,
      requireMultiAZ: true,
    });
    expect(useIntelligenceStore.getState().analysisStale).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Rerun analysis' }));
    expect(useIntelligenceStore.getState().analysis?.constraints).toMatchObject(
      {
        withinBudget: false,
        allApplicableConstraintsMet: false,
      },
    );
    expect(screen.getAllByText('not-met').length).toBeGreaterThan(0);
  });

  it('shows interactive analysis findings and focuses affected nodes', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));

    expect(screen.getAllByText('$675').length).toBeGreaterThan(0);
    const findingTitle = screen.getByText('Critical database is single-AZ');
    fireEvent.click(findingTitle.closest('button')!);

    expect(useWorkspaceUiStore.getState().selectedComponentId).toBe(
      'ecommerce-postgresql',
    );
  });

  it('projects AZ failure state onto nodes and impacted edges without IR mutation', () => {
    render(<App />);
    const architectureBefore = JSON.stringify(
      useArchitectureStore.getState().architecture,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Simulate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Availability zone' }));
    fireEvent.change(screen.getByLabelText('Failure target'), {
      target: { value: 'eu-west-1a' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Run failure simulation' }),
    );

    expect(useIntelligenceStore.getState().simulation).toMatchObject({
      status: 'unavailable',
      criticalPathsRemaining: false,
    });
    expect(
      document.querySelector(
        '[data-component-id="ecommerce-postgresql"][data-simulation-state="failed"]',
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId('simulation-edge-count')).toHaveTextContent(
      '3 impacted edges',
    );
    expect(JSON.stringify(useArchitectureStore.getState().architecture)).toBe(
      architectureBefore,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear simulation' }));
    expect(useIntelligenceStore.getState().simulation).toBeNull();
  });

  it('exports validated JSON and imports valid projects without corrupting on failure', async () => {
    const createObjectUrl = vi.fn(() => 'blob:aethersketch-export');
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectUrl,
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:aethersketch-export');

    const importedArchitecture = {
      ...getArchitectureTemplate('serverless-api'),
      name: 'Imported Platform',
    };
    const validJson = serializeArchitecture(importedArchitecture);
    const validFile = new File([validJson], 'architecture.json', {
      type: 'application/json',
    });
    Object.defineProperty(validFile, 'text', {
      value: () => Promise.resolve(validJson),
    });
    fireEvent.change(screen.getByLabelText('Architecture JSON file'), {
      target: { files: [validFile] },
    });
    await waitFor(() =>
      expect(useArchitectureStore.getState().architecture.name).toBe(
        'Imported Platform',
      ),
    );

    const invalidFile = new File(['not-json'], 'invalid.json', {
      type: 'application/json',
    });
    Object.defineProperty(invalidFile, 'text', {
      value: () => Promise.resolve('not-json'),
    });
    fireEvent.change(screen.getByLabelText('Architecture JSON file'), {
      target: { files: [invalidFile] },
    });
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'current project was left unchanged',
      ),
    );
    expect(useArchitectureStore.getState().architecture.name).toBe(
      'Imported Platform',
    );
  });

  it('shows activity actors and detects WebMCP readiness without registering tools', () => {
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {},
    });
    useArchitectureStore.getState().renameArchitecture('Observed Platform');
    render(<App />);

    expect(screen.getAllByText('Ready')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Activity history' }));
    expect(
      screen.getByRole('heading', { name: 'Activity & history' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Renamed architecture to “Observed Platform”'),
    ).toBeInTheDocument();
    expect(screen.getByText('Human')).toBeInTheDocument();
  });
});
