import React from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Button, Card } from '../../components/ui';
import { colors, radii } from '../../theme/tokens';
import { useAuthStore } from '../../stores/authStore';
import { getAttendanceHistory } from '../../api/attendance.api';

const today = () => new Date().toISOString().slice(0, 10);

export function HomeScreen() {
  const employee = useAuthStore((s) => s.employee);
  const store = useAuthStore((s) => s.store);
  const navigation = useNavigation<any>();

  const { data, isLoading } = useQuery({
    queryKey: ['attendance-today', employee?.id],
    queryFn: () => getAttendanceHistory(employee!.id, today(), today()),
    enabled: !!employee,
  });

  const marks = data ?? [];
  const clockInMark = marks.find((m) => m.mark_type === 'clock-in');
  const clockOutMark = marks.find((m) => m.mark_type === 'clock-out');
  const isOnShift = !!clockInMark && !clockOutMark;

  return (
    <SafeAreaView style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, isOnShift ? styles.heroActive : styles.heroInactive]}>
          <Text style={styles.heroLabel}>
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </Text>
          <Text style={styles.heroTitle}>
            {clockOutMark ? 'Shift complete' : isOnShift ? 'On shift' : 'Not clocked in'}
          </Text>
          <Text style={styles.heroSubtitle}>{store?.name ?? '—'}</Text>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Clock-in</Text>
              <Text style={styles.heroStatValue}>
                {clockInMark ? new Date(clockInMark.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
              </Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Clock-out</Text>
              <Text style={styles.heroStatValue}>
                {clockOutMark ? new Date(clockOutMark.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
              </Text>
            </View>
          </View>
        </View>

        <Button
          title={clockOutMark ? 'View attendance' : isOnShift ? 'Clock out' : 'Clock in with live photo'}
          onPress={() => navigation.navigate('Attendance')}
        />

        <Card>
          <Text style={styles.cardTitle}>Today's timeline</Text>
          {isLoading ? (
            <ActivityIndicator color={colors.brand[700]} />
          ) : marks.length === 0 ? (
            <Text style={styles.emptyText}>No activity yet — clock in to start.</Text>
          ) : (
            marks.map((m) => (
              <View key={m.id} style={styles.timelineRow}>
                <View style={[styles.dot, m.inside_geofence === false ? styles.dotOutside : styles.dotInside]} />
                <Text style={styles.timelineType}>{m.mark_type.replace('-', ' ')}</Text>
                <Text style={styles.timelineTime}>
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgLight },
  content: { padding: 16, gap: 14 },
  hero: { borderRadius: radii.xl, padding: 18 },
  heroActive: { backgroundColor: colors.brand[700] },
  heroInactive: { backgroundColor: colors.brand[600] },
  heroLabel: { color: colors.white, opacity: 0.8, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  heroTitle: { color: colors.white, fontSize: 22, fontWeight: '800', marginTop: 4 },
  heroSubtitle: { color: colors.white, opacity: 0.85, fontSize: 12, marginTop: 2 },
  heroStatsRow: { flexDirection: 'row', gap: 24, marginTop: 16 },
  heroStat: { flex: 1 },
  heroStatLabel: { color: colors.white, opacity: 0.7, fontSize: 10 },
  heroStatValue: { color: colors.white, fontSize: 15, fontWeight: '700', marginTop: 2 },
  cardTitle: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', color: colors.slate500, marginBottom: 8 },
  emptyText: { fontSize: 12, color: colors.slate400 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotInside: { backgroundColor: colors.success },
  dotOutside: { backgroundColor: colors.danger },
  timelineType: { flex: 1, fontSize: 12, color: colors.textLight, textTransform: 'capitalize' },
  timelineTime: { fontSize: 12, color: colors.slate500 },
});
