// Color tokens for light + dark themes.
//
// Kept as plain objects so we can reference them at module scope (in tests,
// or when building one-off styled elements outside React). The runtime
// `useTheme()` hook chooses which set to expose based on user preference.

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

export const lightColors: ColorTokens = {
  bg: '#fafafa',
  surface: '#ffffff',
  surfaceAlt: '#f3f3f5',
  text: '#111114',
  textMuted: '#555560',
  textSubtle: '#8a8a94',
  border: '#e6e6ec',
  primary: '#3b3bff',
  primaryText: '#ffffff',
  accent: '#ff7a59',
  danger: '#d62b3a',
  success: '#1ea672',
  overlay: 'rgba(15,15,30,0.5)',
  accentPalette: ['#ff7a59', '#3b3bff', '#1ea672', '#d62b3a', '#b557ff', '#0099d6', '#f5a524'],
};

export const darkColors: ColorTokens = {
  bg: '#0d0d12',
  surface: '#16161d',
  surfaceAlt: '#1f1f29',
  text: '#f3f3f8',
  textMuted: '#a8a8b3',
  textSubtle: '#6b6b78',
  border: '#2a2a35',
  primary: '#7a7aff',
  primaryText: '#0d0d12',
  accent: '#ff9b80',
  danger: '#ff5a6a',
  success: '#4adfa6',
  overlay: 'rgba(0,0,0,0.6)',
  accentPalette: ['#ff9b80', '#7a7aff', '#4adfa6', '#ff5a6a', '#cc8aff', '#5cc7f5', '#ffc04d'],
};

export type ThemeMode = 'light' | 'dark' | 'system';

export function pickColors(mode: ThemeMode, system: 'light' | 'dark'): ColorTokens {
  if (mode === 'system') return system === 'dark' ? darkColors : lightColors;
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
