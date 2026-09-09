// Ported from the reference prototype's Tailwind config
// (C:\Users\visma\Kiwi bytes\S.D.Computronix_Proto\index.html), then given a
// dark variant and a refreshed, more vibrant light one. See ColorScheme's own
// comment for the strategy that made that possible without touching the ~140
// call sites already reading `colors.someKey` throughout the app.

export type Brand = {
  50: string; 100: string; 200: string; 300: string; 400: string;
  500: string; 600: string; 700: string; 800: string; 900: string;
};

/**
 * Every screen was built against ONE flat, always-light `colors` object.
 * Introducing dark mode without rewriting every one of the ~140 call sites
 * that read `colors.someKey` meant keeping every key name exactly as it was
 * and giving each one a light value and a dark value instead — never
 * renaming, only re-pointing.
 *
 * That produces some names that read oddly in isolation -- `bgLight` holds a
 * near-black value under the dark scheme, `brand[700]` is brightened there
 * rather than staying the deep blue it is in light mode. Both are
 * deliberate: `bgLight`/`textLight` describe the ROLE a decade of call sites
 * already agreed on (screen background, primary text), not a literal
 * lightness; and a saturated `brand[700]` that reads as a crisp primary
 * button on a white card goes muddy on a near-black one, so dark mode's
 * ramp is brightened a step so the SAME key still reads as "the" accent
 * colour wherever it is used, without the call site knowing the difference.
 */
export type ColorScheme = {
  brand: Brand;
  success: string; successBg: string; successText: string;
  danger: string; dangerBg: string; dangerText: string;
  warning: string; warningBg: string; warningText: string;
  /** The kudos badge's violet and Home's "on shift" hero green -- two
   *  one-off accents that used to be hand-typed hex in three different
   *  screens. Named for what they mark, not their hue, for the same reason
   *  everything else here is. */
  accentViolet: string; accentVioletBg: string;
  heroActive: string;
  /** The hero card's OFF state -- always a dark navy card carrying white
   *  text, in both schemes, the same way heroActive is always a colour
   *  carrying white text. It used to borrow `slate800`, which happened to be
   *  dark navy in light mode -- until the neutral ramp inverted for dark
   *  mode and slate800 became near-white, putting white hero text on a
   *  near-white card. A themed neutral was never the right source for a
   *  card that is not neutral; it needed its own token. */
  heroInactive: string;
  bgLight: string; bgDark: string;
  textLight: string; textDark: string;
  slate50: string; slate100: string; slate200: string; slate300: string; slate400: string;
  slate500: string; slate600: string; slate700: string; slate800: string; slate900: string;
  /** A raised card/input/outline-button's OWN background -- white paper on
   *  light glass, a dark panel on dark glass. This is the one role that
   *  needed a genuinely new key rather than a re-pointed old one: `white`
   *  already meant something else everywhere (see below) and the two could
   *  not both keep that name once dark mode had to make them diverge. */
  surface: string;
  /** True white, unaffected by scheme -- text and icons drawn ON a
   *  deliberately-coloured surface (a primary button, a status badge, the
   *  shift hero card, an avatar's initials on its gradient) rather than on
   *  the theme's own neutral background. Those surfaces are already chosen
   *  to read against white in both modes, same as `black` below is for a
   *  literal letterbox (camera screens) that wants darkness regardless of
   *  theme, not "the current background". */
  white: string;
  black: string;
  /** The colour-scheme name this object answers for, so a component that
   *  branches on scheme (an icon that swaps glyph, not just colour) does not
   *  need a second source of truth for which one is active. */
  scheme: 'light' | 'dark';
};

const brandLight: Brand = {
  50: '#EEF2FF', 100: '#E0E7FF', 200: '#C7D2FE', 300: '#A5B4FC', 400: '#818CF8',
  500: '#4F63E6', 600: '#3B4FD9', 700: '#1E40AF', 800: '#1E3A8A', 900: '#172554',
};

// NOT the same ramp shifted brighter -- an earlier version of this was, and
// it put white button text on #A5B4FC (a pale lavender, ~2:1 contrast,
// visibly unreadable). [700] is the one value nearly every solid-fill
// button, active tab and icon-on-tint in the app draws from
// (buttonPrimary in ui.tsx), so it is fixed FIRST, checked against WCAG AA
// for white text (4.5:1), and the rest of the ramp built around it:
//   #4F63E6 (brandLight's own [500], so the dark scheme's primary is the
//   same hue family, not an unrelated blue) computes to ~5.05:1 against
//   white -- comfortably over the 4.5:1 line -- while still reading as a
//   vivid, saturated accent against a near-black screen rather than the
//   deep navy [700] is in light mode, which would go muddy there.
const brandDark: Brand = {
  50: '#12172E', 100: '#181F3F', 200: '#202A56', 300: '#293674', 400: '#334494',
  500: '#3B4FD9', 600: '#4459E0', 700: '#4F63E6', 800: '#818CF8', 900: '#C7D2FE',
};

export const lightColors: ColorScheme = {
  brand: brandLight,
  success: '#0EA968', successBg: '#E7F9F1', successText: '#0B7A4C',
  danger: '#E63757', dangerBg: '#FFEAEE', dangerText: '#B3123A',
  warning: '#F0930C', warningBg: '#FFF3DF', warningText: '#B45309',
  accentViolet: '#7C3AED', accentVioletBg: '#F1E9FE',
  heroActive: '#0F9D58',
  heroInactive: '#1E293B',
  bgLight: '#F3F4FA',
  bgDark: '#0B0F1A',
  textLight: '#0F172A',
  textDark: '#E9ECF5',
  slate50: '#F8FAFC', slate100: '#F1F5F9', slate200: '#E2E8F0', slate300: '#CBD5E1', slate400: '#94A3B8',
  slate500: '#64748B', slate600: '#475569', slate700: '#334155', slate800: '#1E293B', slate900: '#0F172A',
  surface: '#FFFFFF',
  white: '#FFFFFF',
  black: '#000000',
  scheme: 'light',
};

export const darkColors: ColorScheme = {
  brand: brandDark,
  success: '#34D399', successBg: '#0E2B22', successText: '#6EE7B7',
  danger: '#FB7185', dangerBg: '#3A1420', dangerText: '#FDA4AF',
  warning: '#FBBF24', warningBg: '#3A2A0C', warningText: '#FCD34D',
  accentViolet: '#A78BFA', accentVioletBg: '#2C2153',
  heroActive: '#1FB874',
  // Same navy as the light scheme, deliberately -- see ColorScheme's comment
  // on heroInactive. It is lighter than this scheme's own screen background
  // (bgLight, below, is near-black), which is what makes it still read as a
  // raised card rather than disappearing into the screen behind it.
  heroInactive: '#1E293B',
  // The role, not the literal shade: "the screen background" is near-black.
  bgLight: '#0B0F1A',
  bgDark: '#141A2A',
  textLight: '#EEF1F8',
  textDark: '#141A2A',
  // The neutral ramp inverts: slate50 was "barely-there light grey", the
  // colour a card or a divider sits on; under dark mode that role is a
  // near-black, and slate900 -- "ink", the darkest text -- becomes the
  // near-white that reads as primary text on that near-black. Everything in
  // between walks the same direction, so a `slate400` muted caption is still
  // visibly a step down from `slate200` body text either way.
  slate50: '#141A2A', slate100: '#1B2333', slate200: '#28324A', slate300: '#3A4560', slate400: '#5B677E',
  slate500: '#8A94AA', slate600: '#AEB7C9', slate700: '#C9D0DE', slate800: '#E4E8F0', slate900: '#F5F7FB',
  // A step lighter than the screen background, so a card still reads as
  // RAISED rather than blending into it -- reusing slate50 here (near-black,
  // same as the screen) would have made every card invisible as a shape.
  surface: '#1B2333',
  white: '#FFFFFF',
  black: '#000000',
  scheme: 'dark',
};

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

// Kept for the handful of call sites mid-migration to useThemeStore (see
// src/stores/themeStore.ts) that have not yet been converted -- always the
// light scheme, exactly today's pre-dark-mode behaviour, so an unconverted
// screen degrades to "always light" rather than to a crash or an undefined
// colour. Do not add new imports of this; use useThemeStore(s => s.colors).
export const colors = lightColors;
export const brand = brandLight;
