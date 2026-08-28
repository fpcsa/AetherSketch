import { createJSONStorage, type StateStorage } from 'zustand/middleware';
import { describe, expect, it, vi } from 'vitest';
import { analyzeArchitecture } from '../../src/architecture/analysis';

import {
  createArchitectureStore,
  type PersistedArchitectureState,
} from '../../src/stores/architecture-store';
import { createIntelligenceStore } from '../../src/stores/intelligence-store';
import { getArchitectureTemplate } from '../../src/templates';

function createSourceStore() {
  const values = new Map<string, string>();
  const storage: StateStorage = {
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => {
      values.set(name, value);
    },
    removeItem: (name) => {
      values.delete(name);
    },
  };

  return createArchitectureStore({
    initialArchitecture: getArchitectureTemplate('ecommerce-production'),
    storage: createJSONStorage<PersistedArchitectureState>(() => storage)!,
    skipHydration: true,
  });
}

describe('transient intelligence store', () => {
  it('survives an initial analysis exception and can retry without altering the architecture', () => {
    const source = createSourceStore();
    const before = source.getState();
    const analyze = vi.fn(analyzeArchitecture).mockImplementationOnce(() => {
      throw new Error('internal engine detail');
    });
    const intelligence = createIntelligenceStore(source, analyze);
    expect(intelligence.getState()).toMatchObject({
      analysis: null,
      analysisRevision: null,
    });
    expect(intelligence.getState().analysisError).toMatch(/retry analysis/i);
    expect(intelligence.getState().analysisError).not.toContain(
      'internal engine detail',
    );
    expect(intelligence.getState().runAnalysis().estimatedMonthlyCost).toBe(
      675,
    );
    expect(intelligence.getState().analysisError).toBeNull();
    expect(source.getState()).toBe(before);
    intelligence.getState().dispose();
  });

  it('marks retained metrics stale on analysis failure and clears failed simulation results', () => {
    const source = createSourceStore();
    const analyze = vi.fn(analyzeArchitecture);
    const intelligence = createIntelligenceStore(source, analyze);
    const previous = intelligence.getState().analysis;
    analyze.mockImplementationOnce(() => {
      throw new Error('engine failed');
    });
    expect(() => intelligence.getState().runAnalysis()).toThrow(
      'engine failed',
    );
    expect(intelligence.getState().analysis).toBe(previous);
    expect(intelligence.getState().analysisStale).toBe(true);
    intelligence
      .getState()
      .runSimulation({ scope: 'availability-zone', target: 'eu-west-1a' });
    expect(() =>
      intelligence
        .getState()
        .runSimulation({ scope: 'component', target: 'missing' }),
    ).toThrow();
    expect(intelligence.getState().simulation).toBeNull();
    intelligence.getState().dispose();
  });
  it('runs and clears analysis independently from architecture state', () => {
    const architectureStore = createSourceStore();
    const intelligenceStore = createIntelligenceStore(architectureStore);

    expect(intelligenceStore.getState().analysis).toMatchObject({
      estimatedMonthlyCost: 675,
      resilienceScore: 57,
      securityScore: 76,
    });

    intelligenceStore.getState().clearAnalysis();
    expect(intelligenceStore.getState().analysis).toBeNull();

    const analysis = intelligenceStore
      .getState()
      .runAnalysis({ focus: 'resilience' });
    expect(analysis.focus).toBe('resilience');
    expect(intelligenceStore.getState().analysisStale).toBe(false);

    intelligenceStore.getState().dispose();
  });

  it('marks analysis stale and clears simulations after architecture changes', () => {
    const architectureStore = createSourceStore();
    const intelligenceStore = createIntelligenceStore(architectureStore);

    intelligenceStore.getState().runSimulation({
      scope: 'component',
      target: 'ecommerce-ecs',
    });
    expect(intelligenceStore.getState().simulation).not.toBeNull();

    architectureStore
      .getState()
      .renameArchitecture('Revised Ecommerce', 'human');

    expect(intelligenceStore.getState().analysisStale).toBe(true);
    expect(intelligenceStore.getState().simulation).toBeNull();

    const analysis = intelligenceStore.getState().runAnalysis();
    expect(analysis.architectureRevision).toBe(
      architectureStore.getState().architecture.revision,
    );
    expect(intelligenceStore.getState().analysisStale).toBe(false);

    intelligenceStore.getState().dispose();
  });

  it('does not write derived runs into architecture history or project state', () => {
    const architectureStore = createSourceStore();
    const intelligenceStore = createIntelligenceStore(architectureStore);
    const architectureBefore = JSON.stringify(
      architectureStore.getState().architecture,
    );
    const pastBefore = architectureStore.getState().past;
    const activityBefore = architectureStore.getState().activity;

    intelligenceStore.getState().runAnalysis();
    intelligenceStore.getState().runSimulation({
      scope: 'availability-zone',
      target: 'eu-west-1a',
    });

    expect(JSON.stringify(architectureStore.getState().architecture)).toBe(
      architectureBefore,
    );
    expect(architectureStore.getState().past).toBe(pastBefore);
    expect(architectureStore.getState().activity).toBe(activityBefore);

    intelligenceStore.getState().clearSimulation();
    expect(intelligenceStore.getState().simulation).toBeNull();
    intelligenceStore.getState().dispose();
  });
});
