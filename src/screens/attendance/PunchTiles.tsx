import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';

/**
 * The two ends of a shift, side by side.
 *
 * This replaces a single button that changed its own label between Start and
 * End. The button was defensible — one decision, two states — but it hid the
 * thing people actually come to this screen to check: whether their clock-in
 * registered this morning. Standing side by side, the finished half CARRIES
 * ITS OWN ANSWER ("Done at 10:04") instead of having vanished.
 *
 * Only one is ever live. The done one is not a disabled button, it is a
 * receipt: no press feedback, no chevron, nothing that invites a tap it would
 * have to refuse.
 */
export function PunchTiles({
  clockedIn,
  clockInAt,
  clockOutAt,
  onClockIn,
  onClockOut,
  disabled,
  labels,
}: {
  clockedIn: boolean;
  /** Formatted times, or null when the punch has not happened. */
  clockInAt: string | null;
  clockOutAt: string | null;
  onClockIn: () => void;
  onClockOut: () => void;
  /** No location fix yet, or a punch already in flight. */
  disabled?: boolean;
  labels: {
    clockIn: string;
    clockOut: string;
    doneAt: (time: string) => string;
    startHint: string;
    endHint: string;
  };
}) {
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  // The shift has ended when there is an out AND we are no longer clocked in.
  // Both tiles then read as receipts, which is the correct end state -- the
  // alternative, re-arming Clock In, would invite a second shift nobody asked
  // for on a screen somebody is glancing at on their way out.
  const dayFinished = !clockedIn && !!clockOutAt;

  return (
    <View style={styles.row}>
      <Tile
        kind={clockInAt ? 'done' : clockedIn ? 'done' : 'active'}
        icon={clockInAt ? 'checkmark' : 'log-in-outline'}
        title={labels.clockIn}
        sub={clockInAt ? labels.doneAt(clockInAt) : labels.startHint}
        onPress={onClockIn}
        disabled={disabled}
        styles={styles}
        colors={colors}
      />
      <Tile
        kind={dayFinished ? 'done' : clockedIn ? 'active' : 'idle'}
        icon={dayFinished ? 'checkmark' : 'log-out-outline'}
        title={labels.clockOut}
        sub={dayFinished && clockOutAt ? labels.doneAt(clockOutAt) : labels.endHint}
        onPress={onClockOut}
        disabled={disabled}
        styles={styles}
        colors={colors}
      />
    </View>
  );
}

/**
 * `active` is the one thing to do next, and is the only filled tile.
 * `done` is a receipt. `idle` is a step not yet reachable.
 */
function Tile({
  kind,
  icon,
  title,
  sub,
  onPress,
  disabled,
  styles,
  colors,
}: {
  kind: 'active' | 'done' | 'idle';
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  onPress: () => void;
  disabled?: boolean;
  styles: ReturnType<typeof makeStyles>;
  colors: ColorScheme;
}) {
  const live = kind === 'active' && !disabled;

  const body = (
    <>
      <View
        style={[
          styles.iconWrap,
          kind === 'active' && styles.iconWrapActive,
          kind === 'done' && styles.iconWrapDone,
        ]}
      >
        <Ionicons
          name={icon}
          size={17}
          color={
            kind === 'active' ? colors.white : kind === 'done' ? colors.successText : colors.slate400
          }
        />
      </View>
      <Text style={[styles.title, kind === 'active' && styles.titleActive]} numberOfLines={1}>
        {title}
      </Text>
      <Text style={[styles.sub, kind === 'active' && styles.subActive]} numberOfLines={1}>
        {sub}
      </Text>
    </>
  );

  if (!live) {
    return (
      <View
        style={[styles.tile, kind === 'done' && styles.tileDone, kind === 'idle' && styles.tileIdle]}
        // Announced as text: a receipt is not something to tab to.
        accessibilityRole="text"
        accessibilityLabel={title + '. ' + sub}
      >
        {body}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, styles.tileActive, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={title + '. ' + sub}
    >
      {body}
    </Pressable>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: 10 },
    tile: {
      flex: 1,
      minHeight: 104,
      justifyContent: 'flex-end',
      padding: 14,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.slate200,
      backgroundColor: colors.surface,
    },
    // The one live action is the only dark block on the screen, which is what
    // makes it findable without reading anything.
    // heroInactive is the app's existing "dark card carrying white text" token,
    // and it stays dark navy under BOTH schemes -- which is what this tile
    // needs. A slate would have inverted with the neutral ramp and put white
    // text on a near-white block in dark mode.
    tileActive: { backgroundColor: colors.heroInactive, borderColor: colors.heroInactive },
    tileDone: { backgroundColor: colors.slate50, borderColor: colors.slate100 },
    tileIdle: { backgroundColor: colors.slate50, borderColor: colors.slate100, opacity: 0.7 },
    pressed: { opacity: 0.85 },

    iconWrap: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.slate100,
      marginBottom: 10,
    },
    iconWrapActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
    iconWrapDone: { backgroundColor: colors.successBg },

    title: { fontSize: 14, fontWeight: '800', color: colors.textLight },
    titleActive: { color: colors.white },
    sub: { fontSize: 10.5, fontWeight: '600', color: colors.slate400, marginTop: 3 },
    subActive: { color: colors.white, opacity: 0.72 },
  });
