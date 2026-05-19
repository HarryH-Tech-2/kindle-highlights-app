// Theme provider + useTheme() hook.
//
// One preference is persisted in the `meta` key-value table so it survives
// app restarts:
//   - `theme_mode`  → 'light' | 'dark'
//
// Usage:
//   const { colors, mode, setMode, isDark } = useTheme();
//   <View style={{ backgroundColor: colors.bg }} />

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getDb } from '@/src/db/client';
import { getMeta, setMeta } from '@/src/db/meta';
import {
  type ColorTokens,
  type ThemeMode,
  lightColors,
  pickColors,
} from './colors';

const MODE_KEY = 'theme_mode';

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => Promise<void>;
  colors: ColorTokens;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemeMode(v: unknown): v is ThemeMode {
  return v === 'light' || v === 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');

  // Load the persisted preference once on mount. We deliberately don't gate
  // rendering on this — the default is sensible and a brief flash is
  // preferable to a blank screen.
  useEffect(() => {
    (async () => {
      try {
        const db = await getDb();
        const savedMode = await getMeta(db, MODE_KEY);
        if (isThemeMode(savedMode)) setModeState(savedMode);
      } catch {
        // DB not ready yet — fine, we'll stick with the default.
      }
    })();
  }, []);

  const setMode = useCallback(async (next: ThemeMode) => {
    setModeState(next);
    try {
      const db = await getDb();
      await setMeta(db, MODE_KEY, next);
    } catch {
      // Persistence is best-effort; the in-memory state still updates.
    }
  }, []);

  const colors = useMemo(() => pickColors(mode), [mode]);
  const isDark = mode === 'dark';

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, setMode, colors, isDark }),
    [mode, setMode, colors, isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Defensive fallback so screens rendered outside the provider (tests,
    // storybook) still get sane colours instead of crashing.
    return {
      mode: 'light',
      setMode: async () => {},
      colors: lightColors,
      isDark: false,
    };
  }
  return ctx;
}
