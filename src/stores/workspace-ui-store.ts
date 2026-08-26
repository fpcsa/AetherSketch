import { create } from 'zustand';

import type { PaletteCategoryId } from '../components/palette/palette-categories';

type WorkspaceUiState = {
  activePaletteCategory: PaletteCategoryId;
  setActivePaletteCategory: (category: PaletteCategoryId) => void;
};

export const useWorkspaceUiStore = create<WorkspaceUiState>((set) => ({
  activePaletteCategory: 'network',
  setActivePaletteCategory: (activePaletteCategory) =>
    set({ activePaletteCategory }),
}));
