import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../components/ui';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import { getAttendanceHistory } from '../../api/attendance.api';
import { getLatestMarkOfTypes, SHIFT_TYPES } from '../../utils/attendanceStatus';
import { formatDateLong, formatTime, toLocalDateKey } from '../../utils/datetime';
import { GreetingHeader } from '../../components/GreetingHeader';
import { AppreciationCard } from './AppreciationCard';
import { PoliciesCard } from './PoliciesCard';
import { MonthlyStatsCard } from './MonthlyStatsCard';
import { FestivalCard } from './FestivalCard';
import { SHOW_FESTIVALS } from '../../constants/config';
import { storeLabel } from '../../utils/store';
import { ClockPanel } from '../attendance/ClockPanel';
import { TourScrollView, TourTarget } from '../../components/tour/TourTarget';
import { Skeleton, SkeletonRows } from '../../components/Skeleton';
import { TeamLeaveCard } from './TeamLeaveCard';
import { useT } from '../../i18n';

const today = () => toLocalDateKey();

const initialsOf = (first?: string, last?: string) =>
  `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '?';

export function HomeScreen() {
  const employee = useAuthStore((s) => s.employee);
  const store = useAuthStore((s) => s.store);
  const colors = useThemeStore((s) => s.colors);
  const t = useT();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data, isLoading, isError, refetch } = useQuery({
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
  /*
   * WHETHER WE KNOW YET, kept separate from the answer itself.
   *
   * `marks` falls back to [] so the list code below has something to map, and
   * an empty list reads as "no clock-in today" -- which is indistinguishable
   * from "the request has not come back". The hero card was rendering that
   * gap as the confident claim "Not clocked in", in the dark inactive colour,
   * to somebody who was in fact mid-shift. It corrects itself a second later,
   * which makes it look like the app lost the shift and found it again.
   */
  const shiftKnown = data !== undefined;
  /*
   * A QUERY THAT FAILED IS NOT A QUERY THAT IS STILL LOADING.
   *
   * `shiftKnown` alone was wrong here: an errored query leaves data
   * undefined for good, so the card pulsed as a skeleton forever while every
   * other card on the screen rendered zeros. Waiting silently is only honest
   * while something is actually on its way.
   */
  const shiftFailed = isError && !isLoading;
  const isOnShift = getLatestMarkOfTypes(marks, SHIFT_TYPES)?.mark_type === 'clock-in';
  const lastClockIn = marks.find((m) => m.mark_type === 'clock-in');
  const lastClockOut = marks.find((m) => m.mark_type === 'clock-out');

  const timelineMarks = [...marks].reverse(); // chronological (oldest first) for display

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      {/* The shared bar -- outside the scroll, same as every other tab. */}
      <GreetingHeader />
      <TourScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TourTarget
          id="home-hero"
          style={[
            styles.hero,
            // The BACKGROUND is a claim too -- green says on shift and dark
            // says off it, so neither may be shown while the answer is
            // unknown. A neutral card is the only honest third state.
            !shiftKnown ? styles.heroLoading : isOnShift ? styles.heroActive : styles.heroInactive,
          ]}
          accessibilityLabel={!shiftKnown ? t('common.loading') : undefined}
        >
          <View style={styles.heroDecoration} pointerEvents="none" />
          <View style={styles.heroTopRow}>
            {/* The date is known without asking the server, so it stays put --
                only the dot, which encodes shift state, waits. */}
            {shiftKnown ? (
              <View style={[styles.statusDot, isOnShift ? styles.statusDotActive : styles.statusDotInactive]} />
            ) : shiftFailed ? null : (
              <Skeleton width={8} height={8} radius={4} />
            )}
            <Text style={[styles.heroLabel, !shiftKnown && styles.heroLabelLoading]}>
              {formatDateLong(new Date())}
            </Text>
          </View>

          {shiftKnown ? (
            <Text style={styles.heroTitle}>
              {isOnShift ? t('shift.onShift') : t('shift.notClockedIn')}
            </Text>
          ) : shiftFailed ? (
            // Still not a claim about the shift -- it says the app could not
            // find out, which is the true statement, and offers the way out.
            <Pressable onPress={() => refetch()} accessibilityRole="button">
              <Text style={styles.heroFailed}>{t('common.tryAgain')}</Text>
              <Text style={styles.heroRetry}>{t('common.retry')}</Text>
            </Pressable>
          ) : (
            // Sized to the real title's line box so the card does not resize
            // under the finger when the answer lands.
            <Skeleton width={190} height={30} radius={8} style={styles.heroTitleSkeleton} />
          )}

          {shiftKnown || shiftFailed ? (
            <Text style={styles.heroSubtitle}>{storeLabel(store)}</Text>
          ) : (
            <Skeleton width={140} height={13} radius={6} style={styles.heroSubtitleSkeleton} />
          )}

          <View style={styles.heroDivider} />
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatLabel, !shiftKnown && styles.heroLabelLoading]}>
                {t('home.shiftStart')}
              </Text>
              {shiftKnown || shiftFailed ? (
                <Text style={styles.heroStatValue}>
                  {formatTime(lastClockIn?.timestamp ?? '')}
                </Text>
              ) : (
                <Skeleton width={72} height={17} radius={6} style={styles.heroStatSkeleton} />
              )}
            </View>
            <View style={styles.heroStatSeparator} />
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatLabel, !shiftKnown && styles.heroLabelLoading]}>
                {t('home.shiftEnd')}
              </Text>
              {shiftKnown || shiftFailed ? (
                <Text style={styles.heroStatValue}>
                  {formatTime(lastClockOut?.timestamp ?? '')}
                </Text>
              ) : (
                <Skeleton width={72} height={17} radius={6} style={styles.heroStatSkeleton} />
              )}
            </View>
          </View>
        </TourTarget>

        {/* THE PUNCH ITSELF, NOT A ROUTE TO IT.
            This used to be a row that navigated to the Attendance tab and
            opened the camera on arrival -- one tap, but a tab change and a
            screen mount between the intention and the shutter. Punching is
            what nearly everybody opens this app to do, so the buttons are
            here, and the Attendance tab keeps the map, the marks and the
            rules, which are what somebody goes there to read. Same component
            in both places, so there is only ever one punch flow. */}
        <ClockPanel variant="compact" />

        <TeamLeaveCard />

        {SHOW_FESTIVALS ? <FestivalCard /> : null}

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
      </TourScrollView>

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

  hero: { borderRadius: radii.xl, padding: 20, overflow: 'hidden' },
  // The active state's own colour, not a plain hex -- readable at a glance
  // whether the mode is light or dark, and matches the theme's own accent
  // rather than always being the same hard-coded green in both. See
  // ColorScheme's comment on why the same key can differ this much by scheme.
  heroActive: { backgroundColor: colors.heroActive },
  // Neither state's colour while neither is known.
  heroLoading: { backgroundColor: colors.slate100 },
  // The date and the stat labels are real text on a card whose colour has not
  // been decided, so they need a foreground that works on the neutral ground.
  heroLabelLoading: { color: colors.slate400 },
  // Vertical margins matched to the text these stand in for, so the card is
  // exactly as tall before the data arrives as after it.
  heroTitleSkeleton: { marginVertical: 3 },
  heroFailed: { fontSize: 15, fontWeight: '800', color: colors.slate500, marginVertical: 3 },
  heroRetry: { fontSize: 12, fontWeight: '800', color: colors.brand[700] },
  heroSubtitleSkeleton: { marginVertical: 2 },
  heroStatSkeleton: { marginTop: 3 },
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
