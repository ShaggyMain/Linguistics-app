/**
 * SpeakStream — "Radar Night" theme.
 * Deep blue-black surfaces with a warm amber accent, echoing cockpit
 * instruments and radar scopes at night. High contrast for teleprompter
 * readability is the first priority.
 */
export const colors = {
  bg: '#0B0F17',
  surface: '#121927',
  surfaceRaised: '#1A2333',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.16)',

  text: '#F5F7FA',
  textDim: '#8A94A6',
  textFaint: '#5B6474',

  accent: '#FFB454',
  accentSoft: 'rgba(255, 180, 84, 0.14)',
  accentFaint: 'rgba(255, 180, 84, 0.07)',
  onAccent: '#1A1204',

  pilot: '#9FB3C8',
  success: '#7FD88F',
  danger: '#FF6B6B',
} as const;

export const spacing = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  pill: 999,
} as const;

export const type = {
  /** Teleprompter reading text */
  reader: { fontSize: 30, lineHeight: 44, fontWeight: '600' as const },
  readerPilot: { fontSize: 24, lineHeight: 36, fontWeight: '500' as const },
  title: { fontSize: 28, fontWeight: '800' as const },
  h2: { fontSize: 18, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  small: { fontSize: 13, fontWeight: '400' as const },
  label: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 1 },
} as const;
