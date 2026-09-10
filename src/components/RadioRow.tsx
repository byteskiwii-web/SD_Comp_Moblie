import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ColorScheme } from '../theme/tokens';
import { useThemeStore } from '../stores/themeStore';

/**
 * One choice, stated as a full sentence.
 *
 * This replaces a segmented control for the correction type. A segment has
 * room for two or three words, so "Missing/wrong punch" and "Other (on-duty,
 * WFH)" were as much as would fit — and neither says what the form will
 * actually DO, which is the thing somebody is trying to decide. A radio row
 * has a whole line, so the option can explain itself.
 *
 * Kept as a row of text with a dot rather than a native radio: the tap target
 * is the entire row, which is what a thumb finds.
 */
export function RadioRow({
  selected,
  label,
  onPress,
}: {
  selected: boolean;
  label: string;
  onPress: () => void;
}) {
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      hitSlop={4}
    >
      <View style={[styles.ring, selected && styles.ringOn]}>
        {selected ? <View style={styles.dot} /> : null}
      </View>
      <Text style={[styles.label, selected && styles.labelOn]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
    pressed: { opacity: 0.7 },
    ring: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: colors.slate300,
      alignItems: 'center',
      justifyContent: 'center',
      // Nudged down to sit on the first line of a label that wraps to two.
      marginTop: 1,
    },
    ringOn: { borderColor: colors.brand[700] },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand[700] },
    label: { flex: 1, fontSize: 12.5, lineHeight: 18, color: colors.slate600, fontWeight: '600' },
    labelOn: { color: colors.textLight, fontWeight: '700' },
  });
