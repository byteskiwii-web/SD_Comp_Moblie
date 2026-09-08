import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../components/ui';
import { colors, radii } from '../../theme/tokens';
import { useAuthStore } from '../../stores/authStore';
import { getAttendanceHistory } from '../../api/attendance.api';
import { formatDuration, summariseDays } from '../../utils/attendanceDay';
import { toLocalDateKey } from '../../utils/datetime';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/**
 * This month at a glance.
 *
 * Present is days with at least one punch. The counterpart is labelled NOT
 * MARKED rather than Absent, and that is a deliberate distinction: this API has
 * no roster, so nothing says which days somebody was scheduled. Counting every
 * dayless date as an absence would score weekly offs and holidays against
 * people, on their own home screen. When a roster endpoint exists this becomes
 * a true Absent and the label can change.
 *
 * Only elapsed days count — the rest of the month is not yet anything.
 */
export function MonthlyStatsCard() {
  const employee = useAuthStore((s) => s.employee);

  const range = useMemo(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      from: toLocalDateKey(first),
      to: toLocalDateKey(now),
      label: MONTHS[now.getMonth()],
      elapsed: now.getDate(),
    };
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['attendance-month', employee?.id, range.from, range.to],
    queryFn: () => getAttendanceHistory(employee!.id, range.from, range.to),
    enabled: !!employee,
  });

  const stats = useMemo(() => {
    const days = summariseDays(data ?? []);
    const present = days.filter((d) => d.firstIn).length;
    const minutes = days.reduce((t, d) => t + (d.effectiveMinutes ?? 0), 0);
    return { present, notMarked: Math.max(0, range.elapsed - present), minutes };
  }, [data, range.elapsed]);

  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.title}>{range.label}</Text>
        <Text style={styles.sub}>through day {range.elapsed}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.brand[700]} style={styles.spacer} />
      ) : (
        <>
          <View style={styles.row}>
            <Tile value={String(stats.present)} label="Present" tone="ok" />
            <Tile value={String(stats.notMarked)} label="Not marked" tone="warn" />
            <Tile value={formatDuration(stats.minutes)} label="Hours" tone="plain" />
          </View>
          <Text style={styles.footnote}>
            Days off aren't distinguished yet, so "not marked" includes your weekly offs.
          </Text>
        </>
      )}
    </Card>
  );
}

function Tile({ value, label, tone }: { value: string; label: string; tone: 'ok' | 'warn' | 'plain' }) {
  return (
    <View style={styles.tile}>
      <Text
        style={[
          styles.tileValue,
          tone === 'ok' && styles.tileOk,
          tone === 'warn' && styles.tileWarn,
        ]}
      >
        {value}
      </Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 },
  title: {
    fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4,
    color: colors.slate500,
  },
  sub: { fontSize: 11, color: colors.slate400, fontWeight: '600' },
  spacer: { marginVertical: 12 },

  row: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1, borderWidth: 1, borderColor: colors.slate200, borderRadius: radii.md,
    paddingVertical: 12, paddingHorizontal: 10, alignItems: 'flex-start',
  },
  tileValue: { fontSize: 20, fontWeight: '800', color: colors.textLight, letterSpacing: -0.4 },
  tileOk: { color: '#047857' },
  tileWarn: { color: '#B45309' },
  tileLabel: { fontSize: 11, color: colors.slate500, fontWeight: '700', marginTop: 3 },

  footnote: { fontSize: 11, color: colors.slate400, marginTop: 10, lineHeight: 15 },
});
