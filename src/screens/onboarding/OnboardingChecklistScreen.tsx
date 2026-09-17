import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Button, Card } from '../../components/ui';
import { LanguageChips } from '../../components/LanguageChips';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import { useOnboardingGate } from '../../hooks/useOnboardingGate';
import type { OnboardingStep } from '../../api/auth.api';
import { getKycStatus } from '../../api/verification.api';
import { useT, type TKey } from '../../i18n';

/**
 * The one screen a new employee sees until they can clock in.
 *
 * Six rows, in the order they are done: profile, PAN, Aadhaar, the
 * PAN–Aadhaar link, bank, HR approval. Each open row is a button to the
 * screen that completes it; the last one is HR's and says so. The line at
 * the top says plainly why the rest of the app is not here yet.
 *
 * Replaces the profile-completion gate and the KYC gate, which showed one
 * step at a time with no sense of how many were left.
 */
const ORDER: OnboardingStep[] = ['profile', 'pan', 'aadhaar', 'link', 'bank', 'approval'];

/**
 * Where each open row goes. Aadhaar depends on the provider: under a
 * combined PAN+Aadhaar provider (SurePass) there is no separate OTP step and
 * the PAN screen verifies both, so the row points there instead.
 */
function routesFor(combinedPanAadhaar: boolean): Partial<Record<OnboardingStep, string>> {
  return {
    profile: 'CompleteProfile',
    pan: 'PanVerify',
    aadhaar: combinedPanAadhaar ? 'PanVerify' : 'AadhaarOtpRequest',
    link: 'PanVerify',
    bank: 'BankVerify',
  };
}

export function OnboardingChecklistScreen() {
  const navigation = useNavigation<any>();
  const signOut = useAuthStore((s) => s.signOut);
  const employee = useAuthStore((s) => s.employee);
  const { status, isError, isFetching, refetch } = useOnboardingGate();
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  // Same query Profile's KYC card uses, for the provider's capabilities only.
  const kyc = useQuery({ queryKey: ['profile-kyc-status', employee?.id], queryFn: getKycStatus, enabled: !!employee, retry: false });
  const ROUTE = React.useMemo(() => routesFor(kyc.data?.capabilities.combinedPanAadhaar ?? false), [kyc.data]);

  const steps = status?.steps;
  const done = ORDER.filter((s) => steps?.[s]).length;
  const rejected = status?.approvalStatus === 'rejected';
  /* The next thing to do, so the big button at the bottom always goes somewhere. */
  const next = ORDER.find((s) => !steps?.[s] && ROUTE[s]);

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.brand[700]} />}
      >
        <View style={styles.langRow}><LanguageChips /></View>

        <Text style={styles.hello}>{t('checklist.hello', { name: employee?.first_name ?? '' })}</Text>
        <Text style={styles.title}>{t('checklist.title')}</Text>
        <Text style={styles.body}>{t('checklist.body')}</Text>

        {isError ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText}>{t('checklist.loadFailed')}</Text>
            <Button title={t('common.retry')} onPress={() => refetch()} loading={isFetching} />
          </Card>
        ) : (
          <Card>
            <View style={styles.progressRow}>
              <Text style={styles.progressText}>{t('checklist.progress', { done, total: ORDER.length })}</Text>
              <View style={styles.bar}><View style={[styles.barFill, { width: `${(done / ORDER.length) * 100}%` }]} /></View>
            </View>

            {ORDER.map((step, i) => {
              const ok = Boolean(steps?.[step]);
              const isApproval = step === 'approval';
              const route = ROUTE[step];
              const waiting = isApproval && !ok;
              const inner = (
                <>
                  <View style={[styles.mark, ok ? styles.markDone : waiting ? styles.markWait : styles.markTodo]}>
                    <Ionicons
                      name={ok ? 'checkmark' : waiting ? 'time-outline' : 'chevron-forward'}
                      size={15}
                      color={ok ? colors.white : waiting ? colors.warningText : colors.brand[700]}
                    />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, ok && styles.rowTitleDone]}>{t(`checklist.step.${step}` as TKey)}</Text>
                    <Text style={styles.rowSub}>
                      {ok
                        ? t('checklist.done')
                        : waiting
                          ? rejected
                            ? t('checklist.rejected', { reason: status?.approvalRejectionReason ?? '' })
                            : status?.selfComplete ? t('checklist.waitingHr') : t('checklist.afterSteps')
                          : t(`checklist.hint.${step}` as TKey)}
                    </Text>
                  </View>
                </>
              );
              const rowStyle = [styles.row, i === ORDER.length - 1 && styles.rowLast];
              return ok || !route ? (
                <View key={step} style={rowStyle}>{inner}</View>
              ) : (
                <Pressable
                  key={step}
                  onPress={() => navigation.navigate(route)}
                  style={({ pressed }) => [...rowStyle, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  {inner}
                </Pressable>
              );
            })}
          </Card>
        )}

        {next ? (
          <View style={styles.cta}>
            <Button title={t('checklist.continue')} onPress={() => navigation.navigate(ROUTE[next]!)} />
          </View>
        ) : status?.selfComplete && !status.complete ? (
          <View style={styles.waitCard}>
            <Ionicons name="checkmark-circle" size={20} color={colors.successText} />
            <Text style={styles.waitText}>{t('checklist.allSent')}</Text>
          </View>
        ) : null}

        <Button title={t('common.signOut')} variant="outline" onPress={() => signOut()} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.bgLight },
    content: { padding: 20, gap: 14, paddingBottom: 32 },
    langRow: { marginBottom: 4 },
    hello: { fontSize: 12, fontWeight: '600', color: colors.slate500 },
    title: { fontSize: 21, fontWeight: '800', color: colors.textLight, letterSpacing: -0.3, marginTop: -8 },
    body: { fontSize: 13, color: colors.slate600, lineHeight: 19 },
    progressRow: { marginBottom: 6 },
    progressText: { fontSize: 11.5, fontWeight: '800', color: colors.slate500, textTransform: 'uppercase', letterSpacing: 0.4 },
    bar: { height: 6, borderRadius: 3, backgroundColor: colors.slate100, marginTop: 8, overflow: 'hidden' },
    barFill: { height: '100%', backgroundColor: colors.brand[700] },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.slate100 },
    rowLast: { borderBottomWidth: 0 },
    pressed: { opacity: 0.6 },
    mark: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    markDone: { backgroundColor: colors.success },
    markTodo: { backgroundColor: colors.brand[50] },
    markWait: { backgroundColor: colors.warningBg },
    rowText: { flex: 1 },
    rowTitle: { fontSize: 14, fontWeight: '700', color: colors.textLight },
    rowTitleDone: { color: colors.slate500 },
    rowSub: { fontSize: 11.5, color: colors.slate500, marginTop: 2, lineHeight: 16 },
    cta: { marginTop: 4 },
    waitCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.successBg, borderRadius: radii.md, padding: 14 },
    waitText: { flex: 1, fontSize: 12.5, fontWeight: '600', color: colors.slate700, lineHeight: 18 },
    errorCard: { gap: 12 },
    errorText: { fontSize: 12.5, color: colors.dangerText, fontWeight: '600' },
  });
}
