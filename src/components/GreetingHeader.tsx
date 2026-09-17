import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { ColorScheme } from '../theme/tokens';
import { useThemeStore } from '../stores/themeStore';
import { useAuthStore } from '../stores/authStore';
import { useTourStore } from '../stores/tourStore';
import { getUnreadCount, NOTIFICATION_POLL_MS } from '../api/notifications.api';
import { NotificationsSheet } from '../screens/notifications/NotificationsSheet';
import { useT } from '../i18n';
import { AvatarContent } from './AvatarContent';

/**
 * The bar at the top of every tab: who you are, and the controls you reach
 * for from anywhere.
 *
 *   [photo]  Welcome back / Name        [theme] [help] [bell]
 *
 * ONE COMPONENT, FOUR TABS. It used to be drawn three different ways — Home
 * had its own copy with a help button and a tappable photo, Attendance wore
 * this one with neither, and Leave and Profile had no bar at all — so the
 * bell and the theme switch appeared and vanished as you moved between tabs,
 * and the photo opened Profile from one tab and did nothing from the next.
 *
 * Mount it OUTSIDE the screen's ScrollView. It owns the notifications sheet,
 * and a React Native Modal nested in scrolling content paints as a black
 * overlay on Android; outside the scroll it is safe to render here, which is
 * what lets every screen drop its own copy of the sheet and its state.
 *
 * The photo goes to the Profile tab's first screen. On Profile itself that is
 * "back to the top", which is also what a person tapping it there expects.
 */
export function GreetingHeader() {
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const navigation = useNavigation<any>();
  const employee = useAuthStore((s) => s.employee);
  const mode = useThemeStore((s) => s.mode);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const startTour = useTourStore((s) => s.start);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const { data: counts } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: getUnreadCount,
    enabled: !!employee,
    refetchInterval: NOTIFICATION_POLL_MS,
  });
  const unread = counts?.unread ?? 0;
  const needsAction = counts?.needsAction ?? 0;
  const badge = unread || needsAction;

  const openProfile = () => {
    try {
      navigation.navigate('Profile', { screen: 'ProfileHome' });
    } catch {
      // A gate screen is showing and the tabs are not mounted; nowhere to go.
    }
  };

  return (
    <View style={styles.row}>
      <Pressable
        style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
        onPress={openProfile}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={t('profile.title')}
      >
        <AvatarContent initialsStyle={styles.avatarText} />
      </Pressable>

      <View style={styles.text}>
        <Text style={styles.welcome} numberOfLines={1}>{t('home.welcome')}</Text>
        <Text style={styles.name} numberOfLines={1}>
          {employee?.first_name ?? '—'}
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        hitSlop={6}
        onPress={toggleTheme}
        accessibilityRole="button"
        accessibilityLabel={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <Ionicons name={mode === 'dark' ? 'sunny-outline' : 'moon-outline'} size={19} color={colors.slate600} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        hitSlop={6}
        onPress={startTour}
        accessibilityRole="button"
        accessibilityLabel={t('home.replayTour')}
      >
        <Ionicons name="help-circle-outline" size={20} color={colors.slate600} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        hitSlop={6}
        onPress={() => setSheetOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('home.notifications')}
      >
        <Ionicons name="notifications-outline" size={19} color={colors.slate600} />
        {/* Capped at 9+. Amber when what is outstanding is an action rather
            than unread news — a task and a piece of news are not the same urgency. */}
        {badge > 0 && (
          <View style={[styles.badge, needsAction > 0 && styles.badgeAction]}>
            <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
      </Pressable>

      <NotificationsSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </View>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8,
    },
    pressed: { opacity: 0.7 },
    avatar: {
      width: 44, height: 44, borderRadius: 22,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.brand[700],
      // The photo fills this circle, so it has to be clipped to it.
      overflow: 'hidden',
    },
    avatarText: { fontSize: 13.5, fontWeight: '800', color: colors.white, letterSpacing: 0.3 },
    text: { flex: 1, minWidth: 0 },
    welcome: { fontSize: 11, fontWeight: '600', color: colors.slate500 },
    name: { fontSize: 17.5, fontWeight: '800', color: colors.textLight, marginTop: 2, letterSpacing: -0.3 },
    // One look for all three controls, in both themes: a filled circle with a
    // hairline, so none of them reads as bare glyph on one tab and a button
    // on another.
    iconButton: {
      width: 38, height: 38, borderRadius: 19,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1, borderColor: colors.slate200,
    },
    badge: {
      position: 'absolute', top: -3, right: -3,
      minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.danger,
      borderWidth: 2, borderColor: colors.bgLight,
    },
    badgeAction: { backgroundColor: colors.warning },
    badgeText: { fontSize: 10, fontWeight: '800', color: colors.white },
  });
