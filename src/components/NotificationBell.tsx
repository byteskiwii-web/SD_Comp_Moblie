import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from './Icon';
import { colors } from '../theme/tokens';
import { useNotificationInbox } from '../hooks/useNotificationInbox';

// Circular slate button + a small unread dot, matching the reference
// prototype's mobile bell exactly (a dot, not a numeric badge -- the
// prototype's own mobile notification bell has no count, unlike its desktop
// admin shell).
//
// The dot covers BOTH feeds: a device alert and a server notification are
// equally worth surfacing, and a bell that stayed dark while an approval was
// waiting in the panel would be worse than no bell. Because it is a dot and
// not a count, a server page capped at PAGE_SIZE cannot under-report it.
export function NotificationBell({ onPress }: { onPress: () => void }) {
  const { unreadCount } = useNotificationInbox();
  return (
    <Pressable onPress={onPress} style={styles.button} hitSlop={8}>
      <Icon name="bell" size={16} color={colors.slate600} />
      {unreadCount > 0 && <View style={styles.dot} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.slate100,
  },
});
