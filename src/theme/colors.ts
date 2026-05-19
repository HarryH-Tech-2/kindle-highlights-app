// Color tokens for the app's light and dark themes.
//
// `ThemeMode` ('light' | 'dark') drives which `ColorTokens` set
// `useTheme()` returns.

export type ColorTokens = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  border: string;
  primary: string;
  primaryText: string;
  accent: string;
  danger: string;
  success: string;
  overlay: string;
  // Used for the rotating accent stripe on book cards.
  accentPalette: string[];
};

export type ThemeMode = 'light' | 'dark';

export const lightColors: ColorTokens = {
  bg: '#f4f6fa',
  surface: '#ffffff',
  surfaceAlt: '#eaeef5',
  text: '#0a0e1a',
  textMuted: '#475569',
  textSubtle: '#94a3b8',
  border: '#d6dde8',
  primary: '#0066ff',
  primaryText: '#ffffff',
  accent: '#00b8d4',
  danger: '#ff2e5b',
  success: '#00b377',
  overlay: 'rgba(8,16,32,0.55)',
  accentPalette: [
    '#0066ff',
    '#00b8d4',
    '#7c3aff',
    '#ff00aa',
    '#00c896',
    '#ffaa00',
    '#ff3366',
  ],
};

export const darkColors: ColorTokens = {
  bg: '#050811',
  surface: '#0d1220',
  surfaceAlt: '#141b2e',
  text: '#e6edf7',
  textMuted: '#8a9bb5',
  textSubtle: '#5b6b85',
  border: '#1e2842',
  primary: '#22d3ee',
  primaryText: '#050811',
  accent: '#ff3da9',
  danger: '#ff5a7a',
  success: '#3df0a2',
  overlay: 'rgba(0,0,0,0.78)',
  accentPalette: [
    '#22d3ee',
    '#ff3da9',
    '#9d6bff',
    '#3df0a2',
    '#ffb74d',
    '#ff5a7a',
    '#3da6ff',
  ],
};

export function pickColors(mode: ThemeMode): ColorTokens {
  return mode === 'dark' ? darkColors : lightColors;
}

// Deterministic accent picker so the same book always gets the same stripe.
export function accentFor(key: string, palette: string[]): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return palette[Math.abs(hash) % palette.length];
}
