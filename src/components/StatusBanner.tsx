import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
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
 *
 * `action` puts the fix inside the problem. It used to sit underneath as a
 * bare text link, detached from the banner it belonged to and easy to read as
 * part of whatever came next.
 *
 * Nothing is truncated. The detail is usually the instruction -- which
 * setting to change, where -- and "Open Settings › Privacy & Security ›
 * Location Servi…" is an instruction nobody can follow.
 */
export function StatusBanner({
  tone,
  icon,
  title,
  detail,
  action,
}: {
  tone: BannerTone;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail?: string | null;
  action?: { label: string; onPress: () => void; busy?: boolean } | null;
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
      <Ionicons name={icon} size={17} color={palette.icon} style={styles.icon} />
      <View style={styles.text}>
        <Text style={[styles.title, { color: palette.fg }]}>{title}</Text>
        {detail ? <Text style={[styles.detail, { color: palette.fg }]}>{detail}</Text> : null}
      </View>
      {action ? (
        <Pressable
          onPress={action.onPress}
          disabled={action.busy}
          hitSlop={8}
          style={({ pressed }) => [
            styles.action,
            { borderColor: palette.icon },
            action.busy && styles.actionBusy,
            pressed && styles.actionPressed,
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !!action.busy, busy: !!action.busy }}
          accessibilityLabel={action.label}
        >
          {action.busy ? (
            <ActivityIndicator size="small" color={palette.fg} />
          ) : (
            <Text style={[styles.actionText, { color: palette.fg }]}>{action.label}</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      // Top-aligned now that the text may wrap: a centred icon floats beside
      // the middle of a three-line instruction instead of starting it.
      alignItems: 'flex-start',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: radii.md,
    },
    icon: { marginTop: 1 },
    text: { flex: 1 },
    title: { fontSize: 12.5, fontWeight: '700' },
    // Slightly transparent rather than a second colour: it is the same
    // statement continued, not a different kind of information.
    detail: { fontSize: 11.5, lineHeight: 16, fontWeight: '500', marginTop: 2, opacity: 0.85 },
    /* A real button, not a link: 36pt tall, a border in the banner's own
       accent so it belongs to it, the label centred. */
    action: {
      alignSelf: 'center',
      minHeight: 36,
      minWidth: 72,
      paddingHorizontal: 14,
      borderRadius: radii.pill,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    actionBusy: { opacity: 0.6 },
    actionPressed: { opacity: 0.75 },
    actionText: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
  });
