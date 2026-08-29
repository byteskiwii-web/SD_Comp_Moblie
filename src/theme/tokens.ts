// Ported from the reference prototype's Tailwind config
// (C:\Users\visma\Kiwi bytes\S.D.Computronix_Proto\index.html)
// so the native app matches the agreed visual language.

export const brand = {
  50: '#EEF2FF',
  100: '#E0E7FF',
  200: '#C7D2FE',
  300: '#A5B4FC',
  400: '#818CF8',
  500: '#4F63E6',
  600: '#3B4FD9',
  700: '#1E40AF',
  800: '#1E3A8A',
  900: '#172554',
} as const;

export const colors = {
  brand,
  success: '#10B981',
  successBg: '#ECFDF5',
  danger: '#F43F5E',
  dangerBg: '#FFF1F2',
  warning: '#F59E0B',
  warningBg: '#FFFBEB',
  bgLight: '#F1F3F8',
  bgDark: '#0B0F1A',
  textLight: '#0F172A',
  textDark: '#E2E8F0',
  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate300: '#CBD5E1',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1E293B',
  slate900: '#0F172A',
  white: '#FFFFFF',
} as const;

export const fonts = {
  sans: 'System', // Plus Jakarta Sans requires a bundled font file; using system font until one is added
  mono: 'Courier', // JetBrains Mono equivalent placeholder until a monospace font file is bundled
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const spacing = (n: number) => n * 4;
