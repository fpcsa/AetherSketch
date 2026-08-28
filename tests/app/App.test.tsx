import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { App } from '../../src/app/App';
import { useArchitectureStore } from '../../src/stores/architecture-store';
import { useIntelligenceStore } from '../../src/stores/intelligence-store';
import { useWorkspaceUiStore } from '../../src/stores/workspace-ui-store';
import { getArchitectureTemplate } from '../../src/templates';
import { useWebMcpStore } from '../../src/webmcp';

describe('AetherSketch application shell', () => {
  beforeEach(() => {
    delete (document as Document & { modelContext?: unknown }).modelContext;
    useWebMcpStore.getState().reset();
    useWorkspaceUiStore.setState({
      activePaletteCategory: 'network',
      catalogDescriptionMode: 'aws',
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
    useIntelligenceStore.getState().runAnalysis();
  });

  it('renders every major workspace region', () => {
    render(<App />);

    expect(screen.getByText('AetherSketch')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Architecture Canvas' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Components' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Inspector' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Architecture Constraints' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('contentinfo', { name: 'Architecture status' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Ecommerce Production')).toHaveLength(2);
    expect(screen.getByText('Orders Database')).toBeInTheDocument();
    expect(screen.getByText('Estimated architecture cost')).toBeInTheDocument();
    expect(screen.getByText('$675')).toBeInTheDocument();
    expect(screen.getByText('planning — not AWS quote')).toBeInTheDocument();
    expect(screen.getByText('57')).toBeInTheDocument();
    expect(screen.getByText('76')).toBeInTheDocument();
  });

  it('includes all required palette categories and keeps selection in UI state', () => {
    render(<App />);

    for (const category of [
      'Network',
      'Compute',
      'Data',
      'Integration',
      'AI',
      'Platform',
    ]) {
      expect(
        screen.getByRole('button', { name: category }),
      ).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole('button', { name: 'Compute' }));

    expect(
      screen.getByText('Runtime services and execution environments'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Compute' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('exposes real project actions and truthful WebMCP feature detection', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();
    expect(screen.getByText('Unavailable')).toBeVisible();
    expect(screen.getByText('WebMCP unavailable')).toBeVisible();
    expect(screen.getByText('Manual editing still works')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Enable Agent Editing' }),
    ).toBeDisabled();
  });
});
