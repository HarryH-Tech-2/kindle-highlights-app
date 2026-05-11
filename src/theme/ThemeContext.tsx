// Theme provider + useTheme() hook. Persists the user's mode preference in
// the existing `meta` key-value table so it survives app restarts. The
// effective color set is derived from (saved mode) × (system colorScheme).
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
import { useColorScheme } from 'react-native';
import { getDb } from '@/src/db/client';
import { getMeta, setMeta } from '@/src/db/meta';
import {
  type ColorTokens,
  type ThemeMode,
  darkColors,
  lightColors,
  pickColors,
} from './colors';

const THEME_KEY = 'theme_mode';

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => Promise<void>;
  colors: ColorTokens;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [mode, setModeState] = useState<ThemeMode>('system');

  // Load persisted mode once on mount. We deliberately don't gate rendering on
  // this — the default ('system') is a sensible starting point and a brief
  // flash is preferable to a blank screen.
  useEffect(() => {
    (async () => {
      try {
        const db = await getDb();
        const saved = await getMeta(db, THEME_KEY);
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setModeState(saved);
        }
      } catch {
        // DB not ready yet — fine, we'll stick with the default.
      }
    })();
  }, []);

  const setMode = useCallback(async (next: ThemeMode) => {
    setModeState(next);
    try {
      const db = await getDb();
      await setMeta(db, THEME_KEY, next);
    } catch {
      // Persistence is best-effort; the in-memory state still updates.
    }
  }, []);

  const colors = useMemo(() => pickColors(mode, system), [mode, system]);
  const isDark = colors === darkColors || (mode === 'dark') || (mode === 'system' && system === 'dark');

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
    // storybook) still get sane colors instead of crashing.
    return {
      mode: 'light',
      setMode: async () => {},
      colors: lightColors,
      isDark: false,
    };
  }
  return ctx;
}
