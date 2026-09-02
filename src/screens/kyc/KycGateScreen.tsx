import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Card } from '../../components/ui';
import { colors, radii } from '../../theme/tokens';
import { useAuthStore } from '../../stores/authStore';
import { useKycGate } from '../../hooks/useKycGate';
import { KycCheckStatus } from '../../api/verification.api';
import { KycStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<KycStackParamList>;

const STATUS_LABEL: Record<KycCheckStatus, string> = {
  verified: 'Verified',
  pending: 'Pending',
  failed: 'Failed',
};

function statusTone(status: KycCheckStatus) {
  if (status === 'verified') return { bg: colors.successBg, fg: colors.success };
  if (status === 'failed') return { bg: colors.dangerBg, fg: colors.danger };
  return { bg: colors.warningBg, fg: colors.warning };
}

function StatusRow({ label, status }: { label: string; status: KycCheckStatus }) {
  const tone = statusTone(status);
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <View style={[styles.chip, { backgroundColor: tone.bg }]}>
        <Text style={[styles.chipText, { color: tone.fg }]}>{STATUS_LABEL[status]}</Text>
      </View>
    </View>
  );
}

export function KycGateScreen() {
  const navigation = useNavigation<Nav>();
  const signOut = useAuthStore((s) => s.signOut);
  const { kyc, isError, isFetching, refetch } = useKycGate();

  const panDone = kyc?.pan.status === 'verified';

  return (
    <SafeAreaView style={styles.flex}>
      <View style={styles.content}>
        <Text style={styles.title}>Complete your KYC</Text>
        <Text style={styles.subtitle}>
          To keep attendance records secure and compliant, we need to verify your PAN and Aadhaar before you
          can clock in. This takes about 2 minutes.
        </Text>

        {isError ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText}>
              We couldn't confirm your verification status. Check your connection and try again.
            </Text>
            <View style={styles.retryGap}>
              <Button title="Retry" onPress={() => refetch()} loading={isFetching} />
            </View>
          </Card>
        ) : (
          <>
            <Card style={styles.statusCard}>
              <StatusRow label="PAN Verification" status={kyc?.pan.status ?? 'pending'} />
              <View style={styles.divider} />
              <StatusRow label="Aadhaar Verification" status={kyc?.aadhaar.status ?? 'pending'} />
            </Card>

            {isFetching ? <Text style={styles.refreshing}>Refreshing…</Text> : null}

            <View style={styles.ctaGap}>
              {!panDone ? (
                <Button
                  title={kyc?.pan.status === 'failed' ? 'Retry PAN Verification' : 'Start PAN Verification'}
                  onPress={() => navigation.navigate('PanVerify')}
                />
              ) : (
                <Button
                  title={kyc?.aadhaar.status === 'failed' ? 'Retry Aadhaar Verification' : 'Verify Aadhaar'}
                  onPress={() => navigation.navigate('AadhaarOtpRequest')}
                />
              )}
            </View>
          </>
        )}

        <View style={styles.signOutGap}>
          <Button variant="outline" title="Sign out" onPress={() => signOut()} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '800', color: colors.textLight, textAlign: 'center' },
  subtitle: {
    fontSize: 13,
    color: colors.slate500,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 28,
    lineHeight: 19,
  },
  statusCard: { marginBottom: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  statusLabel: { fontSize: 14, fontWeight: '600', color: colors.textLight },
  divider: { height: 1, backgroundColor: colors.slate100 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill },
  chipText: { fontSize: 12, fontWeight: '700' },
  refreshing: { fontSize: 12, color: colors.slate400, textAlign: 'center', marginTop: 10 },
  ctaGap: { marginTop: 24 },
  errorCard: { alignItems: 'center' },
  errorText: { fontSize: 13, color: colors.slate600, textAlign: 'center', lineHeight: 19 },
  retryGap: { marginTop: 16, alignSelf: 'stretch' },
  signOutGap: { marginTop: 32 },
});
