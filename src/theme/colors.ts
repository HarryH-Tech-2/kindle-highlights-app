// Color + typography tokens for the app's light and dark themes.
//
// The visual brand is "paper": a reading app that should feel like a
// well-bound notebook, not a SaaS dashboard. Light mode is warm cream
// with ink black + a single muted forest accent. Dark mode is a library
// at night — deep ink blue, cream text, brass accent.
//
// `ThemeMode` ('light' | 'dark') drives which `ColorTokens` set
// `useTheme()` returns. Typography is platform-aware and lives in
// `fonts` (not theme-dependent).

import { Platform } from 'react-native';

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
  // Soft elevation shadow color (use with low opacity).
  shadow: string;
  // A very faint paper-ish quote-glyph tint, used for the ornamental "
  // behind highlight cards.
  quoteGlyph: string;
  // Used for the rotating accent stripe on book cards.
  accentPalette: string[];
};

export type ThemeMode = 'light' | 'dark';

// Platform-aware serif. iOS gets Georgia (looks great at body sizes);
// Android falls back to Noto Serif via the generic 'serif' family.
// Sans uses the system default, which is San Francisco / Roboto.
export const fonts = {
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' })!,
  // For italics on Android the generic family handles the variant; on iOS
  // Georgia has a proper italic.
  sans: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' })!,
};

export const lightColors: ColorTokens = {
  // Warm paper. Off-white with the faintest cream so it doesn't read as
  // institutional gray-white.
  bg: '#f5efe4',
  // Slightly brighter than bg so cards float above the page.
  surface: '#fbf6ec',
  // A shade darker than bg for inset chrome (search bar, tab bar inactive).
  surfaceAlt: '#ece3d2',
  // Deep ink — pure black is too harsh against cream.
  text: '#1c1a17',
  textMuted: '#6b6357',
  textSubtle: '#a89e8c',
  // Borders are barely there — paper edges, not UI dividers.
  border: '#e3d9c5',
  // Muted forest. The only saturated color on the page by default.
  primary: '#3f6b4d',
  primaryText: '#fbf6ec',
  // Oxblood accent for emphasis (used very sparingly).
  accent: '#8a3a2e',
  danger: '#a23b32',
  success: '#4e7a4e',
  overlay: 'rgba(28,26,23,0.5)',
  shadow: '#1c1a17',
  // Very faint warm tan for the giant " behind highlight text.
  quoteGlyph: '#e3d9c5',
  // Desaturated, paper-friendly accent palette for book stripes. These are
  // tonally similar enough that they sit on the page instead of fighting it.
  accentPalette: [
    '#3f6b4d', // forest
    '#8a3a2e', // oxblood
    '#7a6a3e', // mustard
    '#3e5c7a', // dusty blue
    '#6b4a7a', // muted plum
    '#a87642', // burnt amber
    '#4d6b6b', // slate teal
  ],
};

export const darkColors: ColorTokens = {
  // Library at night — deep blue-black, slightly warmer than pure neutral
  // so it reads as ambient lamp light not a code editor.
  bg: '#11131a',
  surface: '#1a1d27',
  surfaceAlt: '#222632',
  text: '#ebe3d2',
  textMuted: '#9a9080',
  textSubtle: '#5e5749',
  border: '#2a2e3a',
  // Brass — warm, antiqued, evocative of a reading lamp.
  primary: '#c4a574',
  primaryText: '#11131a',
  // Soft burgundy for sparing accent use.
  accent: '#c87a6e',
  danger: '#d57068',
  success: '#8fb38a',
  overlay: 'rgba(0,0,0,0.7)',
  shadow: '#000000',
  quoteGlyph: '#23272f',
  accentPalette: [
    '#c4a574', // brass
    '#c87a6e', // burgundy
    '#9aa66e', // sage
    '#7aa0c4', // moonlight blue
    '#b58fc4', // dusk lilac
    '#d4a06e', // amber
    '#88b8b8', // patina teal
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
