import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Button, Card } from '../../components/ui';
import { colors } from '../../theme/tokens';
import { useAuthStore } from '../../stores/authStore';

// Placeholder — proves the login token round-trip works end to end.
// Real Home/Attendance/Profile screens (camera, liveness, geofencing,
// background location) are the next stage of this project.
export function HomeScreen() {
  const employee = useAuthStore((s) => s.employee);
  const store = useAuthStore((s) => s.store);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <SafeAreaView style={styles.flex}>
      <View style={styles.content}>
        <Text style={styles.welcome}>Signed in as</Text>
        <Text style={styles.name}>
          {employee?.first_name} {employee?.last_name}
        </Text>

        <Card style={styles.card}>
          <Row label="Employee ID" value={employee?.id ?? '—'} />
          <Row label="Role" value={employee?.role ?? '—'} />
          <Row label="Phone" value={employee?.phone ?? '—'} />
          <Row label="Email" value={employee?.email ?? '—'} />
          <Row label="Store" value={store?.name ?? '—'} />
        </Card>

        <View style={styles.signOutWrap}>
          <Button title="Sign out" variant="outline" onPress={() => signOut()} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgLight },
  content: { flex: 1, padding: 20, justifyContent: 'center' },
  welcome: { fontSize: 12, color: colors.slate500, textAlign: 'center' },
  name: { fontSize: 22, fontWeight: '800', color: colors.textLight, textAlign: 'center', marginBottom: 20 },
  card: { marginBottom: 24 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: colors.slate100,
  },
  rowLabel: { fontSize: 11, fontWeight: '700', color: colors.slate500, textTransform: 'uppercase' },
  rowValue: { fontSize: 13, fontWeight: '600', color: colors.textLight },
  signOutWrap: { marginTop: 8 },
});
