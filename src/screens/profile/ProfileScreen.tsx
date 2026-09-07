import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { getPolicies } from '../../api/policies.api';
import { formatDate } from '../../utils/datetime';
import { Button, Card } from '../../components/ui';
import { colors, radii } from '../../theme/tokens';
import { useAuthStore } from '../../stores/authStore';

const ROLE_LABEL: Record<string, string> = {
  'field-employee': 'Field Employee',
  'site-manager': 'Site Manager',
  'hr-manager': 'HR Manager',
  'super-admin': 'Super Admin',
};

export function ProfileScreen() {
  const employee = useAuthStore((s) => s.employee);
  const store = useAuthStore((s) => s.store);
  const signOut = useAuthStore((s) => s.signOut);
  const profile = useAuthStore((s) => s.profile);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const [refreshing, setRefreshing] = React.useState(false);

  // Pull to refresh: the automatic read happens at boot, and somebody whose
  // details were changed while the app was open needs a way to ask again
  // without signing out.
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  }, [refreshProfile]);

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand[700]} />}
      >
        <View style={styles.heroCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>{employee?.first_name?.[0] ?? '?'}</Text>
          </View>
          <Text style={styles.name}>
            {employee?.first_name} {employee?.last_name}
          </Text>
          <View style={styles.pillRow}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>{employee?.id}</Text>
            </View>
            <View style={[styles.pill, styles.pillBrand]}>
              <Text style={[styles.pillText, styles.pillTextBrand]}>
                {employee?.role ? (ROLE_LABEL[employee.role] ?? employee.role) : '—'}
              </Text>
            </View>
          </View>
        </View>

        <Card>
          <Text style={styles.cardTitle}>Contact & assignment</Text>
          <Row icon="call-outline" label="Phone" value={employee?.phone ?? '—'} />
          <Row icon="mail-outline" label="Email" value={employee?.email ?? '—'} />
          <Row icon="business-outline" label="Assigned site" value={store?.name ?? '—'} />
          <Row icon="pricetag-outline" label="Site code" value={store?.store_code ?? employee?.store_code ?? '—'} />
          <Row
            icon="navigate-outline"
            label="Geo-fence"
            value={store?.geofence_radius_m ? store.geofence_radius_m + ' m radius' : '—'}
          />
          <Row
            icon="time-outline"
            label="Shift"
            value={profile?.shiftStart && profile?.shiftEnd ? profile.shiftStart + ' – ' + profile.shiftEnd : '—'}
          />
          <Row
            icon="calendar-outline"
            label="Joined"
            value={profile?.dateOfJoining ? formatDate(profile.dateOfJoining) : '—'}
            last
          />
        </Card>

        <PolicyLibrary />

        <Button title="Sign out" variant="outline" onPress={() => signOut()} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  icon,
  label,
  value,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Ionicons name={icon} size={15} color={colors.slate400} style={styles.rowIcon} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/**
 * The policy library, read-only here. Anything still needing a signature is
 * surfaced on the home screen instead, where it can be acted on -- this is the
 * reference copy, so it says what exists and what has already been signed.
 */
function PolicyLibrary() {
  const { data } = useQuery({ queryKey: ['policies-library'], queryFn: () => getPolicies(50) });
  const items = data?.items ?? [];
  if (items.length === 0) return null;

  const signed = items.filter((p) => p.acknowledgedByMe).length;
  return (
    <Card>
      <Text style={styles.cardTitle}>Company policies</Text>
      <Text style={styles.policySummary}>
        {items.length} assigned to you · {signed} acknowledged
      </Text>
      {items.slice(0, 6).map((p, i) => (
        <View key={p.id} style={[styles.row, i === Math.min(items.length, 6) - 1 && styles.rowLast]}>
          <Ionicons
            name={p.acknowledgedByMe ? 'checkmark-circle' : 'ellipse-outline'}
            size={16}
            color={p.acknowledgedByMe ? colors.success : colors.slate300}
            style={styles.rowIcon}
          />
          <Text style={styles.rowLabel} numberOfLines={1}>
            {p.title}
          </Text>
          <Text style={styles.rowValue}>v{p.version}</Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgLight },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: colors.textLight, letterSpacing: -0.3 },
  content: { padding: 20, paddingTop: 12, gap: 16 },

  heroCard: { alignItems: 'center', paddingVertical: 8 },
  avatar: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: colors.brand[700],
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  avatarInitial: { color: colors.white, fontSize: 30, fontWeight: '800' },
  name: { fontSize: 19, fontWeight: '800', color: colors.textLight },
  pillRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  pill: { backgroundColor: colors.slate100, paddingHorizontal: 12, paddingVertical: 5, borderRadius: radii.pill },
  pillBrand: { backgroundColor: colors.brand[50] },
  pillText: { fontSize: 11, fontWeight: '700', color: colors.slate600 },
  pillTextBrand: { color: colors.brand[700] },

  cardTitle: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: colors.slate500, marginBottom: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.slate100,
  },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: { marginRight: 8 },
  rowLabel: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.slate500 },
  policySummary: { fontSize: 12, color: colors.slate400, fontWeight: '600', marginBottom: 6 },
  rowValue: { fontSize: 13, fontWeight: '700', color: colors.textLight },
});
