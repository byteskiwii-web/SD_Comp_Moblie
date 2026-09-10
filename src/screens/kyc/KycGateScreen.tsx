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
import { KycCheckStatus, KYC_STATUS_KEY as STATUS_KEY, kycStatusTone as statusTone } from '../../api/verification.api';
import { KycStackParamList } from '../../navigation/types';
import { useT } from '../../i18n';

type Nav = NativeStackNavigationProp<KycStackParamList>;

function StatusRow({ label, status }: { label: string; status: KycCheckStatus }) {
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const tone = statusTone(status, colors);
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <View style={[styles.chip, { backgroundColor: tone.bg }]}>
        <Text style={[styles.chipText, { color: tone.fg }]}>{t(STATUS_KEY[status])}</Text>
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
  const t = useT();

  const panDone = kyc?.pan.status === 'verified';

  return (
    <SafeAreaView style={styles.flex}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('kyc.gate')}</Text>
        <Text style={styles.subtitle}>
          {t('kyc.gateBody')}
        </Text>

        {isError ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText}>
              {t('kyc.loadFailed')}
            </Text>
            <View style={styles.retryGap}>
              <Button title={t('common.retry')} onPress={() => refetch()} loading={isFetching} />
            </View>
          </Card>
        ) : (
          <>
            <Card style={styles.statusCard}>
              <StatusRow label={t('kyc.pan')} status={kyc?.pan.status ?? 'pending'} />
              <View style={styles.divider} />
              <StatusRow label={t('kyc.aadhaar')} status={kyc?.aadhaar.status ?? 'pending'} />
            </Card>

            {isFetching ? <Text style={styles.refreshing}>{t('common.refreshing')}</Text> : null}

            <View style={styles.ctaGap}>
              {!panDone ? (
                <Button
                  title={kyc?.pan.status === 'failed' ? t('kyc.retryPan') : t('kyc.startPan')}
                  onPress={() => navigation.navigate('PanVerify')}
                />
              ) : (
                <Button
                  title={kyc?.aadhaar.status === 'failed' ? t('kyc.retryAadhaar') : t('kyc.verifyAadhaar')}
                  onPress={() => navigation.navigate('AadhaarOtpRequest')}
                />
              )}
            </View>
          </>
        )}

        <View style={styles.signOutGap}>
          <Button variant="outline" title={t('common.signOut')} onPress={() => signOut()} />
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
