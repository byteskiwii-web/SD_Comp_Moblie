import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { ColorScheme } from '../theme/tokens';
import { useThemeStore } from '../stores/themeStore';
import { useAuthStore } from '../stores/authStore';
import { ThemeToggle } from './ThemeToggle';
import { getUnreadCount } from '../api/notifications.api';
import { useT } from '../i18n';

/**
 * Who you are and what is waiting, at the top of a tab.
 *
 * Lifted out of Home so Attendance can wear it too, which is what the design
 * shows. It is the same bar in both places on purpose: a header that changes
 * between tabs makes the app feel like several apps, and this one carries the
 * two controls people reach for from anywhere — the theme and the bell.
 *
 * The unread count is polled rather than pushed. Remote push does not work in
 * Expo Go at all, so a periodic read is the only way this number moves without
 * the employee opening the sheet themselves.
 */
export function GreetingHeader({ onNotifications }: { onNotifications: () => void }) {
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const employee = useAuthStore((s) => s.employee);

  const { data: unread = 0 } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: getUnreadCount,
    enabled: !!employee,
    refetchInterval: 60_000,
  });

  const initials =
    `${employee?.first_name?.[0] ?? ''}${employee?.last_name?.[0] ?? ''}`.toUpperCase() || '?';

  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      <View style={styles.text}>
        <Text style={styles.welcome}>{t('home.welcome')}</Text>
        <Text style={styles.name} numberOfLines={1}>
          {employee?.first_name ?? '—'}
        </Text>
      </View>

      <ThemeToggle />

      <Pressable
        style={styles.iconButton}
        hitSlop={8}
        onPress={onNotifications}
        accessibilityRole="button"
        accessibilityLabel={t('home.notifications')}
      >
        <Ionicons name="notifications-outline" size={19} color={colors.slate600} />
        {/* A dot, not a number, once it is past what a badge can hold legibly
            at this size -- the exact count is in the sheet a tap away. */}
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 14 },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.brand[700],
    },
    avatarText: { fontSize: 13.5, fontWeight: '800', color: colors.white },
    text: { flex: 1 },
    welcome: { fontSize: 11, fontWeight: '600', color: colors.slate400 },
    name: { fontSize: 17, fontWeight: '800', color: colors.textLight, letterSpacing: -0.3 },
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.slate200,
    },
    badge: {
      position: 'absolute',
      top: 5,
      right: 5,
      minWidth: 15,
      height: 15,
      borderRadius: 7.5,
      paddingHorizontal: 3,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.danger,
      borderWidth: 1.5,
      borderColor: colors.surface,
    },
    badgeText: { fontSize: 8.5, fontWeight: '900', color: colors.white },
  });
