import { create } from 'zustand';

import type { PaletteCategoryId } from '../components/palette/palette-categories';

export type WorkspacePanel = 'inspector' | 'analysis' | 'simulation';
export type CatalogDescriptionMode = 'aws' | 'generic';
export type WorkspaceNotice = {
  kind: 'success' | 'error' | 'info';
  message: string;
};

export type WorkspaceUiState = {
  activePaletteCategory: PaletteCategoryId;
  catalogDescriptionMode: CatalogDescriptionMode;
  selectedComponentId: string | null;
  selectedConnectionId: string | null;
  activePanel: WorkspacePanel;
  focusRequest: number;
  activityOpen: boolean;
  notice: WorkspaceNotice | null;
  setActivePaletteCategory: (category: PaletteCategoryId) => void;
  setCatalogDescriptionMode: (mode: CatalogDescriptionMode) => void;
  selectComponent: (componentId: string | null) => void;
  focusComponent: (componentId: string) => void;
  selectConnection: (connectionId: string | null) => void;
  clearSelection: () => void;
  setActivePanel: (panel: WorkspacePanel) => void;
  setActivityOpen: (open: boolean) => void;
  setNotice: (notice: WorkspaceNotice | null) => void;
};

export const useWorkspaceUiStore = create<WorkspaceUiState>((set) => ({
  activePaletteCategory: 'network',
  catalogDescriptionMode: 'generic',
  selectedComponentId: null,
  selectedConnectionId: null,
  activePanel: 'inspector',
  focusRequest: 0,
  activityOpen: false,
  notice: null,

  setActivePaletteCategory: (activePaletteCategory) =>
    set({ activePaletteCategory }),
  setCatalogDescriptionMode: (catalogDescriptionMode) =>
    set({ catalogDescriptionMode }),
  selectComponent: (selectedComponentId) =>
    set({ selectedComponentId, selectedConnectionId: null }),
  focusComponent: (selectedComponentId) =>
    set((state) => ({
      selectedComponentId,
      selectedConnectionId: null,
      focusRequest: state.focusRequest + 1,
    })),
  selectConnection: (selectedConnectionId) =>
    set({ selectedConnectionId, selectedComponentId: null }),
  clearSelection: () =>
    set({ selectedComponentId: null, selectedConnectionId: null }),
  setActivePanel: (activePanel) => set({ activePanel }),
  setActivityOpen: (activityOpen) => set({ activityOpen }),
  setNotice: (notice) => set({ notice }),
}));
