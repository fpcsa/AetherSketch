import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { App } from '../../src/app/App';
import { useArchitectureStore } from '../../src/stores/architecture-store';
import { useWorkspaceUiStore } from '../../src/stores/workspace-ui-store';
import { getArchitectureTemplate } from '../../src/templates';

describe('AetherSketch application shell', () => {
  beforeEach(() => {
    useWorkspaceUiStore.setState({ activePaletteCategory: 'network' });
    useArchitectureStore.setState({
      architecture: getArchitectureTemplate('ecommerce-production'),
      activity: [],
      past: [],
      future: [],
    });
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
    expect(screen.getAllByText('Ecommerce Production')).toHaveLength(3);
    expect(screen.getByText('Orders Database')).toBeInTheDocument();
  });

  it('includes all required palette categories and keeps selection in UI state', () => {
    render(<App />);

    for (const category of [
      'Network',
      'Compute',
      'Data',
      'Integration',
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

  it('keeps future integration actions unavailable while exposing real history controls', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(
      screen.getByRole('button', {
        name: 'Import architecture (not available yet)',
      }),
    ).toBeDisabled();
    expect(screen.getAllByText('Not registered')).toHaveLength(1);
    expect(screen.getByText('Integration pending')).toBeInTheDocument();
  });
});
