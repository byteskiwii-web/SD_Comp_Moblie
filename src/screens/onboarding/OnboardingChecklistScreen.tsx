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
 * In the order they are done: profile, PAN + Aadhaar verification (one row --
 * see toDisplayRows below), bank, a face photo, HR approval. Each open row is
 * a button to the screen that completes it; the last one is HR's and says so.
 * The line at the top says plainly why the rest of the app is not here yet.
 *
 * Replaces the profile-completion gate and the KYC gate, which showed one
 * step at a time with no sense of how many were left.
 */
const ORDER: OnboardingStep[] = ['profile', 'pan', 'aadhaar', 'link', 'bank', 'face', 'approval'];

/**
 * Where each open row goes. Both providers verify PAN and Aadhaar together
 * (capabilities.combinedPanAadhaar), so there is no separate OTP step and
 * the PAN screen verifies both, and the row points there instead.
 */
function routesFor(combinedPanAadhaar: boolean): Partial<Record<OnboardingStep, string>> {
  return {
    profile: 'CompleteProfile',
    pan: 'PanVerify',
    aadhaar: combinedPanAadhaar ? 'PanVerify' : 'AadhaarOtpRequest',
    link: 'PanVerify',
    bank: 'BankVerify',
    face: 'FaceRegister',
  };
}

/**
 * A row on screen, which is either a real onboarding step or the merged
 * PAN+Aadhaar row below.
 */
type DisplayStep = OnboardingStep | 'panAadhaar';

/** The three server-side steps a single PAN-screen submission satisfies together. */
const PAN_GROUP: OnboardingStep[] = ['pan', 'aadhaar', 'link'];

/**
 * Collapses `pan` + `aadhaar` + `link` into one row: under
 * capabilities.combinedPanAadhaar they are the same screen and the same
 * submission, so three separate rows all leading to an identical form read
 * as broken, not thorough. Steps this employee's `required` list does not
 * include are already absent from `rows` and stay absent here.
 */
function toDisplayRows(rows: OnboardingStep[], combinedPanAadhaar: boolean): DisplayStep[] {
  if (!combinedPanAadhaar) return rows;
  const result: DisplayStep[] = [];
  let mergedIn = false;
  for (const step of rows) {
    if (PAN_GROUP.includes(step)) {
      if (!mergedIn) {
        result.push('panAadhaar');
        mergedIn = true;
      }
    } else {
      result.push(step);
    }
  }
  return result;
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
  const combinedPanAadhaar = kyc.data?.capabilities.combinedPanAadhaar ?? false;
  const ROUTE = React.useMemo(() => routesFor(combinedPanAadhaar), [combinedPanAadhaar]);

  const steps = status?.steps;
  /* Only what the server is holding them to, in checklist order. A server with
     verification switched off enforces profile and HR approval alone, and the
     four KYC rows would otherwise sit here forever with no way to tick them. */
  const rows = React.useMemo(
    () => (status?.required ? ORDER.filter((s) => status.required!.includes(s)) : ORDER),
    [status?.required]
  );
  const displayRows = React.useMemo(() => toDisplayRows(rows, combinedPanAadhaar), [rows, combinedPanAadhaar]);
  /** The merged row is done only once every underlying step it stands in for is done. */
  const isDisplayDone = (step: DisplayStep): boolean =>
    step === 'panAadhaar' ? PAN_GROUP.every((s) => !rows.includes(s) || Boolean(steps?.[s])) : Boolean(steps?.[step]);
  const displayRoute = (step: DisplayStep): string | undefined => (step === 'panAadhaar' ? ROUTE.pan : ROUTE[step]);
  const done = displayRows.filter((s) => isDisplayDone(s)).length;
  const rejected = status?.approvalStatus === 'rejected';
  /* The next thing to do, so the big button at the bottom always goes somewhere. */
  const next = displayRows.find((s) => !isDisplayDone(s) && displayRoute(s));

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
              <Text style={styles.progressText}>{t('checklist.progress', { done, total: displayRows.length })}</Text>
              <View style={styles.bar}><View style={[styles.barFill, { width: `${(done / Math.max(1, displayRows.length)) * 100}%` }]} /></View>
            </View>

            {displayRows.map((step, i) => {
              const ok = isDisplayDone(step);
              const isApproval = step === 'approval';
              const route = displayRoute(step);
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
              const rowStyle = [styles.row, i === displayRows.length - 1 && styles.rowLast];
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
            <Button title={t('checklist.continue')} onPress={() => navigation.navigate(displayRoute(next)!)} />
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
