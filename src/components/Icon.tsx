import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useThemeStore } from '../stores/themeStore';

// Ported verbatim (path/shape data only) from the reference prototype's
// Icon component (C:\Users\visma\Kiwi bytes\S.D.Computronix_Proto\js\utils.jsx)
// so icons here match the prototype exactly, just re-expressed for
// react-native-svg instead of raw web SVG.
export type IconName =
  | 'phone' | 'mail' | 'building' | 'clock' | 'shield' | 'file' | 'wallet'
  | 'calendar' | 'logout' | 'home' | 'target' | 'user' | 'bell' | 'x';

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 18, color, strokeWidth = 1.75 }: IconProps) {
  // Theme-store default rather than the old static import: most callers pass
  // their own colour explicitly, but the few that rely on the default (a
  // muted slate) need it to actually be the current theme's muted slate, not
  // whichever scheme happened to be active when this module first loaded.
  const defaultColor = useThemeStore((s) => s.colors.slate400);
  const resolved = color ?? defaultColor;
  const p = { stroke: resolved, strokeWidth, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  const shape: Record<IconName, React.ReactNode> = {
    phone: (
      <Path
        d="M22 16.9v3a2 2 0 0 1-2.2 2 20 20 0 0 1-8.6-3 20 20 0 0 1-6-6 20 20 0 0 1-3-8.6A2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7 12 12 0 0 0 .7 2.8 2 2 0 0 1-.5 2L8 9.5a16 16 0 0 0 6 6l1-1.2a2 2 0 0 1 2-.5 12 12 0 0 0 2.8.7A2 2 0 0 1 22 16.9Z"
        {...p}
      />
    ),
    mail: (
      <>
        <Rect x="3" y="5" width="18" height="14" rx="2" {...p} />
        <Path d="m3 7 9 6 9-6" {...p} />
      </>
    ),
    building: (
      <>
        <Rect x="4" y="3" width="16" height="18" rx="1" {...p} />
        <Path d="M8 7h2M8 11h2M8 15h2M14 7h2M14 11h2M14 15h2M10 21v-4h4v4" {...p} />
      </>
    ),
    clock: (
      <>
        <Circle cx="12" cy="12" r="9" {...p} />
        <Path d="M12 7v5l3 2" {...p} />
      </>
    ),
    shield: (
      <>
        <Path d="M12 3 4 6v6c0 5 4 8 8 9 4-1 8-4 8-9V6l-8-3Z" {...p} />
        <Path d="m9 12 2 2 4-4" {...p} />
      </>
    ),
    file: (
      <>
        <Path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z" {...p} />
        <Path d="M14 3v6h6" {...p} />
      </>
    ),
    wallet: (
      <>
        <Rect x="3" y="6" width="18" height="14" rx="2" {...p} />
        <Path d="M3 10h18M16 15h2" {...p} />
      </>
    ),
    calendar: (
      <>
        <Rect x="3" y="5" width="18" height="16" rx="2" {...p} />
        <Path d="M8 3v4M16 3v4M3 10h18" {...p} />
      </>
    ),
    logout: <Path d="M15 12H3M8 7l-5 5 5 5M20 4v16" {...p} />,
    home: (
      <>
        <Path d="M3 11 12 4l9 7" {...p} />
        <Path d="M5 10v10h14V10" {...p} />
      </>
    ),
    target: (
      <>
        <Circle cx="12" cy="12" r="9" {...p} />
        <Circle cx="12" cy="12" r="5" {...p} />
        <Circle cx="12" cy="12" r="1" {...p} />
      </>
    ),
    user: (
      <>
        <Circle cx="12" cy="8" r="4" {...p} />
        <Path d="M4 21a8 8 0 0 1 16 0" {...p} />
      </>
    ),
    bell: (
      <>
        <Path d="M6 8a6 6 0 1 1 12 0c0 6 2 8 2 8H4s2-2 2-8Z" {...p} />
        <Path d="M10 20a2 2 0 0 0 4 0" {...p} />
      </>
    ),
    x: <Path d="M6 6l12 12M18 6 6 18" {...p} />,
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {shape[name]}
    </Svg>
  );
}
