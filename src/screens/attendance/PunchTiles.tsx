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
  clockInDisabled,
  clockOutDisabled,
  /**
   * Which side is currently mid-flight -- the camera has already closed and a
   * request is out, with no answer yet. Without this, the gap between the
   * camera dismissing and the success/error banner appearing looked like
   * nothing was happening at all. The pending side stays looking ACTIVE
   * (filled, not greyed) with a spinner in place of its icon, so the answer
   * to "did my tap register" is yes, visibly, right up to the outcome; the
   * OTHER tile disables for the same window, since a second punch fired
   * while the first is still in flight is not a thing to allow.
   */
  pending,
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
   * on a location fix (it is judged on it), a clock-out only on the break
   * being over (it is not judged on location at all).
   */
  clockInDisabled?: boolean;
  clockOutDisabled?: boolean;
  pending?: 'clock-in' | 'clock-out' | null;
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

  return (
    <View style={styles.row}>
      <Tile
        tone="in"
        kind={
          pending === 'clock-in' ? 'pending' : clockInAt ? 'done' : clockedIn ? 'done' : 'active'
        }
        icon={clockInAt ? 'checkmark' : 'log-in-outline'}
        title={labels.clockIn}
        sub={pending === 'clock-in' ? labels.processing : clockInAt ? labels.doneAt(clockInAt) : labels.startHint}
        onPress={onClockIn}
        disabled={clockInDisabled || !!pending}
        styles={styles}
        colors={colors}
      />
      <Tile
        tone="out"
        kind={pending === 'clock-out' ? 'pending' : dayFinished ? 'done' : clockedIn ? 'active' : 'idle'}
        icon={dayFinished ? 'checkmark' : 'log-out-outline'}
        title={labels.clockOut}
        sub={
          pending === 'clock-out'
            ? labels.processing
            : dayFinished && clockOutAt
              ? labels.doneAt(clockOutAt)
              : labels.endHint
        }
        onPress={onClockOut}
        disabled={clockOutDisabled || !!pending}
        styles={styles}
        colors={colors}
      />
    </View>
  );
}

/**
 * `active` is the one thing to do next, and is the only filled tile.
 * `done` is a receipt. `idle` is a step not yet reachable. `pending` is
 * `active` frozen mid-tap: still filled, no longer pressable, spinning.
 */
function Tile({
  tone,
  kind,
  icon,
  title,
  sub,
  onPress,
  disabled,
  styles,
  colors,
}: {
  /** Which end of the shift this is. Decides the hue at every state but `done`. */
  tone: 'in' | 'out';
  kind: 'active' | 'done' | 'idle' | 'pending';
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  onPress: () => void;
  disabled?: boolean;
  styles: ReturnType<typeof makeStyles>;
  colors: ColorScheme;
}) {
  const live = kind === 'active' && !disabled;

  /*
   * WHAT IT LOOKS LIKE IS NOT ALWAYS WHAT IT IS.
   *
   * An `active` tile that is disabled -- waiting on a location fix, or outside
   * the shift window -- took the dark ACTIVE background only on the pressable
   * branch, while its text and icon took the active WHITE regardless. So a
   * disabled Punch In rendered white-on-white: in light mode the tile was
   * blank, with no icon, no label and no hint, and in dark mode the bug was
   * invisible because the plain surface happens to be dark there too.
   *
   * So the look is derived once, here, and every colour below reads from it:
   * a tile you cannot press looks like one you cannot press, in both schemes.
   * `pending` is exempted: it is disabled but must NOT fall back to the idle
   * look, or the one tile that just did something would look the same as the
   * one that was never reachable.
   */
  const visual: 'active' | 'done' | 'idle' | 'pending' =
    kind === 'pending' ? 'pending' : kind === 'active' && disabled ? 'idle' : kind;

  /*
   * Colour carries which button this is, at every state.
   *
   * Two identical grey cards make somebody read both labels to find the one
   * they want, on a shop floor, one-handed. Green starts a shift and red ends
   * it -- the convention every attendance board already uses.
   *
   * The live one is FILLED and the waiting one is a soft tint of the same
   * hue, so the pair still says "in" and "out" before the shift opens, and
   * the one you can actually press becomes obvious the moment it does. `done`
   * stays neutral whichever end it was: a receipt is not an action, and a red
   * receipt for a completed shift would read as a fault.
   */
  const isIn = tone === 'in';
  const fill = isIn ? styles.tileFillIn : styles.tileFillOut;
  const soft = isIn ? styles.tileSoftIn : styles.tileSoftOut;
  const softText = isIn ? styles.textSoftIn : styles.textSoftOut;
  const softIconColor = isIn ? colors.successText : colors.dangerText;

  // active and pending share every colour below (a pending tile IS an active
  // one, just frozen mid-tap) -- only the icon slot itself differs.
  const looksActive = visual === 'active' || visual === 'pending';

  const body = (
    <>
      <View
        style={[
          styles.iconWrap,
          looksActive && styles.iconWrapActive,
          visual === 'idle' && styles.iconWrapSoft,
          visual === 'done' && styles.iconWrapDone,
        ]}
      >
        {visual === 'pending' ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Ionicons
            name={icon}
            size={17}
            color={visual === 'active' ? colors.white : visual === 'done' ? colors.successText : softIconColor}
          />
        )}
      </View>
      <Text
        style={[styles.title, looksActive && styles.titleActive, visual === 'idle' && softText]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <Text
        style={[styles.sub, looksActive && styles.subActive, visual === 'idle' && styles.subSoft]}
        numberOfLines={1}
      >
        {sub}
      </Text>
    </>
  );

  if (!live) {
    return (
      <View
        style={[styles.tile, visual === 'pending' && fill, visual === 'done' && styles.tileDone, visual === 'idle' && soft]}
        // Announced as text: neither a receipt nor a tile that is busy right
        // now is something to tab to.
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
      style={({ pressed }) => [styles.tile, fill, pressed && styles.pressed]}
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
    /* FILLED = you can press this now. punchIn / punchOut are fixed deep
       shades in both schemes precisely so this white text is readable in
       either -- see tokens.ts. */
    tileFillIn: { backgroundColor: colors.punchIn, borderColor: colors.punchIn },
    tileFillOut: { backgroundColor: colors.punchOut, borderColor: colors.punchOut },

    /* SOFT = the right button, not yet pressable. Same hue at a tint, with a
       border in the vivid shade so the card has an edge rather than fading
       into the screen. Both tints invert with the scheme, so this is a pale
       green on white and a deep green on near-black. */
    tileSoftIn: { backgroundColor: colors.successBg, borderColor: colors.success },
    tileSoftOut: { backgroundColor: colors.dangerBg, borderColor: colors.danger },

    /* A receipt is not an action, and stays neutral whichever end it was: a
       red card for a shift somebody finished would read as a fault. */
    tileDone: { backgroundColor: colors.slate50, borderColor: colors.slate100 },
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
    /* The surface, not a tint of the tile: a chip a shade off its own
       background disappears, and this one is carrying the only icon. */
    iconWrapSoft: { backgroundColor: colors.surface },
    iconWrapDone: { backgroundColor: colors.successBg },

    title: { fontSize: 14, fontWeight: '800', color: colors.textLight },
    titleActive: { color: colors.white },
    textSoftIn: { color: colors.successText },
    textSoftOut: { color: colors.dangerText },
    sub: { fontSize: 10.5, fontWeight: '600', color: colors.slate400, marginTop: 3 },
    subActive: { color: colors.white, opacity: 0.72 },
    /* Dimmed rather than recoloured: the hint is secondary at every state, and
       a second saturated line would compete with the label above it. */
    subSoft: { color: colors.slate600, opacity: 0.85 },
  });
