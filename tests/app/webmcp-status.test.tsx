import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { WebMcpStatus } from '../../src/components/agent/WebMcpStatus';
import { useWebMcpStore } from '../../src/webmcp';

describe('hackathon WebMCP status variants', () => {
  beforeEach(() => useWebMcpStore.getState().reset());

  it('states that manual editing works in unsupported browsers', () => {
    render(<WebMcpStatus compact />);

    expect(screen.getByText('WebMCP unavailable')).toBeVisible();
    expect(screen.getByText('Manual editing still works')).toBeVisible();
  });

  it('keeps manual editing available after registration failure', () => {
    render(<WebMcpStatus compact />);

    act(() => {
      useWebMcpStore.setState({
        status: 'error',
        registrationError: 'Registration rejected',
      });
    });
    expect(screen.getByText('WebMCP Error')).toBeVisible();
    expect(screen.getByText('Manual editing still works')).toBeVisible();
  });

  it('shows support and capability without implying agent connectivity', () => {
    render(<WebMcpStatus compact />);

    act(() => {
      useWebMcpStore.setState({
        status: 'ready',
        mode: 'review',
        readTools: [
          'get_architecture',
          'inspect_component',
          'analyze_architecture',
          'simulate_failure',
        ],
        editTools: [],
        registeredTools: [
          'get_architecture',
          'inspect_component',
          'analyze_architecture',
          'simulate_failure',
        ],
      });
    });
    expect(screen.getByText('WebMCP Ready')).toBeVisible();
    expect(screen.getByText('Review')).toBeVisible();
    expect(screen.getByText('4 tools')).toBeVisible();
    expect(
      screen.getByTitle(/Four Review tools.*not architecture/),
    ).toBeVisible();
    expect(screen.queryByText(/connected/i)).toBeNull();

    act(() => {
      useWebMcpStore.setState({
        mode: 'edit',
        editRegistrationStatus: 'ready',
        editTools: [
          'add_component',
          'update_component',
          'remove_component',
          'connect_components',
          'disconnect_components',
        ],
        registeredTools: [
          'get_architecture',
          'inspect_component',
          'analyze_architecture',
          'simulate_failure',
          'add_component',
          'update_component',
          'remove_component',
          'connect_components',
          'disconnect_components',
        ],
      });
    });
    expect(screen.getByText('Agent Edit')).toBeVisible();
    expect(screen.getByText('9 tools')).toBeVisible();
    expect(
      screen.getByTitle(/4 Review tools and 5 edit tools.*modify unlocked/),
    ).toBeVisible();
  });

  it('makes failed edit-tool registration visible outside diagnostics', () => {
    useWebMcpStore
      .getState()
      .markReadReady([
        'get_architecture',
        'inspect_component',
        'analyze_architecture',
        'simulate_failure',
      ]);
    useWebMcpStore.setState({ mode: 'edit' });
    useWebMcpStore
      .getState()
      .markEditRegistrationError('Mutation registration rejected');

    render(
      <>
        <WebMcpStatus />
        <WebMcpStatus compact />
      </>,
    );

    expect(screen.getAllByText('Edit error')).toHaveLength(2);
    expect(screen.getAllByText('4 tools')).toHaveLength(2);
    expect(screen.queryByText('Agent Edit')).toBeNull();
    expect(
      screen.getAllByTitle(
        /Edit-tool registration failed.*Review tools remain available/,
      ),
    ).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: 'Disable Agent Editing' }),
    ).toBeEnabled();
  });
});
