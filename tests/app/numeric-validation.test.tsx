import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  architectureConstraintsSchema,
  type ComponentKind,
} from '../../src/architecture';
import { ComponentInspector } from '../../src/components/inspector/ComponentInspector';
import { ConstraintsPanel } from '../../src/components/inspector/ConstraintsPanel';
import { NumericField } from '../../src/components/inspector/NumericField';
import { useArchitectureStore } from '../../src/stores/architecture-store';
import { useIntelligenceStore } from '../../src/stores/intelligence-store';
import { useWorkspaceUiStore } from '../../src/stores/workspace-ui-store';
import { getArchitectureTemplate } from '../../src/templates';

function ComponentUnderTest({ id }: { id: string }) {
  const component = useArchitectureStore((state) =>
    state.architecture.components.find((candidate) => candidate.id === id),
  )!;
  return <ComponentInspector component={component} />;
}

function renderComponent(kind: ComponentKind) {
  const component = useArchitectureStore.getState().addComponent({ kind });
  render(<ComponentUnderTest id={component.id} />);
  return component;
}

function editNumber(label: string, value: string) {
  const input = screen.getByRole('spinbutton', { name: label });
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
  return screen.getByRole<HTMLInputElement>('spinbutton', { name: label });
}

function expectRejection(label: string, value: string, message: string) {
  const before = useArchitectureStore.getState();
  const saved = screen.getByRole<HTMLInputElement>('spinbutton', {
    name: label,
  }).value;
  const input = editNumber(label, value);
  expect(input.value).toBe(saved);
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveAccessibleDescription(
    `${message} ${saved ? `Saved value ${saved} restored.` : 'No value saved.'}`,
  );
  expect(useArchitectureStore.getState().architecture).toBe(
    before.architecture,
  );
  expect(useArchitectureStore.getState().past).toBe(before.past);
  expect(useArchitectureStore.getState().future).toBe(before.future);
  expect(useArchitectureStore.getState().activity).toBe(before.activity);
  expect(useWorkspaceUiStore.getState().notice).toBeNull();
}

beforeEach(() => {
  const architecture = getArchitectureTemplate('ecommerce-production');
  architecture.constraints.maximumMonthlyCost = 500;
  architecture.constraints.targetResilienceScore = 80;
  architecture.constraints.targetSecurityScore = 75;
  useArchitectureStore.setState({
    architecture,
    past: [],
    future: [],
    activity: [],
  });
  useWorkspaceUiStore.setState({ notice: null });
  useIntelligenceStore.getState().clearSimulation();
  useIntelligenceStore.getState().runAnalysis();
});

describe('numeric inspector validation', () => {
  it.each([
    ['Maximum monthly cost', '-1', 'Enter a value of at least 0.'],
    ['Target resilience', '101', 'Enter a value no greater than 100.'],
    ['Target security', '-1', 'Enter a value of at least 0.'],
  ])(
    'restores rejected %s without changing history',
    (label, value, message) => {
      render(<ConstraintsPanel />);
      expectRejection(label, value, message);
    },
  );

  it('clears errors after correction and supports optional clearing, zero, and decimals', () => {
    render(<ConstraintsPanel />);
    expectRejection(
      'Target resilience',
      '101',
      'Enter a value no greater than 100.',
    );
    expect(editNumber('Target resilience', '100')).toHaveValue(100);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Target resilience')).not.toHaveAttribute(
      'aria-invalid',
    );
    editNumber('Target resilience', '99.5');
    expect(
      useArchitectureStore.getState().architecture.constraints
        .targetResilienceScore,
    ).toBe(99.5);
    editNumber('Target resilience', '0');
    expect(
      useArchitectureStore.getState().architecture.constraints
        .targetResilienceScore,
    ).toBe(0);
    expect(editNumber('Target resilience', '')).toHaveValue(null);
    expect(
      useArchitectureStore.getState().architecture.constraints
        .targetResilienceScore,
    ).toBeUndefined();
    expectRejection(
      'Target resilience',
      '101',
      'Enter a value no greater than 100.',
    );
  });

  it('does not create undo entries for unchanged values and follows undo/redo after corrections', () => {
    render(<ConstraintsPanel />);
    const before = useArchitectureStore.getState();
    editNumber('Maximum monthly cost', '500');
    expect(useArchitectureStore.getState().past).toBe(before.past);
    editNumber('Maximum monthly cost', '650.5');
    expectRejection(
      'Maximum monthly cost',
      '-1',
      'Enter a value of at least 0.',
    );
    act(() => {
      useArchitectureStore.getState().undo();
    });
    expect(screen.getByLabelText('Maximum monthly cost')).toHaveValue(500);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    act(() => {
      useArchitectureStore.getState().redo();
    });
    expect(screen.getByLabelText('Maximum monthly cost')).toHaveValue(650.5);
  });

  it.each([
    ['0', 'Enter a value of at least 1.'],
    ['10001', 'Enter a value no greater than 10000.'],
    ['1.5', 'Enter a whole number.'],
    ['', 'A value is required.'],
  ])(
    'rejects replica count %s and accepts a subsequent valid edit',
    (value, message) => {
      const component = renderComponent('container-service');
      expectRejection('Replicas', value, message);
      expect(editNumber('Replicas', '4')).toHaveValue(4);
      expect(
        useArchitectureStore
          .getState()
          .architecture.components.find((c) => c.id === component.id)?.replicas,
      ).toBe(4);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    },
  );

  it.each<[ComponentKind, string, string, string, string, string]>([
    [
      'container-service',
      'Cpu',
      'cpu',
      '127',
      '128',
      'Enter a value of at least 128.',
    ],
    [
      'container-service',
      'Memory Mb',
      'memoryMb',
      '131073',
      '1024',
      'Enter a value no greater than 131072.',
    ],
    [
      'serverless-function',
      'Memory Mb',
      'memoryMb',
      '127',
      '128',
      'Enter a value of at least 128.',
    ],
    [
      'serverless-function',
      'Timeout Seconds',
      'timeoutSeconds',
      '901',
      '900',
      'Enter a value no greater than 900.',
    ],
    [
      'sql-database',
      'Storage Gb',
      'storageGb',
      '20.5',
      '20',
      'Enter a whole number.',
    ],
    [
      'monitoring',
      'Log Retention Days',
      'logRetentionDays',
      '0',
      '3650',
      'Enter a value of at least 1.',
    ],
    [
      'nat-gateway',
      'Monthly processed data (GB)',
      'monthlyDataGb',
      '-1',
      '0.5',
      'Enter a value of at least 0.',
    ],
    [
      'private-endpoint',
      'Monthly processed data (GB)',
      'monthlyDataGb',
      '1000000001',
      '0',
      'Enter a value no greater than 1000000000.',
    ],
    [
      'vpn-connection',
      'Tunnels',
      'tunnels',
      '3',
      '1',
      'Enter a value no greater than 2.',
    ],
    [
      'virtual-private-gateway',
      'Private ASN',
      'asn',
      '65535',
      '4200000000',
      'Enter a whole number from 64512–65534 or 4200000000–4294967294.',
    ],
  ])(
    'uses domain rules for %s %s',
    (kind, label, key, invalid, valid, message) => {
      const component = renderComponent(kind);
      expectRejection(label, invalid, message);
      expect(editNumber(label, valid)).toHaveValue(Number(valid));
      expect(
        useArchitectureStore
          .getState()
          .architecture.components.find((c) => c.id === component.id)
          ?.configuration,
      ).toMatchObject({ [key]: Number(valid) });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    },
  );

  it('does not silently turn a blank required service setting into zero', () => {
    renderComponent('nat-gateway');
    expectRejection('Monthly processed data (GB)', '', 'A value is required.');
  });

  it('keeps numeric component fields disabled when the component is locked', () => {
    const component = renderComponent('container-service');
    act(() => {
      useArchitectureStore.getState().lockComponent(component.id);
    });
    expect(screen.getByLabelText('Replicas')).toBeDisabled();
    expect(screen.getByLabelText('Cpu')).toBeDisabled();
    expect(screen.getByLabelText('Memory Mb')).toBeDisabled();
  });

  it('restores the saved value and explains a commit failure even after numeric validation passes', () => {
    const onCommit = vi.fn(() => {
      throw new Error('Editing is unavailable.');
    });
    render(
      <NumericField
        label="Budget"
        inputClassName=""
        schema={architectureConstraintsSchema.shape.maximumMonthlyCost}
        optional
        value={500}
        onCommit={onCommit}
      />,
    );
    const input = editNumber('Budget', '600');
    expect(input).toHaveValue(500);
    expect(input).toHaveAccessibleDescription(
      'Editing is unavailable. Saved value 500 restored.',
    );
  });

  it('rejects a browser bad-input state instead of interpreting it as clearing an optional value', () => {
    render(<ConstraintsPanel />);
    const input = screen.getByLabelText('Target resilience');
    Object.defineProperty(input, 'validity', {
      configurable: true,
      value: { badInput: true },
    });
    expectRejection('Target resilience', '', 'Enter a finite number.');
  });
});
