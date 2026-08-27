import { create } from 'zustand';

export const THEME_STORAGE_KEY = 'aethersketch.theme';

export type ThemeMode = 'dark' | 'light';

type ThemeStore = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
};

function readStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'light'
      ? 'light'
      : 'dark';
  } catch {
    return 'dark';
  }
}

function applyTheme(theme: ThemeMode) {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#0a0d12' : '#f8fafc');
}

function persistTheme(theme: ThemeMode) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The selected theme still applies for this session when storage is blocked.
  }
}

const initialTheme = readStoredTheme();
applyTheme(initialTheme);

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: initialTheme,
  setTheme: (theme) => {
    applyTheme(theme);
    persistTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const theme = get().theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    persistTheme(theme);
    set({ theme });
  },
}));
