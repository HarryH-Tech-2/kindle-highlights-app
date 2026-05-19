// Color tokens for the app's themes.
//
// There are two orthogonal dimensions the user can choose:
//   - `ThemeStyle`  — the aesthetic family ('modern', 'medieval', 'ancient')
//   - `ThemeMode`   — light / dark / follow system
//
// Each (style × brightness) pair yields one `ColorTokens` object. The runtime
// `useTheme()` hook chooses which set to expose based on the saved preferences
// and the OS colour scheme.

export type ColorTokens = {
  // `bg` is intentionally 'transparent' for themes with a background image —
  // the root BackgroundLayer renders the texture + tinted overlay, and screens
  // sit on top of it. Use `bgSolid` instead where a guaranteed opaque colour
  // is required (loading spinners, modals, capture screen, etc.).
  bg: string;
  bgSolid: string;
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
  // Background texture image rendered behind the app, with `bgImageTint`
  // composited over it as a translucent overlay so the image reads as a
  // subtle texture rather than a photo. `null` opts out of the texture.
  bgImage: number | null;
  bgImageOpacity: number; // 0–1, applied to the image itself
  bgImageTint: string;    // overlay colour with alpha (e.g. 'rgba(244,246,250,0.82)')
};

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeStyle = 'modern' | 'medieval' | 'ancient';

// Background texture assets. The same bundled images used by the Beautify
// feature double as ambient theme textures — they're low-opacity behind a
// strong colour overlay so they read as a faint mood rather than imagery.
// Swap these out for purpose-shot textures later if desired.
const TEX = {
  navyMarble: require('@/assets/beautify/Gemini_Generated_Image_6adrhi6adrhi6adr.png'),
  vibrantMarble: require('@/assets/beautify/Gemini_Generated_Image_m0hyvpm0hyvpm0hy.png'),
  pastelMist: require('@/assets/beautify/hf_20260519_140339_c727c971-3473-49b2-98d1-3fde64bf435e.png'),
  watercolor: require('@/assets/beautify/hf_20260519_140619_7b67f963-4d44-4a18-a8c5-079237211831.png'),
  holographic: require('@/assets/beautify/hf_20260519_140845_b2e6471b-c3f7-45df-bf11-338c0386fb1b.png'),
};

// ─── Modern / sci-fi ─────────────────────────────────────────────────────
// Crisp neutrals, electric blue → cyan accents. Light is icy and minimal,
// dark goes deep navy with neon highlights.

const modernLight: ColorTokens = {
  bg: 'transparent',
  bgSolid: '#f4f6fa',
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
  bgImage: TEX.vibrantMarble,
  bgImageOpacity: 0.22,
  bgImageTint: 'rgba(244,246,250,0.82)',
};

const modernDark: ColorTokens = {
  bg: 'transparent',
  bgSolid: '#050811',
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
  bgImage: TEX.navyMarble,
  bgImageOpacity: 0.28,
  bgImageTint: 'rgba(5,8,17,0.78)',
};

// ─── Medieval ────────────────────────────────────────────────────────────
// Parchment, deep burgundy, brass and forest greens. Light reads as a
// monastery scriptorium; dark like a candle-lit hall.

const medievalLight: ColorTokens = {
  bg: 'transparent',
  bgSolid: '#f3e7cc',
  surface: '#fbf3dc',
  surfaceAlt: '#e8d6b1',
  text: '#2a1c10',
  textMuted: '#695234',
  textSubtle: '#9d8460',
  border: '#cdb486',
  primary: '#7a1f1f',
  primaryText: '#fbf3dc',
  accent: '#b8860b',
  danger: '#8b1a1a',
  success: '#4a6b1f',
  overlay: 'rgba(42,28,16,0.55)',
  accentPalette: [
    '#7a1f1f',
    '#4a6b1f',
    '#b8860b',
    '#3b4a6b',
    '#7a4f1f',
    '#5e2a5e',
    '#5a4a3a',
  ],
  bgImage: TEX.watercolor,
  bgImageOpacity: 0.18,
  bgImageTint: 'rgba(243,231,204,0.84)',
};

const medievalDark: ColorTokens = {
  bg: 'transparent',
  bgSolid: '#14100b',
  surface: '#1f1812',
  surfaceAlt: '#2a2018',
  text: '#ead7b0',
  textMuted: '#b09872',
  textSubtle: '#7a6a4e',
  border: '#3b2e22',
  primary: '#d4a44b',
  primaryText: '#14100b',
  accent: '#c2412c',
  danger: '#d63d3d',
  success: '#9ab83a',
  overlay: 'rgba(0,0,0,0.78)',
  accentPalette: [
    '#d4a44b',
    '#c2412c',
    '#9ab83a',
    '#7a8fc5',
    '#c0844d',
    '#a76aa7',
    '#a8a394',
  ],
  bgImage: TEX.navyMarble,
  bgImageOpacity: 0.22,
  bgImageTint: 'rgba(20,16,11,0.82)',
};

// ─── Ancient ─────────────────────────────────────────────────────────────
// Papyrus, terracotta, oxidised copper, sepia ink. Reads as antiquity —
// Egypt / Greece / Rome.

const ancientLight: ColorTokens = {
  bg: 'transparent',
  bgSolid: '#efe6d2',
  surface: '#f7f1df',
  surfaceAlt: '#e3d6b5',
  text: '#2a2419',
  textMuted: '#6e5f47',
  textSubtle: '#a0917a',
  border: '#c9b890',
  primary: '#8b3a2f',
  primaryText: '#f7f1df',
  accent: '#2d6b6b',
  danger: '#6b1f10',
  success: '#5e7a32',
  overlay: 'rgba(42,36,25,0.55)',
  accentPalette: [
    '#8b3a2f',
    '#2d6b6b',
    '#5e7a32',
    '#a07433',
    '#6b4f8a',
    '#3a5878',
    '#7a5230',
  ],
  bgImage: TEX.pastelMist,
  bgImageOpacity: 0.20,
  bgImageTint: 'rgba(239,230,210,0.84)',
};

const ancientDark: ColorTokens = {
  bg: 'transparent',
  bgSolid: '#1a1408',
  surface: '#25200f',
  surfaceAlt: '#2f2a18',
  text: '#e0cfa0',
  textMuted: '#a89570',
  textSubtle: '#6f5e3e',
  border: '#3a3019',
  primary: '#d4a04b',
  primaryText: '#1a1408',
  accent: '#c66143',
  danger: '#d6553f',
  success: '#9eb04a',
  overlay: 'rgba(0,0,0,0.78)',
  accentPalette: [
    '#d4a04b',
    '#c66143',
    '#9eb04a',
    '#6f93a8',
    '#bf8a5e',
    '#a07aab',
    '#b5a37a',
  ],
  bgImage: TEX.holographic,
  bgImageOpacity: 0.18,
  bgImageTint: 'rgba(26,20,8,0.84)',
};

// ─── Lookup ──────────────────────────────────────────────────────────────

const PALETTES: Record<ThemeStyle, { light: ColorTokens; dark: ColorTokens }> = {
  modern: { light: modernLight, dark: modernDark },
  medieval: { light: medievalLight, dark: medievalDark },
  ancient: { light: ancientLight, dark: ancientDark },
};

// Re-exported for any pre-existing consumer that imported lightColors /
// darkColors directly (e.g. tests, fallback paths). They map to the default
// 'modern' style.
export const lightColors = modernLight;
export const darkColors = modernDark;

export function pickColors(
  style: ThemeStyle,
  mode: ThemeMode,
  system: 'light' | 'dark'
): ColorTokens {
  const effective = mode === 'system' ? system : mode;
  return PALETTES[style][effective];
}

// Metadata for the picker UI — kept here so the styles list and the swatch
// previews stay in sync with the actual palettes.
export const STYLE_META: {
  id: ThemeStyle;
  label: string;
  description: string;
}[] = [
  {
    id: 'modern',
    label: 'Modern',
    description: 'Crisp neutrals, electric accents.',
  },
  {
    id: 'medieval',
    label: 'Medieval',
    description: 'Parchment, burgundy, brass.',
  },
  {
    id: 'ancient',
    label: 'Ancient',
    description: 'Papyrus, terracotta, sepia ink.',
  },
];

// Swatch colours used to preview each style in the picker, returned for both
// brightnesses so the preview tracks the current light/dark setting.
export function previewSwatches(
  style: ThemeStyle,
  brightness: 'light' | 'dark'
): { bg: string; surface: string; primary: string; accent: string } {
  const c = PALETTES[style][brightness];
  // Use bgSolid (not c.bg, which is 'transparent') so the swatch is opaque
  // and looks like the actual theme background instead of see-through.
  return { bg: c.bgSolid, surface: c.surface, primary: c.primary, accent: c.accent };
}

// Deterministic accent picker so the same book always gets the same stripe.
export function accentFor(key: string, palette: string[]): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return palette[Math.abs(hash) % palette.length];
}
