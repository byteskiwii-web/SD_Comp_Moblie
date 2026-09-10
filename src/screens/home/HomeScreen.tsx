import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Card } from '../../components/ui';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { ThemeToggle } from '../../components/ThemeToggle';
import { useAuthStore } from '../../stores/authStore';
import { getAttendanceHistory } from '../../api/attendance.api';
import { getLatestMarkOfTypes, SHIFT_TYPES } from '../../utils/attendanceStatus';
import { formatDateLong, formatTime, toLocalDateKey } from '../../utils/datetime';
import { getUnreadCount } from '../../api/notifications.api';
import { NotificationsSheet } from '../notifications/NotificationsSheet';
import { AppreciationCard } from './AppreciationCard';
import { PoliciesCard } from './PoliciesCard';
import { MonthlyStatsCard } from './MonthlyStatsCard';
import { FestivalCard } from './FestivalCard';
import { TourTarget } from '../../components/tour/TourTarget';
import { useTourStore } from '../../stores/tourStore';
import { SkeletonRows } from '../../components/Skeleton';
import { useT } from '../../i18n';

const today = () => toLocalDateKey();

const initialsOf = (first?: string, last?: string) =>
  `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '?';

export function HomeScreen() {
  const employee = useAuthStore((s) => s.employee);
  const store = useAuthStore((s) => s.store);
  const navigation = useNavigation<any>();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const startTour = useTourStore((s) => s.start);
  const colors = useThemeStore((s) => s.colors);
  // Subscribed purely so a change to the 12/24-hour setting re-renders the
  // times on this screen; the formatters read the store outside React.
  usePreferencesStore((s) => s.clock);
  const t = useT();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // The badge number. Polled rather than pushed: expo-notifications remote push
  // does not work in Expo Go at all, so a periodic read is the only way the
  // count moves without the user opening the sheet.
  const { data: unread = 0 } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: getUnreadCount,
    enabled: !!employee,
    refetchInterval: 60_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['attendance-today', employee?.id],
    queryFn: () => getAttendanceHistory(employee!.id, today(), today()),
    enabled: !!employee,
  });

  // Marks come back most-recent-first. Employees can clock in/out multiple
  // times per day (e.g. lunch breaks), so only the LATEST mark determines
  // whether they're currently on shift -- and since break-start/break-end
  // share this table, that latest mark must be filtered to shift types
  // specifically (the most recent mark overall could be a break event).
  const marks = data ?? [];
  const isOnShift = getLatestMarkOfTypes(marks, SHIFT_TYPES)?.mark_type === 'clock-in';
  const lastClockIn = marks.find((m) => m.mark_type === 'clock-in');
  const lastClockOut = marks.find((m) => m.mark_type === 'clock-out');
  const timelineMarks = [...marks].reverse(); // chronological (oldest first) for display

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Avatar leads the row, matching the reference build: identity first,
            then the greeting, with actions pushed to the trailing edge. */}
        <View style={styles.headerRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>
              {initialsOf(employee?.first_name, employee?.last_name)}
            </Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.welcome}>{t('home.welcome')}</Text>
            <Text style={styles.name} numberOfLines={1}>
              {employee?.first_name ?? 'there'}
            </Text>
          </View>
          <ThemeToggle />
          <Pressable
            style={styles.iconButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('home.replayTour')}
            onPress={startTour}
          >
            <Ionicons name="help-circle-outline" size={20} color={colors.slate600} />
          </Pressable>

          <Pressable
            style={styles.iconButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('home.notifications')}
            onPress={() => setNotificationsOpen(true)}
          >
            <Ionicons name="notifications-outline" size={20} color={colors.slate600} />
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            )}
          </Pressable>
        </View>

        <TourTarget id="home-hero" style={[styles.hero, isOnShift ? styles.heroActive : styles.heroInactive]}>
          <View style={styles.heroDecoration} pointerEvents="none" />
          <View style={styles.heroTopRow}>
            <View style={[styles.statusDot, isOnShift ? styles.statusDotActive : styles.statusDotInactive]} />
            <Text style={styles.heroLabel}>
              {formatDateLong(new Date())}
            </Text>
          </View>
          <Text style={styles.heroTitle}>
            {isOnShift ? t('shift.onShift') : t('shift.notClockedIn')}
          </Text>
          <Text style={styles.heroSubtitle}>{store?.name ?? '—'}</Text>
          <View style={styles.heroDivider} />
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>{t('home.shiftStart')}</Text>
              <Text style={styles.heroStatValue}>
                {formatTime(lastClockIn?.timestamp ?? '')}
              </Text>
            </View>
            <View style={styles.heroStatSeparator} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>{t('home.shiftEnd')}</Text>
              <Text style={styles.heroStatValue}>
                {formatTime(lastClockOut?.timestamp ?? '')}
              </Text>
            </View>
          </View>
        </TourTarget>

        {/* A row rather than a plain button: the icon and the second line carry
            what the punch actually involves, which a single label cannot. */}
        <Pressable
          // isOnShift here is the same read that chose the label two lines
          // below, so the direction handed to Attendance always matches what
          // this row just told the employee it would do -- opening the
          // camera straight away instead of landing on the tab and asking
          // them to press Start/End Shift again for a decision already made.
          onPress={() =>
            navigation.navigate('Attendance', {
              screen: 'AttendanceHome',
              params: { tab: 'clock', autoPunch: isOnShift ? 'clock-out' : 'clock-in' },
            })
          }
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          accessibilityRole="button"
        >
          <View style={styles.ctaIcon}>
            <Ionicons name="camera-outline" size={20} color={colors.brand[700]} />
          </View>
          <View style={styles.ctaText}>
            <Text style={styles.ctaTitle}>
              {isOnShift ? t('home.endShift') : t('home.startShift')}
            </Text>
            <Text style={styles.ctaSubtitle}>{t('home.geofenced')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.slate400} />
        </Pressable>

        <FestivalCard />

        <MonthlyStatsCard />

        <PoliciesCard />

        <Card>
          <Text style={styles.cardTitle}>{t('home.timeline')}</Text>
          {isLoading ? (
            <SkeletonRows count={3} />
          ) : marks.length === 0 ? (
            <Text style={styles.emptyText}>{t('home.timelineEmpty')}</Text>
          ) : (
            timelineMarks.map((m, i) => {
              const outside = m.inside_geofence === false;
              return (
                <View key={m.id} style={[styles.timelineRow, i === timelineMarks.length - 1 && styles.timelineRowLast]}>
                  <View style={[styles.timelineIcon, outside ? styles.timelineIconBad : styles.timelineIconGood]}>
                    <Ionicons
                      name={outside ? 'close' : 'checkmark'}
                      size={13}
                      color={outside ? colors.danger : colors.success}
                    />
                  </View>
                  <Text style={styles.timelineType}>
                    {t(('mark.' + m.mark_type) as 'mark.clock-in')}
                  </Text>
                  <Text style={styles.timelineTime}>
                    {formatTime(m.timestamp)}
                  </Text>
                </View>
              );
            })
          )}
        </Card>

        <AppreciationCard />
      </ScrollView>

      <NotificationsSheet visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </SafeAreaView>
  );
}

// Styles are a function of the active ColorScheme, computed in the component
// via useMemo (see above) rather than once at module load -- a StyleSheet
// built at import time would freeze on whichever scheme happened to be
// active the first time this file loaded and never update when the theme
// toggle is pressed.
function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgLight },
  content: { padding: 20, paddingTop: 8, gap: 16 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerText: { flex: 1 },
  welcome: { fontSize: 11, color: colors.slate500, fontWeight: '600' },
  name: { fontSize: 17.5, fontWeight: '800', color: colors.textLight, marginTop: 2, letterSpacing: -0.3 },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand[700],
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { color: colors.white, fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
  iconButton: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.slate100,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.black, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: colors.scheme === 'dark' ? 0 : 0.06, shadowRadius: 4, elevation: colors.scheme === 'dark' ? 0 : 1,
  },

  badge: {
    position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4, borderWidth: 2, borderColor: colors.bgLight,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },

  hero: { borderRadius: radii.xl, padding: 20, overflow: 'hidden' },
  // The active state's own colour, not a plain hex -- readable at a glance
  // whether the mode is light or dark, and matches the theme's own accent
  // rather than always being the same hard-coded green in both. See
  // ColorScheme's comment on why the same key can differ this much by scheme.
  heroActive: { backgroundColor: colors.heroActive },
  heroInactive: { backgroundColor: colors.heroInactive },
  heroDecoration: {
    position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusDotActive: { backgroundColor: colors.white },
  statusDotInactive: { backgroundColor: colors.slate400 },
  heroLabel: { color: colors.white, opacity: 0.75, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  heroTitle: { color: colors.white, fontSize: 22, fontWeight: '800', marginTop: 8, letterSpacing: -0.4 },
  heroSubtitle: { color: colors.white, opacity: 0.85, fontSize: 11.5, marginTop: 3, fontWeight: '600' },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginTop: 18, marginBottom: 14 },
  heroStatsRow: { flexDirection: 'row', alignItems: 'center' },
  heroStat: { flex: 1 },
  heroStatSeparator: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 16 },
  heroStatLabel: { color: colors.white, opacity: 0.65, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  heroStatValue: { color: colors.white, fontSize: 14, fontWeight: '800', marginTop: 4 },

  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.surface, borderRadius: radii.lg, padding: 14,
    borderWidth: colors.scheme === 'dark' ? 1 : 0, borderColor: colors.slate200,
    shadowColor: colors.black, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: colors.scheme === 'dark' ? 0 : 0.06, shadowRadius: 8, elevation: colors.scheme === 'dark' ? 0 : 2,
  },
  ctaPressed: { opacity: 0.9 },
  ctaIcon: {
    width: 42, height: 42, borderRadius: radii.md, backgroundColor: colors.brand[50],
    alignItems: 'center', justifyContent: 'center',
  },
  ctaText: { flex: 1 },
  ctaTitle: { fontSize: 13, fontWeight: '800', color: colors.textLight, letterSpacing: -0.2 },
  ctaSubtitle: { fontSize: 10.5, color: colors.slate500, marginTop: 2, fontWeight: '600' },

  cardTitle: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: colors.slate500, marginBottom: 4 },
  loadingSpacer: { marginVertical: 12 },
  emptyText: { fontSize: 11.5, color: colors.slate400, paddingVertical: 8 },
  timelineRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.slate100,
  },
  timelineRowLast: { borderBottomWidth: 0 },
  timelineIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  timelineIconGood: { backgroundColor: colors.successBg },
  timelineIconBad: { backgroundColor: colors.dangerBg },
  timelineType: { flex: 1, fontSize: 11.5, fontWeight: '600', color: colors.textLight, textTransform: 'capitalize' },
  timelineTime: { fontSize: 11, color: colors.slate500, fontWeight: '600' },
  });
}
