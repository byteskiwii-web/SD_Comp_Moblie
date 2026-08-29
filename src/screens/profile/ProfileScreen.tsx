import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
          <Row label="Phone" value={employee?.phone ?? '—'} />
          <Row label="Email" value={employee?.email ?? '—'} />
          <Row label="Store" value={store?.name ?? '—'} last />
        </Card>

        <Button title="Sign out" variant="outline" onPress={() => signOut()} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
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
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.slate100,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 12, fontWeight: '600', color: colors.slate500 },
  rowValue: { fontSize: 13, fontWeight: '700', color: colors.textLight },
});
