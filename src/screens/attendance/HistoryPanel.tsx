import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../components/ui';
import { colors } from '../../theme/tokens';
import { useAuthStore } from '../../stores/authStore';
import { getAttendanceHistory } from '../../api/attendance.api';
import { getApiErrorMessage } from '../../api/client';
import { formatDate, formatTime } from '../../utils/datetime';
import type { AttendanceMark } from '../../types/attendance';

const fmtDate = (dateStr: string) => formatDate(dateStr);
const fmtTime = (ts: string) => formatTime(ts);

export function HistoryPanel() {
  const employee = useAuthStore((s) => s.employee);

  const { data, isLoading, error } = useQuery({
    queryKey: ['attendance-history-all', employee?.id],
    queryFn: () => getAttendanceHistory(employee!.id),
    enabled: !!employee,
  });

  const grouped = useMemo(() => {
    const marks = data ?? [];
    const byDate = new Map<string, AttendanceMark[]>();
    for (const m of marks) {
      const list = byDate.get(m.mark_date) ?? [];
      list.push(m);
      byDate.set(m.mark_date, list);
    }
    return Array.from(byDate.entries());
  }, [data]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand[700]} />
      </View>
    );
  }

  if (error) {
    // The reason, not a shrug. An expired session, an offline phone and a
    // server fault need different things from whoever is reading this, and a
    // single sentence for all three tells them nothing.
    return <Text style={styles.errorText}>{getApiErrorMessage(error)}</Text>;
  }

  if (grouped.length === 0) {
    return <Text style={styles.emptyText}>No punches recorded yet.</Text>;
  }

  return (
    <View style={styles.wrap}>
      {grouped.map(([date, marks]) => (
        <Card key={date} style={styles.dayCard}>
          <Text style={styles.dayLabel}>{fmtDate(date)}</Text>
          {marks.map((m) => (
            <View key={m.id} style={styles.markRow}>
              <View
                style={[
                  styles.dot,
                  m.inside_geofence === false ? styles.dotOutside : styles.dotInside,
                ]}
              />
              <Text style={styles.markType}>{m.mark_type.replace('-', ' ')}</Text>
              <Text style={styles.markTime}>{fmtTime(m.timestamp)}</Text>
              {m.approval_status === 'pending-approval' && (
                <Text style={styles.pendingBadge}>pending</Text>
              )}
            </View>
          ))}
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  center: { padding: 24, alignItems: 'center' },
  errorText: { color: colors.danger, textAlign: 'center', padding: 16 },
  emptyText: { color: colors.slate500, textAlign: 'center', padding: 16 },
  dayCard: { gap: 6 },
  dayLabel: { fontSize: 12, fontWeight: '800', color: colors.slate700, marginBottom: 4 },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotInside: { backgroundColor: colors.success },
  dotOutside: { backgroundColor: colors.danger },
  markType: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.textLight, textTransform: 'capitalize' },
  markTime: { fontSize: 12, color: colors.slate500, fontVariant: ['tabular-nums'] },
  pendingBadge: {
    fontSize: 10, fontWeight: '700', color: colors.warning, backgroundColor: colors.warningBg,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden',
  },
});
