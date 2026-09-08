import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../components/ui';
import { colors, radii } from '../../theme/tokens';
import { useAuthStore } from '../../stores/authStore';
import { getAttendanceHistory } from '../../api/attendance.api';
import { getApiErrorMessage } from '../../api/client';
import { formatTime, toLocalDateKey } from '../../utils/datetime';
import { formatDuration, punctuality, summariseDays, type DaySummary } from '../../utils/attendanceDay';

/**
 * Logs and shifts.
 *
 * A day is the unit people think in, so raw punches are rolled up into one card
 * each: when the shift ran, whether it started on time, and the two hour counts
 * that mean different things — gross is time on site, effective is gross minus
 * breaks. Tap a card for the individual stamps behind those numbers.
 *
 * The reference build also shows "Week Off" days. There is no roster in this
 * API — nothing says which days somebody was scheduled — so days with no
 * punches are simply absent rather than labelled with a guess.
 */

type Range = { key: string; label: string; from: string; to: string };

function buildRanges(): Range[] {
  const now = new Date();
  const ranges: Range[] = [];

  const thirty = new Date(now);
  thirty.setDate(thirty.getDate() - 29);
  ranges.push({
    key: 'last30',
    label: 'Last 30 Days',
    from: toLocalDateKey(thirty),
    to: toLocalDateKey(now),
  });

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  for (let back = 1; back <= 3; back++) {
    const first = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const last = new Date(now.getFullYear(), now.getMonth() - back + 1, 0);
    ranges.push({
      key: `m${back}`,
      label: MONTHS[first.getMonth()],
      from: toLocalDateKey(first),
      to: toLocalDateKey(last),
    });
  }
  return ranges;
}

const shortDate = (key: string) => {
  const d = new Date(`${key}T00:00:00`);
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
const longDate = (key: string) => {
  const d = new Date(`${key}T00:00:00`);
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

export function HistoryPanel() {
  const employee = useAuthStore((s) => s.employee);
  const profile = useAuthStore((s) => s.profile);

  const ranges = useMemo(buildRanges, []);
  const [range, setRange] = useState<Range>(ranges[0]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['attendance-history', employee?.id, range.from, range.to],
    queryFn: () => getAttendanceHistory(employee!.id, range.from, range.to),
    enabled: !!employee,
  });

  const days = useMemo(() => summariseDays(data ?? []), [data]);

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.rangeRow} onPress={() => setPickerOpen(true)} accessibilityRole="button">
        <View>
          <Text style={styles.rangeLabel}>{range.label}</Text>
          <Text style={styles.rangeDates}>
            ({shortDate(range.from)} – {shortDate(range.to)})
          </Text>
        </View>
        <View style={styles.rangeChevron}>
          <Ionicons name="chevron-down" size={15} color={colors.brand[700]} />
        </View>
      </Pressable>

      {isLoading ? (
        <ActivityIndicator color={colors.brand[700]} style={styles.spacer} />
      ) : error ? (
        <Text style={styles.error}>{getApiErrorMessage(error)}</Text>
      ) : days.length === 0 ? (
        <Text style={styles.empty}>No punches recorded in this period.</Text>
      ) : (
        days.map((day) => (
          <DayCard
            key={day.date}
            day={day}
            shiftStart={profile?.shiftStart ?? null}
            shiftEnd={profile?.shiftEnd ?? null}
            open={expanded === day.date}
            onToggle={() => setExpanded(expanded === day.date ? null : day.date)}
          />
        ))
      )}

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetBar}>
            <Text style={styles.sheetTitle}>Select attendance timeframe</Text>
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
              <Text style={styles.sheetRowText}>{r.label}</Text>
              {r.key === range.key && <Ionicons name="checkmark" size={19} color={colors.brand[700]} />}
            </Pressable>
          ))}
        </View>
      </Modal>
    </View>
  );
}

function DayCard({
  day,
  shiftStart,
  shiftEnd,
  open,
  onToggle,
}: {
  day: DaySummary;
  shiftStart: string | null;
  shiftEnd: string | null;
  open: boolean;
  onToggle: () => void;
}) {
  const status = punctuality(day.firstIn, shiftStart);
  const window =
    day.firstIn && day.lastOut
      ? `${formatTime(day.firstIn.timestamp)} - ${formatTime(day.lastOut.timestamp)}`
      : day.firstIn
        ? `${formatTime(day.firstIn.timestamp)} - —`
        : '—';

  return (
    <Card style={styles.dayCard}>
      <Pressable onPress={onToggle} accessibilityRole="button">
        <Text style={styles.dayHeading}>{longDate(day.date)}</Text>

        <View style={styles.divider} />

        <View style={styles.topRow}>
          <Text style={styles.window} numberOfLines={1}>
            {window}
            {shiftStart && shiftEnd ? <Text style={styles.shiftName}>  ·  Rostered {shiftStart.slice(0, 5)}–{shiftEnd.slice(0, 5)}</Text> : null}
          </Text>
          {status && (
            <View style={[styles.badge, status === 'on-time' ? styles.badgeOk : styles.badgeLate]}>
              <Text style={[styles.badgeText, status === 'on-time' ? styles.badgeTextOk : styles.badgeTextLate]}>
                {status === 'on-time' ? 'ON TIME' : 'LATE'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.punchRow}>
          <View style={styles.punch}>
            <Ionicons name="arrow-down-outline" size={15} color={colors.success} />
            <Text style={styles.punchTime}>{day.firstIn ? formatTime(day.firstIn.timestamp) : '—'}</Text>
          </View>
          <View style={styles.punchRight}>
            <Ionicons name="arrow-up-outline" size={15} color={colors.danger} />
            <Text style={styles.punchTime}>{day.lastOut ? formatTime(day.lastOut.timestamp) : '—'}</Text>
          </View>
        </View>

        <View style={styles.hoursRow}>
          <Text style={styles.hoursLabel}>
            Effective hours: <Text style={styles.hoursValue}>{formatDuration(day.effectiveMinutes)}</Text>
          </Text>
          <Text style={styles.hoursLabel}>
            Gross hours: <Text style={styles.hoursValue}>{formatDuration(day.grossMinutes)}</Text>
          </Text>
        </View>

        {day.openEnded && <Text style={styles.note}>No clock-out recorded — raise a correction under Regularise.</Text>}
        {day.hasOutsideFence && <Text style={styles.note}>A punch that day was outside the store radius.</Text>}
      </Pressable>

      {open && (
        <View style={styles.logs}>
          <Text style={styles.logsTitle}>{day.storeName ?? 'Time logs'}</Text>
          {day.marks.map((m) => {
            const isIn = m.mark_type === 'clock-in' || m.mark_type === 'break-end';
            return (
              <View key={m.id} style={styles.logRow}>
                <Ionicons
                  name={isIn ? 'arrow-down-outline' : 'arrow-up-outline'}
                  size={14}
                  color={isIn ? colors.success : colors.danger}
                />
                <Text style={styles.logType}>{m.mark_type.replace('-', ' ')}</Text>
                <Text style={styles.logTime}>{formatTime(m.timestamp)}</Text>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },

  rangeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 4, paddingHorizontal: 2,
  },
  rangeLabel: { fontSize: 19, fontWeight: '800', color: colors.textLight, letterSpacing: -0.3 },
  rangeDates: { fontSize: 12, color: colors.slate500, marginTop: 2, fontWeight: '600' },
  rangeChevron: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brand[50],
    alignItems: 'center', justifyContent: 'center',
  },

  spacer: { marginVertical: 24 },
  error: { color: colors.danger, fontSize: 13, fontWeight: '600', paddingVertical: 12 },
  empty: { fontSize: 13, color: colors.slate400, paddingVertical: 12 },

  dayCard: { padding: 0, overflow: 'hidden' },
  dayHeading: { fontSize: 14, fontWeight: '800', color: colors.textLight, padding: 14, paddingBottom: 12 },
  divider: { height: 1, backgroundColor: colors.slate100 },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 12 },
  window: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textLight },
  shiftName: { fontSize: 11.5, fontWeight: '600', color: colors.slate400 },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radii.sm },
  badgeOk: { backgroundColor: colors.successBg },
  badgeLate: { backgroundColor: colors.warningBg },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  badgeTextOk: { color: '#047857' },
  badgeTextLate: { color: '#B45309' },

  punchRow: { flexDirection: 'row', paddingHorizontal: 14, paddingTop: 10 },
  punch: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  punchRight: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end' },
  punchTime: { fontSize: 16, fontWeight: '800', color: colors.textLight, letterSpacing: 0.2 },

  hoursRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14,
  },
  hoursLabel: { fontSize: 12, color: colors.slate500, fontWeight: '600' },
  hoursValue: { color: colors.textLight, fontWeight: '800' },

  note: {
    fontSize: 11.5, color: '#B45309', fontWeight: '600',
    paddingHorizontal: 14, paddingBottom: 12, marginTop: -6,
  },

  logs: { borderTopWidth: 1, borderTopColor: colors.slate100, backgroundColor: colors.slate50, padding: 14 },
  logsTitle: {
    fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4,
    color: colors.slate500, marginBottom: 8,
  },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  logType: { flex: 1, fontSize: 12.5, color: colors.slate600, fontWeight: '600', textTransform: 'capitalize' },
  logTime: { fontSize: 13, fontWeight: '700', color: colors.textLight },

  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.35)',
  },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.white, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
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
  sheetRowText: { fontSize: 15, fontWeight: '600', color: colors.textLight },
});
