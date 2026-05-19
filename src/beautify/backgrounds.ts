// Backgrounds available in the beautify flow.
//
// Two kinds:
//   - 'gradient': two-stop linear gradient (renders with expo-linear-gradient)
//   - 'photo':    a bundled PNG/JPG from assets/beautify
//
// Each background carries a `textColor` ('light' | 'dark') describing which
// text color reads best on it. Photos use a dark scrim regardless so light
// text always pops, but we still keep the field to make swapping easy.

export type GradientBackground = {
  kind: 'gradient';
  id: string;
  colors: readonly [string, string, ...string[]];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  textColor: 'light' | 'dark';
};

export type PhotoBackground = {
  kind: 'photo';
  id: string;
  source: number; // require()'d asset
  textColor: 'light' | 'dark';
};

export type Background = GradientBackground | PhotoBackground;

export const GRADIENTS: GradientBackground[] = [
  {
    kind: 'gradient',
    id: 'sunset',
    colors: ['#f97316', '#db2777', '#7c3aed'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    textColor: 'light',
  },
  {
    kind: 'gradient',
    id: 'ocean',
    colors: ['#0ea5e9', '#1e3a8a'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    textColor: 'light',
  },
  {
    kind: 'gradient',
    id: 'forest',
    colors: ['#064e3b', '#10b981'],
    start: { x: 0, y: 1 },
    end: { x: 1, y: 0 },
    textColor: 'light',
  },
  {
    kind: 'gradient',
    id: 'aurora',
    colors: ['#312e81', '#9333ea', '#ec4899'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    textColor: 'light',
  },
  {
    kind: 'gradient',
    id: 'sand',
    colors: ['#fef3c7', '#f5d0a3', '#c2410c'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    textColor: 'dark',
  },
  {
    kind: 'gradient',
    id: 'mono',
    colors: ['#0f172a', '#334155'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    textColor: 'light',
  },
  {
    kind: 'gradient',
    id: 'paper',
    colors: ['#fafaf9', '#e7e5e4'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    textColor: 'dark',
  },
  {
    kind: 'gradient',
    id: 'rose',
    colors: ['#fda4af', '#be123c'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    textColor: 'light',
  },
];

// Bundled photo backgrounds. Add a new line + require() if you drop a new
// image into assets/beautify.
export const PHOTOS: PhotoBackground[] = [
  {
    kind: 'photo',
    id: 'photo-1',
    source: require('../../assets/beautify/Gemini_Generated_Image_6adrhi6adrhi6adr.png'),
    textColor: 'light',
  },
  {
    kind: 'photo',
    id: 'photo-2',
    source: require('../../assets/beautify/Gemini_Generated_Image_m0hyvpm0hyvpm0hy.png'),
    textColor: 'light',
  },
  {
    kind: 'photo',
    id: 'photo-3',
    source: require('../../assets/beautify/hf_20260519_140339_c727c971-3473-49b2-98d1-3fde64bf435e.png'),
    textColor: 'light',
  },
  {
    kind: 'photo',
    id: 'photo-4',
    source: require('../../assets/beautify/hf_20260519_140619_7b67f963-4d44-4a18-a8c5-079237211831.png'),
    textColor: 'light',
  },
  {
    kind: 'photo',
    id: 'photo-5',
    source: require('../../assets/beautify/hf_20260519_140845_b2e6471b-c3f7-45df-bf11-338c0386fb1b.png'),
    textColor: 'light',
  },
];

export const ALL_BACKGROUNDS: Background[] = [...PHOTOS, ...GRADIENTS];
