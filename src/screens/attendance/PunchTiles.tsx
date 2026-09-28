import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
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
 * EVERY STATE SAYS WHAT IT IS, AND WHY.
 *
 * A tile that could not be pressed used to wear a soft tint of its own
 * colour with the same hint as always -- "Begin your shift" -- so a Punch In
 * waiting on Location looked like a button that simply ignored the tap. Now:
 *
 *   ready      filled in its colour                      tap to punch
 *   attention  soft tint, the problem's icon, the fix    tap to fix it
 *   idle       grey, dashed edge, the reason             not tappable
 *   pending    filled, spinning, what it is doing        not tappable
 *   done       a receipt, "Done at 10:04"                not tappable
 *
 * Content is centred: these are two large buttons read at a glance, and a
 * label hugging the bottom-left corner read as a card rather than a control.
 */
export function PunchTiles({
  clockedIn,
  clockInAt,
  clockOutAt,
  onClockIn,
  onClockOut,
  clockInDisabled,
  clockOutDisabled,
  clockInNote,
  clockOutNote,
  clockInAttention,
  /**
   * Which side is currently busy: checking location before the camera, or a
   * request out with no answer yet. The busy side stays FILLED with a
   * spinner, so "did my tap register" is answered yes, visibly; the other
   * side stops accepting taps for the same window.
   */
  pending,
  pendingLabel,
  labels,
}: {
  clockedIn: boolean;
  /** Formatted times, or null when the punch has not happened. */
  clockInAt: string | null;
  clockOutAt: string | null;
  onClockIn: () => void;
  onClockOut: () => void;
  /**
   * Separate, because the two punches wait on different things: a clock-in
   * on the shift window, a clock-out on the shift having started and no
   * break running.
   */
  clockInDisabled?: boolean;
  clockOutDisabled?: boolean;
  /** Why the tile is unavailable, or what to do -- replaces the hint line. */
  clockInNote?: string | null;
  clockOutNote?: string | null;
  /**
   * Punch In has a problem the tap itself can fix (Location off, permission
   * not granted). Still pressable -- pressing it is how it gets fixed.
   */
  clockInAttention?: boolean;
  pending?: 'clock-in' | 'clock-out' | null;
  /** What the busy side says it is doing. Defaults to labels.processing. */
  pendingLabel?: string | null;
  labels: {
    clockIn: string;
    clockOut: string;
    doneAt: (time: string) => string;
    startHint: string;
    endHint: string;
    processing: string;
  };
}) {
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  // The shift has ended when there is an out AND we are no longer clocked in.
  // Both tiles then read as receipts, which is the correct end state -- the
  // alternative, re-arming Clock In, would invite a second shift nobody asked
  // for on a screen somebody is glancing at on their way out.
  const dayFinished = !clockedIn && !!clockOutAt;
  const busy = pendingLabel || labels.processing;

  const inKind: TileKind =
    pending === 'clock-in'
      ? 'pending'
      : clockInAt || clockedIn
        ? 'done'
        : clockInDisabled || pending
          ? 'idle'
          : clockInAttention
            ? 'attention'
            : 'active';

  const outKind: TileKind =
    pending === 'clock-out'
      ? 'pending'
      : dayFinished
        ? 'done'
        : !clockedIn || clockOutDisabled || pending
          ? 'idle'
          : 'active';

  return (
    <View style={styles.row}>
      <Tile
        tone="in"
        kind={inKind}
        icon={inKind === 'done' ? 'checkmark' : inKind === 'attention' ? 'location-outline' : 'log-in-outline'}
        title={labels.clockIn}
        sub={
          inKind === 'pending'
            ? busy
            : inKind === 'done'
              ? clockInAt
                ? labels.doneAt(clockInAt)
                : labels.startHint
              : clockInNote || labels.startHint
        }
        onPress={onClockIn}
        styles={styles}
        colors={colors}
      />
      <Tile
        tone="out"
        kind={outKind}
        icon={outKind === 'done' ? 'checkmark' : 'log-out-outline'}
        title={labels.clockOut}
        sub={
          outKind === 'pending'
            ? busy
            : outKind === 'done' && clockOutAt
              ? labels.doneAt(clockOutAt)
              : outKind === 'idle'
                ? clockOutNote || labels.endHint
                : labels.endHint
        }
        onPress={onClockOut}
        styles={styles}
        colors={colors}
      />
    </View>
  );
}

type TileKind = 'active' | 'attention' | 'idle' | 'pending' | 'done';

function Tile({
  tone,
  kind,
  icon,
  title,
  sub,
  onPress,
  styles,
  colors,
}: {
  /** Which end of the shift this is. Decides the hue of every live state. */
  tone: 'in' | 'out';
  kind: TileKind;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  colors: ColorScheme;
}) {
  /*
   * Colour carries which button this is. Green starts a shift and red ends
   * it -- the convention every attendance board already uses. `done` and
   * `idle` are neutral whichever end they are: a receipt is not an action,
   * and a greyed tile has to look like one you cannot press.
   */
  const isIn = tone === 'in';
  const filled = kind === 'active' || kind === 'pending';
  const pressable = kind === 'active' || kind === 'attention';

  const hueText = isIn ? colors.successText : colors.dangerText;
  const iconColor = filled
    ? colors.white
    : kind === 'done'
      ? colors.successText
      : kind === 'attention'
        ? hueText
        : colors.slate400;

  const body = (
    <>
      <View
        style={[
          styles.iconWrap,
          filled && styles.iconWrapFilled,
          kind === 'attention' && styles.iconWrapSurface,
          kind === 'done' && styles.iconWrapDone,
        ]}
      >
        {kind === 'pending' ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Ionicons name={icon} size={18} color={iconColor} />
        )}
      </View>
      <Text
        style={[
          styles.title,
          filled && styles.titleFilled,
          kind === 'attention' && { color: hueText },
          kind === 'idle' && styles.titleIdle,
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <Text
        style={[
          styles.sub,
          filled && styles.subFilled,
          kind === 'attention' && [styles.subAttention, { color: hueText }],
        ]}
        numberOfLines={2}
      >
        {sub}
      </Text>
    </>
  );

  const tileStyle = [
    styles.tile,
    filled && (isIn ? styles.fillIn : styles.fillOut),
    kind === 'attention' && (isIn ? styles.softIn : styles.softOut),
    kind === 'idle' && styles.idle,
    kind === 'done' && styles.done,
  ];

  if (!pressable) {
    return (
      <View
        style={tileStyle}
        // Announced as text: a receipt, a greyed tile and a busy one are not
        // things to tab to. The reason is part of the label.
        accessibilityRole="text"
        accessibilityLabel={title + '. ' + sub}
        accessibilityState={{ disabled: true, busy: kind === 'pending' }}
      >
        {body}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [...tileStyle, pressed && styles.pressed]}
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
      minHeight: 112,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      paddingVertical: 14,
      borderRadius: radii.lg,
      borderWidth: 1.5,
      borderColor: colors.slate200,
      backgroundColor: colors.surface,
    },
    /* FILLED = press this now. punchIn / punchOut are fixed deep shades in
       both schemes precisely so white text is readable on either. */
    fillIn: { backgroundColor: colors.punchIn, borderColor: colors.punchIn },
    fillOut: { backgroundColor: colors.punchOut, borderColor: colors.punchOut },

    /* SOFT = pressable, but something needs fixing first; the tap fixes it. */
    softIn: { backgroundColor: colors.successBg, borderColor: colors.success },
    softOut: { backgroundColor: colors.dangerBg, borderColor: colors.danger },

    /* GREY + DASHED = not available right now. The dashed edge is what makes
       it read as "not a button" at a glance, in both schemes, without
       leaning on opacity alone (which just looks faded, not unavailable). */
    idle: { backgroundColor: colors.slate50, borderColor: colors.slate300, borderStyle: 'dashed' },

    /* A receipt: solid, neutral, with a green tick. */
    done: { backgroundColor: colors.slate50, borderColor: colors.slate100 },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },

    iconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.slate100,
      marginBottom: 8,
    },
    iconWrapFilled: { backgroundColor: 'rgba(255,255,255,0.18)' },
    iconWrapSurface: { backgroundColor: colors.surface },
    iconWrapDone: { backgroundColor: colors.successBg },

    title: { fontSize: 15, fontWeight: '800', color: colors.textLight, textAlign: 'center' },
    titleFilled: { color: colors.white },
    titleIdle: { color: colors.slate500 },
    sub: {
      fontSize: 11.5,
      lineHeight: 15,
      fontWeight: '600',
      color: colors.slate500,
      marginTop: 3,
      textAlign: 'center',
    },
    subFilled: { color: colors.white, opacity: 0.8 },
    subAttention: { fontWeight: '700' },
  });
