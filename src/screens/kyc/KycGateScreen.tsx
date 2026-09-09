import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Card } from '../../components/ui';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import { useKycGate } from '../../hooks/useKycGate';
import { KycCheckStatus, KYC_STATUS_LABEL as STATUS_LABEL, kycStatusTone as statusTone } from '../../api/verification.api';
import { KycStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<KycStackParamList>;

function StatusRow({ label, status }: { label: string; status: KycCheckStatus }) {
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const tone = statusTone(status, colors);
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
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

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

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.bgLight },
    content: { flex: 1, justifyContent: 'center', padding: 24 },
    title: { fontSize: 19, fontWeight: '800', color: colors.textLight, textAlign: 'center' },
    subtitle: {
      fontSize: 11.5,
      color: colors.slate500,
      textAlign: 'center',
      marginTop: 10,
      marginBottom: 28,
      lineHeight: 19,
    },
    statusCard: { marginBottom: 8 },
    statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
    statusLabel: { fontSize: 12.5, fontWeight: '600', color: colors.textLight },
    divider: { height: 1, backgroundColor: colors.slate100 },
    chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill },
    chipText: { fontSize: 11, fontWeight: '700' },
    refreshing: { fontSize: 11, color: colors.slate400, textAlign: 'center', marginTop: 10 },
    ctaGap: { marginTop: 24 },
    errorCard: { alignItems: 'center' },
    errorText: { fontSize: 11.5, color: colors.slate600, textAlign: 'center', lineHeight: 19 },
    retryGap: { marginTop: 16, alignSelf: 'stretch' },
    signOutGap: { marginTop: 32 },
  });
}
