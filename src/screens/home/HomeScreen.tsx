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
import { getUnreadCount, NOTIFICATION_POLL_MS } from '../../api/notifications.api';
import { NotificationsSheet } from '../notifications/NotificationsSheet';
import { AppreciationCard } from './AppreciationCard';
import { PoliciesCard } from './PoliciesCard';
import { MonthlyStatsCard } from './MonthlyStatsCard';
import { FestivalCard } from './FestivalCard';
import { TourTarget } from '../../components/tour/TourTarget';
import { useTourStore } from '../../stores/tourStore';
import { Skeleton, SkeletonRows } from '../../components/Skeleton';
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
  const { data: counts } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: getUnreadCount,
    enabled: !!employee,
    refetchInterval: NOTIFICATION_POLL_MS,
  });
  const unread = counts?.unread ?? 0;
  /* Something the employee still owes -- a policy to acknowledge, an
     onboarding step. It outranks the plain count on the bell: an unread FYI
     and an unsigned mandatory policy should not look the same. */
  const needsAction = counts?.needsAction ?? 0;

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

  /*
   * THE DAY'S TWO MARKS ARE IN.
   *
   * PunchTiles already reaches this conclusion on the Attendance tab, where
   * both tiles turn into receipts and neither can be pressed -- its own
   * comment says re-arming Clock In "would invite a second shift nobody asked
   * for on a screen somebody is glancing at on their way out". Home was still
   * offering exactly that, in the largest control on the screen, and its
   * autoPunch would have opened the camera and taken the mark without asking
   * again.
   *
   * The server permits a second clock-in after a clock-out -- it only refuses
   * while you are still clocked in -- so nothing downstream was going to catch
   * this. The row now reads as the receipt the rest of the app already shows,
   * and still opens Attendance, because "what did I do today" is a fair thing
   * to want from it.
   */
  const dayFinished = shiftKnown && !isOnShift && !!lastClockOut;
  const timelineMarks = [...marks].reverse(); // chronological (oldest first) for display

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Avatar leads the row, matching the reference build: identity first,
            then the greeting, with actions pushed to the trailing edge. */}
        <View style={styles.headerRow}>
          <Pressable
            style={({ pressed }) => [styles.avatar, pressed && styles.avatarPressed]}
            onPress={() => navigation.navigate('Profile')}
            accessibilityRole="button"
            accessibilityLabel={t('profile.title')}
          >
            <Text style={styles.avatarInitial}>
              {initialsOf(employee?.first_name, employee?.last_name)}
            </Text>
          </Pressable>
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
            {/* Counts unread, but falls back to the outstanding count so an
                acknowledgement that was read and not signed still shows a
                number -- rendering a bare "0" was the alternative. */}
            {(unread > 0 || needsAction > 0) && (
              <View style={[styles.badge, needsAction > 0 && styles.badgeAction]}>
                <Text style={styles.badgeText}>
                  {(() => { const n = unread || needsAction; return n > 9 ? '9+' : n; })()}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

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
            <Text style={styles.heroSubtitle}>{store?.name ?? '—'}</Text>
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
              // NO autoPunch UNTIL THE DIRECTION IS KNOWN. This opens the
              // camera and takes the punch without asking again, so guessing
              // here is not a cosmetic slip: before the query returns,
              // isOnShift is false, and tapping this while genuinely mid-shift
              // would have opened a CLOCK-IN. Without the parameter the
              // Attendance tab just opens and waits, which is the right
              // behaviour for a decision nobody has made yet.
              params:
                shiftKnown && !dayFinished
                  ? { tab: 'clock', autoPunch: isOnShift ? 'clock-out' : 'clock-in' }
                  : { tab: 'clock' },
            })
          }
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          accessibilityRole="button"
        >
          <View style={styles.ctaIcon}>
            <Ionicons
              name={dayFinished ? 'checkmark-circle-outline' : 'camera-outline'}
              size={20}
              color={dayFinished ? colors.successText : colors.brand[700]}
            />
          </View>
          <View style={styles.ctaText}>
            {dayFinished ? (
              <Text style={styles.ctaTitle}>{t('clock.shiftEnded')}</Text>
            ) : shiftKnown ? (
              <Text style={styles.ctaTitle}>
                {isOnShift ? t('home.endShift') : t('home.startShift')}
              </Text>
            ) : shiftFailed ? (
              // The destination is still true when the direction is not.
              <Text style={styles.ctaTitle}>{t('attendance.title')}</Text>
            ) : (
              // "Start shift" and "End shift" are opposite instructions; the
              // row cannot print either one before it knows which.
              <Skeleton width={168} height={15} radius={6} style={styles.ctaTitleSkeleton} />
            )}
            {/* The times, not the geo-fence promise: that line describes what
                a punch WILL do, and there is no punch left to take today. */}
            <Text style={styles.ctaSubtitle}>
              {dayFinished
                ? `${formatTime(lastClockIn?.timestamp ?? '')} – ${formatTime(lastClockOut?.timestamp ?? '')}`
                : t('home.geofenced')}
            </Text>
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
  avatarPressed: { opacity: 0.75 },
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
  // Amber, not red, when the badge is standing for something owed rather than
  // something unseen: one is a task, the other is news, and they should not
  // read as the same urgency.
  badgeAction: { backgroundColor: colors.warning },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },

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
  ctaTitleSkeleton: { marginVertical: 2 },
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
