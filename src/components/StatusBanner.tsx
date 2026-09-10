import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ColorScheme, radii } from '../theme/tokens';
import { useThemeStore } from '../stores/themeStore';

export type BannerTone = 'ok' | 'warn' | 'bad' | 'muted';

/**
 * A tinted line of status: an icon, a fact, and optionally the detail behind it.
 *
 * Two of these stack at the top of the punch screen — whether the server is
 * reachable, and whether the employee is inside the fence — because those are
 * the two things that decide whether a punch will land cleanly, and both are
 * worth knowing BEFORE the camera opens rather than after.
 *
 * Tone carries meaning, not decoration: green is "this will work", amber is
 * "this will still work but somebody has to approve it", red is "this will
 * not work". Nothing here is tinted merely to look finished.
 */
export function StatusBanner({
  tone,
  icon,
  title,
  detail,
}: {
  tone: BannerTone;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail?: string | null;
}) {
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  const palette = {
    ok: { bg: colors.successBg, fg: colors.successText, icon: colors.success },
    warn: { bg: colors.warningBg, fg: colors.warningText, icon: colors.warning },
    bad: { bg: colors.dangerBg, fg: colors.dangerText, icon: colors.danger },
    muted: { bg: colors.slate50, fg: colors.slate600, icon: colors.slate400 },
  }[tone];

  return (
    <View style={[styles.row, { backgroundColor: palette.bg }]}>
      <Ionicons name={icon} size={17} color={palette.icon} />
      <View style={styles.text}>
        <Text style={[styles.title, { color: palette.fg }]} numberOfLines={1}>
          {title}
        </Text>
        {detail ? (
          <Text style={[styles.detail, { color: palette.fg }]} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: radii.md,
    },
    text: { flex: 1 },
    title: { fontSize: 12.5, fontWeight: '700' },
    // Slightly transparent rather than a second colour: it is the same
    // statement continued, not a different kind of information.
    detail: { fontSize: 11, fontWeight: '500', marginTop: 2, opacity: 0.85 },
  });
