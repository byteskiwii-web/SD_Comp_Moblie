import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card } from '../../components/ui';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { useAuthStore } from '../../stores/authStore';
import { getAttendanceHistory } from '../../api/attendance.api';
import { getApiErrorMessage } from '../../api/client';
import { formatTime, toLocalDateKey } from '../../utils/datetime';
import { formatDuration, punctuality, summariseDay, summariseDays, type DaySummary } from '../../utils/attendanceDay';
import { SkeletonRows } from '../../components/Skeleton';
import { useTicker } from '../../hooks/useTicker';
import { TourTarget } from '../../components/tour/TourTarget';
import type { AttendanceStackParamList } from '../../navigation/types';
import { t as tr, useT, type TKey } from '../../i18n';

/**
 * Logs and shifts.
 *
 * A list, not a stack of cards. Every day used to carry its own card with the
 * date, both punches, both hour counts and a warning line — five pieces of
 * furniture per row, which is what made a month of attendance exhausting to
 * scan. A row here answers one question: was this day normal? Everything
 * behind that answer is one tap away on the day detail, which is where
 * somebody goes once they have found the day that was not.
 *
 * The reference build also shows "Week Off" days. There is no roster in this
 * API — nothing says which days somebody was scheduled — so days with no
 * punches are simply absent rather than labelled with a guess.
 */

type Nav = NativeStackNavigationProp<AttendanceStackParamList, 'AttendanceHome'>;
type Range = { key: string; labelKey: TKey; from: string; to: string };

const monthShort = (m: number) => tr(('monthShort.' + (m + 1)) as TKey);
const weekdayShort = (d: number) => tr(('weekdayShort.' + d) as TKey);

function buildRanges(): Range[] {
  const now = new Date();
  const ranges: Range[] = [];

  const thirty = new Date(now);
  thirty.setDate(thirty.getDate() - 29);
  ranges.push({
    key: 'last30',
    labelKey: 'history.last30',
    from: toLocalDateKey(thirty),
    to: toLocalDateKey(now),
  });

  for (let back = 1; back <= 3; back++) {
    const first = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const last = new Date(now.getFullYear(), now.getMonth() - back + 1, 0);
    ranges.push({
      key: `m${back}`,
      labelKey: ('month.' + (first.getMonth() + 1)) as TKey,
      from: toLocalDateKey(first),
      to: toLocalDateKey(last),
    });
  }
  return ranges;
}

const shortDate = (key: string) => {
  const d = new Date(`${key}T00:00:00`);
  return `${d.getDate()} ${monthShort(d.getMonth())}`;
};

export function HistoryPanel() {
  const colors = useThemeStore((s) => s.colors);
  // Subscribed purely so a change to the 12/24-hour setting re-renders the
  // times on this screen; the formatters read the store outside React.
  usePreferencesStore((s) => s.clock);
  const t = useT();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation<Nav>();
  const employee = useAuthStore((s) => s.employee);
  const profile = useAuthStore((s) => s.profile);

  const ranges = useMemo(buildRanges, []);
  const [range, setRange] = useState<Range>(ranges[0]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['attendance-history', employee?.id, range.from, range.to],
    queryFn: () => getAttendanceHistory(employee!.id, range.from, range.to),
    enabled: !!employee,
  });

  // Re-summarised every five minutes so a shift in progress keeps counting.
  const now = useTicker();
  const today = toLocalDateKey(now);
  const days = useMemo(
    () =>
      summariseDays(data ?? []).map((d) =>
        // Only today. Handing `now` to an older day with no clock-out would
        // accrue hours forever against a shift that ended weeks ago.
        d.date === today && d.openEnded ? summariseDay(d.date, d.marks, now) : d
      ),
    [data, now, today]
  );

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.rangeRow} onPress={() => setPickerOpen(true)} accessibilityRole="button">
        <View>
          <Text style={styles.rangeLabel}>{t(range.labelKey)}</Text>
          <Text style={styles.rangeDates}>
            {shortDate(range.from)} – {shortDate(range.to)}
          </Text>
        </View>
        <View style={styles.rangeChevron}>
          <Ionicons name="chevron-down" size={15} color={colors.brand[700]} />
        </View>
      </Pressable>

      {isLoading ? (
        <Card style={styles.listCard}>
          <SkeletonRows count={5} />
        </Card>
      ) : error ? (
        <Text style={styles.error}>{getApiErrorMessage(error)}</Text>
      ) : days.length === 0 ? (
        <Card style={styles.listCard}>
          <Text style={styles.empty}>{t('history.empty')}</Text>
        </Card>
      ) : (
        <TourTarget id="history-list">
        <Card style={styles.listCard}>
          {days.map((day, i) => (
            <DayRow
              key={day.date}
              day={day}
              shiftStart={profile?.shiftStart ?? null}
              first={i === 0}
              onPress={() => navigation.navigate('AttendanceDay', { date: day.date })}
            />
          ))}
        </Card>
        </TourTarget>
      )}

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetBar}>
            <Text style={styles.sheetTitle}>{t('history.pickRange')}</Text>
            <Pressable onPress={() => setPickerOpen(false)} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.slate500} />
            </Pressable>
          </View>
          {ranges.map((r) => (
            <Pressable
              key={r.key}
              style={styles.sheetRow}
              onPress={() => {
                setRange(r);
                setPickerOpen(false);
              }}
            >
              <Text style={styles.sheetRowText}>{t(r.labelKey)}</Text>
              {r.key === range.key && <Ionicons name="checkmark" size={19} color={colors.brand[700]} />}
            </Pressable>
          ))}
        </View>
      </Modal>
    </View>
  );
}

/**
 * One day, at a glance.
 *
 * A dot rather than a worded badge for punctuality: down a list this long the
 * words "On time" twenty times over are noise, and the eye is hunting for the
 * days that are not green.
 *
 * Geo-fence is deliberately NOT here. "Outside radius" was true of almost every
 * row, so as a list-level flag it marked nothing out — it just painted the
 * whole column amber and buried the one row that genuinely needed attention.
 * It is a fact about individual punches rather than about a day, and that is
 * where it now lives: against each stamp on the day detail, where you can see
 * WHICH punch was outside and at what time.
 *
 * A missing clock-out stays, because that one really is a property of the day
 * and it is the thing somebody is scanning for.
 */
function DayRow({
  day,
  shiftStart,
  first,
  onPress,
}: {
  day: DaySummary;
  shiftStart: string | null;
  first: boolean;
  onPress: () => void;
}) {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const status = punctuality(day.firstIn, shiftStart);
  const d = new Date(`${day.date}T00:00:00`);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, !first && styles.rowDivided, pressed && styles.rowPressed]}
      accessibilityRole="button"
    >
      <View style={styles.dateBlock}>
        <Text style={styles.dateDay}>{d.getDate()}</Text>
        <Text style={styles.dateWeekday}>{weekdayShort(d.getDay())}</Text>
      </View>

      <View style={styles.middle}>
        <View style={styles.timesRow}>
          {status && <View style={[styles.dot, status === 'on-time' ? styles.dotOk : styles.dotLate]} />}
          <Text style={styles.times} numberOfLines={1}>
            {day.firstIn ? formatTime(day.firstIn.timestamp) : '—'}
            {'  →  '}
            {day.lastOut ? formatTime(day.lastOut.timestamp) : '—'}
          </Text>
        </View>
        {/* Month on EVERY row now, with the flag beside it rather than
            instead of it. Showing it only where it changed meant a flagged
            day lost its date entirely, which is the row most likely to be
            read carefully. */}
        <View style={styles.subRow}>
          <Text style={styles.sub}>
            {monthShort(d.getMonth())} {d.getFullYear()}
          </Text>
          {day.openEnded && (
            <Text style={styles.flag} numberOfLines={1}>
              · {tr('history.noClockOut')}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.right}>
        <Text style={styles.hours}>{formatDuration(day.effectiveMinutes)}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.slate300} />
      </View>
    </Pressable>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
  wrap: { gap: 12 },

  rangeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 2, paddingHorizontal: 2,
  },
  rangeLabel: { fontSize: 15, fontWeight: '800', color: colors.textLight, letterSpacing: -0.3 },
  rangeDates: { fontSize: 10.5, color: colors.slate400, marginTop: 1, fontWeight: '600' },
  rangeChevron: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brand[50],
    alignItems: 'center', justifyContent: 'center',
  },

  error: { color: colors.dangerText, fontSize: 11.5, fontWeight: '600', paddingVertical: 12 },
  empty: { fontSize: 11.5, color: colors.slate400, fontWeight: '600', paddingVertical: 14 },

  listCard: { padding: 0, paddingHorizontal: 14, overflow: 'hidden' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowDivided: { borderTopWidth: 1, borderTopColor: colors.slate100 },
  rowPressed: { opacity: 0.6 },

  dateBlock: { width: 34, alignItems: 'center' },
  dateDay: { fontSize: 15, fontWeight: '800', color: colors.textLight, letterSpacing: -0.4 },
  dateWeekday: {
    fontSize: 9.5, fontWeight: '800', color: colors.slate400,
    textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 1,
  },

  middle: { flex: 1, gap: 3 },
  timesRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotOk: { backgroundColor: colors.success },
  dotLate: { backgroundColor: colors.warning },
  times: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.textLight },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 14 },
  sub: { fontSize: 11, color: colors.slate400, fontWeight: '600' },
  flag: { fontSize: 11, color: colors.warningText, fontWeight: '700' },

  right: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hours: { fontSize: 11.5, fontWeight: '800', color: colors.slate600 },

  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.35)',
  },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
    paddingBottom: 28,
  },
  sheetBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: colors.slate100,
  },
  sheetTitle: {
    fontSize: 11, fontWeight: '800', textTransform: 'uppercase',
    letterSpacing: 0.5, color: colors.slate500,
  },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  sheetRowText: { fontSize: 13, fontWeight: '600', color: colors.textLight },
  });
}
