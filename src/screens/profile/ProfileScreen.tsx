import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Button, Card } from '../../components/ui';
import { colors } from '../../theme/tokens';
import { useAuthStore } from '../../stores/authStore';

export function ProfileScreen() {
  const employee = useAuthStore((s) => s.employee);
  const store = useAuthStore((s) => s.store);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <SafeAreaView style={styles.flex}>
      <View style={styles.content}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>{employee?.first_name?.[0] ?? '?'}</Text>
        </View>
        <Text style={styles.name}>
          {employee?.first_name} {employee?.last_name}
        </Text>
        <Text style={styles.role}>{employee?.id} · {employee?.role}</Text>

        <Card style={styles.card}>
          <Row label="Phone" value={employee?.phone ?? '—'} />
          <Row label="Email" value={employee?.email ?? '—'} />
          <Row label="Store" value={store?.name ?? '—'} />
        </Card>

        <Button title="Sign out" variant="outline" onPress={() => signOut()} />
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
  content: { flex: 1, padding: 20, alignItems: 'center', paddingTop: 40 },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brand[700],
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarInitial: { color: colors.white, fontSize: 28, fontWeight: '800' },
  name: { fontSize: 18, fontWeight: '800', color: colors.textLight },
  role: { fontSize: 12, color: colors.slate500, marginTop: 2, marginBottom: 20 },
  card: { width: '100%', marginBottom: 24 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: colors.slate100,
  },
  rowLabel: { fontSize: 11, fontWeight: '700', color: colors.slate500, textTransform: 'uppercase' },
  rowValue: { fontSize: 13, fontWeight: '600', color: colors.textLight },
});
