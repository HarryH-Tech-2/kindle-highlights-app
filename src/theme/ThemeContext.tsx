// Theme provider + useTheme() hook.
//
// Two orthogonal preferences are persisted in the `meta` key-value table so
// they survive app restarts:
//   - `theme_mode`  → 'light' | 'dark' | 'system'
//   - `theme_style` → 'modern' | 'medieval' | 'ancient'
//
// The effective ColorTokens object is derived from
//   (saved style) × (saved mode) × (OS colorScheme).
//
// Usage:
//   const { colors, mode, setMode, style, setStyle, isDark } = useTheme();
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
  type ThemeStyle,
  lightColors,
  pickColors,
} from './colors';

const MODE_KEY = 'theme_mode';
const STYLE_KEY = 'theme_style';

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => Promise<void>;
  style: ThemeStyle;
  setStyle: (style: ThemeStyle) => Promise<void>;
  colors: ColorTokens;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemeMode(v: unknown): v is ThemeMode {
  return v === 'light' || v === 'dark' || v === 'system';
}
function isThemeStyle(v: unknown): v is ThemeStyle {
  return v === 'modern' || v === 'medieval' || v === 'ancient';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [style, setStyleState] = useState<ThemeStyle>('modern');

  // Load both persisted preferences once on mount. We deliberately don't gate
  // rendering on this — the defaults are sensible starting points and a brief
  // flash is preferable to a blank screen.
  useEffect(() => {
    (async () => {
      try {
        const db = await getDb();
        const [savedMode, savedStyle] = await Promise.all([
          getMeta(db, MODE_KEY),
          getMeta(db, STYLE_KEY),
        ]);
        if (isThemeMode(savedMode)) setModeState(savedMode);
        if (isThemeStyle(savedStyle)) setStyleState(savedStyle);
      } catch {
        // DB not ready yet — fine, we'll stick with the defaults.
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

  const setStyle = useCallback(async (next: ThemeStyle) => {
    setStyleState(next);
    try {
      const db = await getDb();
      await setMeta(db, STYLE_KEY, next);
    } catch {
      // Persistence is best-effort; the in-memory state still updates.
    }
  }, []);

  const colors = useMemo(
    () => pickColors(style, mode, system),
    [style, mode, system]
  );
  const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, setMode, style, setStyle, colors, isDark }),
    [mode, setMode, style, setStyle, colors, isDark]
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
      style: 'modern',
      setStyle: async () => {},
      colors: lightColors,
      isDark: false,
    };
  }
  return ctx;
}
