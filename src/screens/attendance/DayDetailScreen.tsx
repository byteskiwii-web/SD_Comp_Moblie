import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { Button } from '../../components/ui';
import { SkeletonCard } from '../../components/Skeleton';
import { useAuthStore } from '../../stores/authStore';
import { getAttendanceHistory } from '../../api/attendance.api';
import { getApiErrorMessage } from '../../api/client';
import { formatTime, formatTimeWithSeconds, toLocalDateKey, formatClockTime } from '../../utils/datetime';
import { dayDiscrepancies, formatDuration, punctuality, summariseDay } from '../../utils/attendanceDay';
import { useTicker } from '../../hooks/useTicker';
import type { AttendanceStackParamList } from '../../navigation/types';
import { t as tr, useT, type TKey } from '../../i18n';

/**
 * One day, in full.
 *
 * The list answers "which days need my attention"; this answers "what actually
 * happened on this one" — the rostered window, the two hour counts, and every
 * individual stamp behind them. Splitting it out is what let the list rows get
 * short: a row no longer has to carry the detail, because the detail is one
 * tap away.
 *
 * The stamps are shown to the SECOND here and to the minute everywhere else,
 * on purpose. A summary reads better rounded; a log is evidence, and the
 * seconds are the difference between "I clocked in at 9" and the record that
 * proves it.
 */

type Nav = NativeStackNavigationProp<AttendanceStackParamList, 'AttendanceDay'>;
type DayRoute = RouteProp<AttendanceStackParamList, 'AttendanceDay'>;

// Looked up per call rather than held in a module constant: a constant is
// evaluated once, so it would keep painting whichever language the app was
// started in even after somebody changed it.
const dayLong = (d: number) => tr(('weekday.' + d) as TKey);
const monthShort = (m: number) => tr(('monthShort.' + (m + 1)) as TKey);

const longDate = (key: string) => {
  const d = new Date(`${key}T00:00:00`);
  return `${dayLong(d.getDay())}, ${d.getDate()} ${monthShort(d.getMonth())} ${d.getFullYear()}`;
};

/** "09:30 AM" from the "HH:MM:SS" the profile carries. */
function rosterTime(hhmmss: string | null): string | null {
  if (!hhmmss) return null;
  const out = formatClockTime(hhmmss, '');
  return out || null;
}

export function DayDetailScreen() {
  const colors = useThemeStore((s) => s.colors);
  const t = useT();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation<Nav>();
  const { date, employeeId, employeeName } = useRoute<DayRoute>().params;
  const employee = useAuthStore((s) => s.employee);
  const profile = useAuthStore((s) => s.profile);
  // Whose day this is. The server decides whether the caller may read it --
  // scopeEmployeeParam allows self at any level and a site-scoped role its own
  // store -- so this is a request, not a claim.
  const subjectId = employeeId ?? employee?.id;
  const viewingSomeoneElse = !!employeeId && employeeId !== employee?.id;

  // Refetched for the single day rather than handed down the route. A route
  // param would be a snapshot of the list at tap time, and this screen is
  // where somebody lands after clocking out to check it registered.
  const { data, isLoading, error } = useQuery({
    queryKey: ['attendance-day', subjectId, date],
    queryFn: () => getAttendanceHistory(subjectId!, date, date),
    enabled: !!subjectId,
  });

  // A running shift keeps counting here too, on the same five-minute beat.
  const now = useTicker();
  const isToday = date === toLocalDateKey(now);
  const day = useMemo(
    () => summariseDay(date, data ?? [], isToday ? now : undefined),
    [date, data, isToday, now]
  );
  /*
   * Late or on time is judged against the SHIFT, and the only shift this app
   * holds is the viewer's own. Showing a colleague's clock-in against your
   * roster would invent a verdict, so somebody else's day reports the times
   * and leaves the judgement to whoever has their roster.
   */
  const status = viewingSomeoneElse ? null : punctuality(day.firstIn, profile?.shiftStart ?? null);
  const issues = viewingSomeoneElse
    ? { breakOverrunMinutes: 0, shortByMinutes: 0, expectedMinutes: null }
    : dayDiscrepancies(day, {
        shiftStart: profile?.shiftStart, shiftEnd: profile?.shiftEnd,
        breakAllowanceMinutes: profile?.shift?.breakAllowanceMinutes,
      });
  const hasIssue = issues.breakOverrunMinutes > 0 || issues.shortByMinutes > 0;

  const window = useMemo(() => {
    const from = rosterTime(profile?.shiftStart ?? null);
    const to = rosterTime(profile?.shiftEnd ?? null);
    return from && to ? `${from} – ${to}` : null;
  }, [profile?.shiftStart, profile?.shiftEnd]);

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.nav}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Ionicons name="chevron-back" size={26} color={colors.textLight} />
        </Pressable>
        <Text style={styles.navTitle} numberOfLines={1}>
          {viewingSomeoneElse && employeeName
            ? employeeName
            : isToday
              ? t('day.todaySuffix')
              : t('day.title')}
        </Text>
        {/* Balances the back chevron so the title sits centred. */}
        <View style={styles.navSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.date}>{longDate(date)}</Text>

        {isLoading ? (
          <SkeletonCard lines={4} />
        ) : error ? (
          <Text style={styles.error}>{getApiErrorMessage(error)}</Text>
        ) : day.marks.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.empty}>{t('day.empty')}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.windowRow}>
              <Text style={styles.window} numberOfLines={1}>
                {window ?? t('shift.noRoster')}
              </Text>
              {/* A green ON TIME over an 8-hour break said "all good" above
                  a warning. A flagged day wears CHECK instead; arrival is
                  still judged in the card below. */}
              {status && (
                <View style={[styles.pill, status === 'on-time' && !hasIssue ? styles.pillOk : styles.pillLate]}>
                  <Text style={[styles.pillText, status === 'on-time' && !hasIssue ? styles.pillTextOk : styles.pillTextLate]}>
                    {hasIssue ? t('day.check') : status === 'on-time' ? t('day.onTime') : t('day.late')}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.punchRow}>
              <View style={styles.punchCol}>
                <Text style={styles.punchLabel}>{t('day.clockIn')}</Text>
                <View style={styles.punchValue}>
                  <Ionicons name="arrow-down-outline" size={15} color={colors.success} />
                  <Text style={styles.punchTime}>{day.firstIn ? formatTime(day.firstIn.timestamp) : '—'}</Text>
                </View>
              </View>
              <View style={[styles.punchCol, styles.punchColRight]}>
                <Text style={styles.punchLabel}>{t('day.clockOut')}</Text>
                <View style={styles.punchValue}>
                  <Ionicons name="arrow-up-outline" size={15} color={colors.danger} />
                  <Text style={styles.punchTime}>{day.lastOut ? formatTime(day.lastOut.timestamp) : '—'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.hoursRow}>
              <View>
                <Text style={styles.hoursLabel}>{t('day.effectiveHours')}</Text>
                <Text style={styles.hoursValue}>{formatDuration(day.effectiveMinutes)}</Text>
              </View>
              <View style={styles.hoursRight}>
                <Text style={styles.hoursLabel}>{t('day.grossHours')}</Text>
                <Text style={styles.hoursValue}>{formatDuration(day.grossMinutes)}</Text>
              </View>
            </View>

            {/* ON TIME at the top and 3 h 9 m below it said nothing was wrong
                with a day that had an 8-hour break in it. What is short, by how
                much, and what to do about it -- before the logs, because it is
                the reason to read them. */}
            {hasIssue ? (
              <View style={styles.issue}>
                <View style={styles.issueHead}>
                  <Ionicons name="alert-circle" size={16} color={colors.warningText} />
                  <Text style={styles.issueTitle}>{t('day.issueTitle')}</Text>
                </View>
                {issues.breakOverrunMinutes > 0 ? (
                  <Text style={styles.issueLine}>
                    {t('day.issueBreak', { taken: formatDuration(day.breakMinutes), over: formatDuration(issues.breakOverrunMinutes), allowed: formatDuration(profile?.shift?.breakAllowanceMinutes ?? 0) })}
                  </Text>
                ) : null}
                {issues.shortByMinutes > 0 ? (
                  <Text style={styles.issueLine}>
                    {t('day.issueShort', { worked: formatDuration(day.effectiveMinutes), expected: formatDuration(issues.expectedMinutes), short: formatDuration(issues.shortByMinutes) })}
                  </Text>
                ) : null}
                <Text style={styles.issueHint}>{t('day.issueHint')}</Text>
              </View>
            ) : null}

            <View style={styles.divider} />

            <Text style={styles.logsTitle}>{t('day.timeLogs')}</Text>
            {day.storeName && (
              <View style={styles.storeChip}>
                <Text style={styles.storeChipText}>{day.storeName}</Text>
              </View>
            )}
            <View style={styles.logs}>
              {day.marks.map((m) => {
                const isIn = m.mark_type === 'clock-in' || m.mark_type === 'break-end';
                const outside = m.inside_geofence === false;
                return (
                  <View key={m.id} style={styles.logRow}>
                    <Ionicons
                      name={isIn ? 'arrow-down-outline' : 'arrow-up-outline'}
                      size={15}
                      color={isIn ? colors.success : colors.danger}
                    />
                    <Text style={styles.logTime}>{formatTimeWithSeconds(m.timestamp)}</Text>
                    <Text style={styles.logType} numberOfLines={1}>
                      {t(('mark.' + m.mark_type) as 'mark.clock-in')}
                    </Text>
                    {/* This is the screen the geo-fence flag belongs on, so it
                        is allowed to be loud here. It marks the individual
                        punch that was outside, which is the question the list
                        could never answer. */}
                    {outside && (
                      <View style={styles.outsideChip}>
                        <Text style={styles.outsideChipText}>{t('day.outside')}</Text>
                      </View>
                    )}
                  </View>
                );
              })}

              {/* The gap, stated rather than left blank. A missing close is the
                  single most common reason somebody opens this screen. */}
              {day.openEnded && (
                <View style={[styles.logRow, styles.logRowMissing]}>
                  <Ionicons name="arrow-up-outline" size={15} color={colors.danger} />
                  <Text style={[styles.logTime, styles.logTimeMissing]}>{t('day.outMissing')}</Text>
                  <Text style={styles.logType} />
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* A CORRECTION IS THE EMPLOYEE'S OWN.

          This button carries only the date, so the form it opens builds a
          request for whoever is signed in. On a colleague's day that is not
          a correction on their record -- it is one silently filed against the
          lead's own, for a date they did not work.

          The server refuses the honest version too: a team lead is not a
          reviewer, and submit() rejects a non-reviewer raising for somebody
          else. So there is nothing to offer here, and a lead who spots a
          missing punch asks the employee to raise it. */}
      {!viewingSomeoneElse && (
        <View style={styles.footer}>
          <Button
            title={t('day.raiseRequest')}
            onPress={() => navigation.navigate('AttendanceHome', { tab: 'regularise', date })}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgLight },

  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.slate200,
  },
  navTitle: { fontSize: 13, fontWeight: '800', color: colors.textLight, letterSpacing: -0.2 },
  navSpacer: { width: 26 },

  content: { padding: 16, gap: 12, paddingBottom: 24 },
  date: { fontSize: 15, fontWeight: '800', color: colors.textLight, letterSpacing: -0.3 },

  card: {
    backgroundColor: colors.surface, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.slate200, padding: 14, gap: 12,
  },
  empty: { fontSize: 11.5, color: colors.slate400, fontWeight: '600' },
  error: { color: colors.dangerText, fontSize: 11.5, fontWeight: '600' },

  windowRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  window: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.slate700 },
  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radii.sm },
  pillOk: { backgroundColor: colors.successBg },
  pillLate: { backgroundColor: colors.warningBg },
  pillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  pillTextOk: { color: colors.successText },
  pillTextLate: { color: colors.warningText },

  punchRow: { flexDirection: 'row' },
  punchCol: { flex: 1, gap: 5 },
  punchColRight: { alignItems: 'flex-end' },
  punchLabel: { fontSize: 10.5, color: colors.slate400, fontWeight: '700' },
  punchValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  punchTime: { fontSize: 16.5, fontWeight: '800', color: colors.textLight, letterSpacing: -0.3 },

  divider: { height: 1, backgroundColor: colors.slate100 },

  hoursRow: { flexDirection: 'row', justifyContent: 'space-between' },
  issue: { marginTop: 12, padding: 12, borderRadius: radii.md, backgroundColor: colors.warningBg, gap: 4 },
  issueHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  issueTitle: { fontSize: 12.5, fontWeight: '800', color: colors.warningText },
  issueLine: { fontSize: 12, color: colors.slate700, lineHeight: 17 },
  issueHint: { fontSize: 11, color: colors.slate500, fontWeight: '600', marginTop: 4 },
  hoursRight: { alignItems: 'flex-end' },
  hoursLabel: { fontSize: 10.5, color: colors.slate400, fontWeight: '700' },
  hoursValue: { fontSize: 13, fontWeight: '800', color: colors.textLight, marginTop: 2 },

  logsTitle: { fontSize: 11.5, fontWeight: '800', color: colors.textLight },
  storeChip: {
    alignSelf: 'flex-start', backgroundColor: colors.slate100,
    borderTopLeftRadius: radii.sm, borderTopRightRadius: radii.sm,
    paddingHorizontal: 10, paddingVertical: 5, marginBottom: -1,
  },
  storeChipText: { fontSize: 10.5, fontWeight: '700', color: colors.slate600 },
  logs: { backgroundColor: colors.slate50, borderRadius: radii.md, padding: 4 },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 8 },
  logRowMissing: { backgroundColor: colors.dangerBg, borderRadius: radii.sm },
  logTime: { fontSize: 12, fontWeight: '700', color: colors.textLight, minWidth: 104 },
  logTimeMissing: { color: colors.dangerText },
  logType: { flex: 1, fontSize: 10.5, color: colors.slate400, fontWeight: '600', textTransform: 'capitalize' },
  outsideChip: {
    backgroundColor: colors.warningBg, borderRadius: radii.sm,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  outsideChipText: { fontSize: 9, fontWeight: '800', color: colors.warningText, letterSpacing: 0.3 },

  footer: {
    padding: 16, paddingBottom: 20,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.slate200,
  },
  });
}
