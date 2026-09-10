import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useThemeStore } from '../stores/themeStore';

/**
 * The one control for the whole app's colour scheme.
 *
 * A moon/sun glyph rather than a switch: this sits in a row of small circular
 * icon buttons (Home's Tour and Notifications buttons), and a toggle switch
 * of a different shape and size would be the one element in that row that
 * does not match its neighbours. The icon itself names the mode you would
 * SWITCH TO, matching how the tab bar and every icon button in this app
 * already behaves (the glyph describes the action, not the current state).
 */
export function ThemeToggle() {
  const mode = useThemeStore((s) => s.mode);
  const colors = useThemeStore((s) => s.colors);
  const toggle = useThemeStore((s) => s.toggle);

  return (
    <Pressable
      style={[styles.button, { backgroundColor: colors.slate100 }]}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      onPress={toggle}
    >
      <Ionicons name={mode === 'dark' ? 'sunny-outline' : 'moon-outline'} size={20} color={colors.slate600} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
