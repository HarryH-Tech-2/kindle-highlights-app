// Color + typography tokens for the app's light and dark themes.
//
// The visual brand is "Lumio": a memory companion for readers built
// around violet light and clarity. Light mode is ivory with violet
// accents. Dark mode is midnight with glowing violet.
//
// `ThemeMode` ('light' | 'dark') drives which `ColorTokens` set
// `useTheme()` returns. Typography is platform-aware and lives in
// `fonts` (not theme-dependent).

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

// Space Grotesk (geometric, modern sans) for headings, display copy, and
// highlight bodies; Inter (utility sans) for chrome and small UI text. The
// fonts are loaded centrally in `app/_layout.tsx` via `useFonts`, so
// referring to them by family name here works once the app is mounted.
//
// We expose a few weights so callers can pick without recreating the
// `fontWeight` dance — `fontFamily` alone selects the variant on RN.
export const fonts = {
  // Body — clean geometric sans that reads well at small sizes.
  serif: 'SpaceGrotesk_500Medium',
  // "Italic" slot — Space Grotesk has no italic, so we use the light
  // weight for the floating quote particles (softer, more ethereal).
  serifItalic: 'SpaceGrotesk_300Light',
  // Display weight for hero titles and book covers.
  display: 'SpaceGrotesk_700Bold',
  // Default sans for chrome / tab labels / small UI text.
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemibold: 'Inter_600SemiBold',
};

// Font options users can pick for individual saved highlights.
// Each key is persisted in the `style.font` JSON field; the `family` is
// the React Native fontFamily string loaded in _layout.tsx.
export type FontOption = {
  key: string;
  label: string;
  family: string;
};

export const FONT_OPTIONS: FontOption[] = [
  { key: 'default', label: 'Modern', family: 'SpaceGrotesk_500Medium' },
  { key: 'inter', label: 'Clean', family: 'Inter_400Regular' },
  { key: 'lora', label: 'Serif', family: 'Lora_400Regular' },
  { key: 'playfair', label: 'Elegant', family: 'PlayfairDisplay_400Regular' },
  { key: 'mono', label: 'Mono', family: 'JetBrainsMono_400Regular' },
  { key: 'source', label: 'Code', family: 'SourceCodePro_400Regular' },
];

// Resolve a persisted font key to a fontFamily string.
export function fontFamilyFor(key: string | null | undefined): string {
  if (!key || key === 'default') return fonts.serif;
  const opt = FONT_OPTIONS.find((f) => f.key === key);
  return opt?.family ?? fonts.serif;
}

export const lightColors: ColorTokens = {
  // Ivory light — clean, airy, and slightly warm.
  bg: '#F8F7FC',
  // Slightly brighter than bg so cards float above the page.
  surface: '#ffffff',
  // A shade darker than bg for inset chrome (search bar, tab bar inactive).
  surfaceAlt: '#EEEDF5',
  // Near-black text for readability on ivory.
  text: '#1a1a2e',
  textMuted: '#6B7280',
  textSubtle: '#9CA3AF',
  // Borders are barely there — soft dividers, not hard lines.
  border: '#E5E4ED',
  // Lumio Violet — the brand's primary saturated color.
  primary: '#6E63FF',
  primaryText: '#ffffff',
  // Lavender accent for emphasis (used sparingly).
  accent: '#B9A7FF',
  danger: '#EF4444',
  success: '#22C55E',
  overlay: 'rgba(11,11,15,0.5)',
  shadow: '#1a1a2e',
  // Very faint lavender for the giant " behind highlight text.
  quoteGlyph: '#E5E4ED',
  // Violet-family accent palette for book stripes.
  accentPalette: [
    '#6E63FF', // lumio violet (brand)
    '#B9A7FF', // lavender
    '#8B7CF6', // mid violet
    '#6366F1', // indigo
    '#A78BFA', // soft purple
    '#7C3AED', // deep violet
    '#4F46E5', // cobalt violet
  ],
};

export const darkColors: ColorTokens = {
  // Midnight — deep, near-black with a cool violet undertone.
  bg: '#0B0B0F',
  surface: '#16161F',
  surfaceAlt: '#1E1E2A',
  text: '#F8F7FC',
  textMuted: '#9CA3AF',
  textSubtle: '#6B7280',
  border: '#2A2A3A',
  // Lumio Violet — glowing against dark backgrounds.
  primary: '#6E63FF',
  primaryText: '#F8F7FC',
  // Lavender mist for accent use.
  accent: '#B9A7FF',
  danger: '#F87171',
  success: '#4ADE80',
  overlay: 'rgba(0,0,0,0.7)',
  shadow: '#000000',
  quoteGlyph: '#1E1E2A',
  accentPalette: [
    '#6E63FF', // lumio violet
    '#B9A7FF', // lavender
    '#8B7CF6', // mid violet
    '#818CF8', // indigo light
    '#A78BFA', // soft purple
    '#C4B5FD', // pale violet
    '#7C3AED', // deep violet
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
