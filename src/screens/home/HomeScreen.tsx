import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Card } from '../../components/ui';
import { colors, radii } from '../../theme/tokens';
import { useAuthStore } from '../../stores/authStore';
import { getAttendanceHistory } from '../../api/attendance.api';
import { getLatestMarkOfTypes, SHIFT_TYPES } from '../../utils/attendanceStatus';
import { formatDateLong, formatTime, toLocalDateKey } from '../../utils/datetime';
import { getUnreadCount } from '../../api/notifications.api';
import { NotificationsSheet } from '../notifications/NotificationsSheet';
import { AppreciationCard } from './AppreciationCard';
import { PoliciesCard } from './PoliciesCard';
import { MonthlyStatsCard } from './MonthlyStatsCard';
import { TourTarget } from '../../components/tour/TourTarget';
import { useTourStore } from '../../stores/tourStore';
import { SkeletonRows } from '../../components/Skeleton';

const today = () => toLocalDateKey();

const initialsOf = (first?: string, last?: string) =>
  `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '?';

export function HomeScreen() {
  const employee = useAuthStore((s) => s.employee);
  const store = useAuthStore((s) => s.store);
  const navigation = useNavigation<any>();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const startTour = useTourStore((s) => s.start);

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
            <Text style={styles.welcome}>Welcome back</Text>
            <Text style={styles.name} numberOfLines={1}>
              {employee?.first_name ?? 'there'}
            </Text>
          </View>
          <Pressable
            style={styles.iconButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Replay app tour"
            onPress={startTour}
          >
            <Ionicons name="help-circle-outline" size={20} color={colors.slate600} />
          </Pressable>

          <Pressable
            style={styles.iconButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
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
          <Text style={styles.heroTitle}>{isOnShift ? 'On shift' : 'Not clocked in'}</Text>
          <Text style={styles.heroSubtitle}>{store?.name ?? '—'}</Text>
          <View style={styles.heroDivider} />
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Shift start</Text>
              <Text style={styles.heroStatValue}>
                {formatTime(lastClockIn?.timestamp ?? '')}
              </Text>
            </View>
            <View style={styles.heroStatSeparator} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Shift end</Text>
              <Text style={styles.heroStatValue}>
                {formatTime(lastClockOut?.timestamp ?? '')}
              </Text>
            </View>
          </View>
        </TourTarget>

        {/* A row rather than a plain button: the icon and the second line carry
            what the punch actually involves, which a single label cannot. */}
        <Pressable
          onPress={() => navigation.navigate('Attendance')}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          accessibilityRole="button"
        >
          <View style={styles.ctaIcon}>
            <Ionicons name="camera-outline" size={20} color={colors.brand[700]} />
          </View>
          <View style={styles.ctaText}>
            <Text style={styles.ctaTitle}>
              {isOnShift ? 'End shift with live photo' : 'Start shift with live photo'}
            </Text>
            <Text style={styles.ctaSubtitle}>Geo-fenced · location auto-captured</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.slate400} />
        </Pressable>

        <MonthlyStatsCard />

        <PoliciesCard />

        <Card>
          <Text style={styles.cardTitle}>Today's timeline</Text>
          {isLoading ? (
            <SkeletonRows count={3} />
          ) : marks.length === 0 ? (
            <Text style={styles.emptyText}>No activity yet — start your shift to begin.</Text>
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
                  <Text style={styles.timelineType}>{m.mark_type.replace('-', ' ')}</Text>
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

const styles = StyleSheet.create({
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
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.slate900, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },

  badge: {
    position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4, borderWidth: 2, borderColor: colors.bgLight,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },

  hero: { borderRadius: radii.xl, padding: 20, overflow: 'hidden' },
  // Green while on shift, matching the reference build — the state is readable
  // from the colour alone, across the room, without reading the label.
  heroActive: { backgroundColor: '#0F9D58' },
  heroInactive: { backgroundColor: colors.slate800 },
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
    backgroundColor: colors.white, borderRadius: radii.lg, padding: 14,
    shadowColor: colors.slate900, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
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
