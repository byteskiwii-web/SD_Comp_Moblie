import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { getHealthDeps, getKycStatus, KYC_STATUS_KEY, KycCheckStatus, kycStatusTone } from '../../api/verification.api';
import { Card } from '../../components/ui';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import { useT } from '../../i18n';

/**
 * Identity-verification status: PAN, Aadhaar, bank.
 *
 * Reads GET /verification/status directly, NOT the gate check useKycGate.ts
 * uses -- they answer different questions. The gate asks "should Attendance be
 * blocked right now", which stays fail-open while verification is toggled off;
 * this card asks "what has this employee verified", which does not stop being
 * true when new verifications happen to be disabled. That route is mounted on
 * the backend unconditionally for exactly this reason.
 *
 * Rebuilt after the SDK 57 Profile rewrite dropped it: once KYC completes the
 * gate disappears, and without this there is nowhere in the app left to see
 * verification status.
 *
 * Shown to anyone POSTED TO A SITE, which is the real question -- not to a
 * named role, which is what this used to test and what quietly hid the whole
 * card from the first new on-site role that appeared (team-lead). KYC is
 * about having a PAN and an account that payroll pays into, and a team lead
 * has both exactly as a field employee does.
 *
 * store_code is the signal because it is the one that stays true: office
 * roles -- admin, HR, cluster manager -- carry no store, and a role list has
 * to be remembered every time somebody adds a role. The backend
 * scopes the subject to the caller regardless.
 */
export function KycCard() {
  const employee = useAuthStore((s) => s.employee);
  const worksAtSite = Boolean(employee?.store_code);
  // Above the early return below: a hook after a conditional `return null`
  // changes the hook count between renders the moment the role resolves.
  const navigation = useNavigation<any>();
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  // Whether verification is switched on AT ALL. GET /verification/status
  // stays reachable regardless (so a check verified before a toggle-off never
  // disappears), which is exactly what made this easy to miss before: the
  // rows below rendered "Pending" chips with a tappable "Verify now" that
  // POSTed to an unmounted route and 404'd. Checked here, once, rather than
  // per-row.
  const health = useQuery({
    queryKey: ['kyc-health', employee?.id],
    queryFn: getHealthDeps,
    enabled: worksAtSite,
    retry: false,
  });
  const verificationEnabled = health.data?.dependencies.verification === 'enabled';

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['profile-kyc-status', employee?.id],
    queryFn: getKycStatus,
    enabled: worksAtSite,
    retry: false,
  });

  // Bottom-tab screens stay mounted, so without this the card would only ever
  // reflect what it saw once per app session. Refetch whenever Profile regains
  // focus, to catch KYC finished via the gate flow (or by HR) while this sat
  // in the background.
  useFocusEffect(
    React.useCallback(() => {
      if (worksAtSite) {
        refetch();
        health.refetch();
      }
      // health.refetch is stable across renders (react-query), and including
      // it would refire this effect every time `health` itself is a new
      // object -- the same reason `refetch` alone is listed below, not `data`.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [worksAtSite, refetch])
  );

  if (!worksAtSite) return null;

  const kyc = data?.kyc ?? null;
  const combinedPanAadhaar = data?.capabilities.combinedPanAadhaar ?? false;
  const bankAvailable = data?.capabilities.bank ?? true;

  // Nothing is actionable while verification is off -- readable, not tappable.
  const action = (target: string) => (verificationEnabled ? () => navigation.navigate(target) : undefined);

  return (
    <Card>
      <Text style={styles.cardTitle}>{t('kyc.title')}</Text>
      {isLoading && !kyc ? (
        <Text style={styles.kycMuted}>{t('common.loading')}</Text>
      ) : isError ? (
        <Text style={styles.kycMuted}>{t('kyc.statusFailed')}</Text>
      ) : kyc ? (
        <>
          {/* Every check that is not yet verified offers a way to finish it,
              UNLESS verification is currently switched off entirely -- a
              status nobody can act on either way is just a reminder that
              something is wrong, or that it isn't available right now. For
              two of these three, the KYC gate that used to be the only route
              in is gone by the time anyone reaches Profile. */}
          <KycRow
            icon="card-outline"
            label={t('kyc.panShort')}
            status={kyc.pan.status}
            detail={kyc.pan.masked}
            onPress={kyc.pan.status === 'verified' ? undefined : action('PanVerify')}
          />

          <KycRow
            icon="finger-print-outline"
            label={t('kyc.aadhaarShort')}
            status={kyc.aadhaar.status}
            // Under the combined provider there is no separate Aadhaar screen
            // to route to -- PanVerify verifies both from one submission.
            onPress={kyc.aadhaar.status === 'verified' ? undefined : action(combinedPanAadhaar ? 'PanVerify' : 'AadhaarOtpRequest')}
          />
          {/* A row of its own, at the same level as the checks around it.
              It was previously indented underneath PAN, which stacked a second
              line of chips and actions inside one row and made the card look
              cramped and nested for what is really just a fourth status.

              Placed after Aadhaar rather than after PAN because it is a fact
              about BOTH of them, so it reads as following from the pair. */}
          <LinkRow
            linked={kyc.pan.aadhaarLinked ?? null}
            last={!bankAvailable}
            onCheck={kyc.pan.aadhaarLinked === true ? undefined : action('PanVerify')}
          />
          {/* Hidden rather than shown-and-disabled: under SurePass this is not
              "temporarily off", it is a check this provider does not offer at
              all, and a permanently-pending row would just be confusing. */}
          {bankAvailable ? (
            <KycRow
              icon="wallet-outline"
              label={t('bank.title')}
              status={kyc.bank.status}
              detail={kyc.bank.masked}
              onPress={kyc.bank.status === 'verified' ? undefined : action('BankVerify')}
            />
          ) : null}

          {/* Self-hosted, so not gated on verificationEnabled -- there is no
              vendor toggle to disable, unlike the three rows above it. */}
          <KycRow
            icon="scan-outline"
            label={t('kyc.faceShort')}
            status={kyc.face.status === 'registered' ? 'verified' : kyc.face.status}
            last
            onPress={kyc.face.status === 'registered' ? undefined : () => navigation.navigate('FaceRegister')}
          />
        </>
      ) : (
        <Text style={styles.kycMuted}>{t('kyc.none')}</Text>
      )}
    </Card>
  );
}

function KycRow({
  icon,
  label,
  status,
  detail,
  last,
  noDivider,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  status: KycCheckStatus;
  detail?: string | null;
  last?: boolean;
  /** Suppress the rule when the row below is a continuation of this one. */
  noDivider?: boolean;
  onPress?: () => void;
}) {
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const tone = kycStatusTone(status, colors);
  const body = (
    <>
      <Ionicons name={icon} size={15} color={colors.slate400} style={styles.rowIcon} />
      <Text style={styles.rowLabel}>{label}</Text>
      {detail ? <Text style={styles.kycDetail}>{detail}</Text> : null}
      <View style={[styles.kycChip, { backgroundColor: tone.bg }]}>
        <Text style={[styles.kycChipText, { color: tone.fg }]}>{t(KYC_STATUS_KEY[status])}</Text>
      </View>
      {/* An actionable row says what to do as well as what is wrong. The chip
          stays -- "Failed" and "Pending" mean different things and both are
          worth keeping -- and this is what to do about either. Without it,
          people tap a Pending badge hoping something happens. */}
      {onPress ? (
        <View style={styles.kycAction}>
          <Text style={styles.kycActionText}>{t('kyc.verifyNow')}</Text>
          <Ionicons name="chevron-forward" size={13} color={colors.brand[700]} />
        </View>
      ) : null}
    </>
  );

  if (!onPress) return <View style={[styles.row, (last || noDivider) && styles.rowLast]}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, (last || noDivider) && styles.rowLast, pressed && styles.rowPressed]}
      accessibilityRole="button"
    >
      {body}
    </Pressable>
  );
}

/**
 * The PAN-Aadhaar linkage line.
 *
 * A row of its own, drawn exactly like the checks around it -- same icon
 * size, same label weight, same chip, same action. It used to sit indented
 * under PAN, which stacked a second line of chips and actions inside one row
 * and read as cramped and nested for what is really just a fourth status.
 *
 * The three states stay genuinely three. NOT CHECKED is grey and is not a
 * failure -- it means nobody has asked yet -- while "not linked" is amber and
 * is a real finding. Collapsing them would either invent a problem or hide
 * one, and the provider's enum is undocumented past yes and no.
 */
function LinkRow({ linked, last, onCheck }: { linked: boolean | null; last?: boolean; onCheck?: () => void }) {
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  const state =
    linked === true
      ? { icon: 'link' as const, tint: colors.successText, label: t('kyc.linked'), bg: colors.successBg }
      : linked === false
        ? { icon: 'unlink' as const, tint: colors.warningText, label: t('kyc.notLinked'), bg: colors.warningBg }
        : // PENDING, not "Not checked". Every other row in this card says
          // Pending while it is outstanding, and this one said something
          // different in a grey that reads as disabled -- so the one check
          // nobody had run looked like the one check that was unavailable.
          // It is the same state as the others: not done yet, and there is a
          // button right beside it to do it.
          { icon: 'link-outline' as const, tint: colors.warningText, label: t('status.pending'), bg: colors.warningBg };

  const body = (
    <>
      <Ionicons name={state.icon} size={15} color={colors.slate400} style={styles.rowIcon} />
      <Text style={styles.rowLabel}>{t('kyc.panAadhaarLink')}</Text>
      <View style={[styles.kycChip, { backgroundColor: state.bg }]}>
        <Text style={[styles.kycChipText, { color: state.tint }]}>{state.label}</Text>
      </View>
      {onCheck ? (
        <View style={styles.kycAction}>
          <Text style={styles.kycActionText}>{t('kyc.checkNow')}</Text>
          <Ionicons name="chevron-forward" size={13} color={colors.brand[700]} />
        </View>
      ) : null}
    </>
  );

  if (!onCheck) return <View style={[styles.row, last && styles.rowLast]}>{body}</View>;
  return (
    <Pressable
      style={({ pressed }) => [styles.row, last && styles.rowLast, pressed && styles.rowPressed]}
      onPress={onCheck}
      accessibilityRole="button"
      accessibilityLabel={t('kyc.linkRowLabel', { state: state.label })}
    >
      {body}
    </Pressable>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    cardTitle: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: colors.slate500, marginBottom: 4 },
    row: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: colors.slate100,
    },
    rowLast: { borderBottomWidth: 0 },
    rowIcon: { marginRight: 8 },
    rowPressed: { opacity: 0.6 },
    rowLabel: { flex: 1, fontSize: 11, fontWeight: '600', color: colors.slate500 },
    kycAction: { flexDirection: 'row', alignItems: 'center', gap: 1, marginLeft: 8 },
    kycActionText: { fontSize: 11, fontWeight: '800', color: colors.brand[700] },
    kycMuted: { fontSize: 11, color: colors.slate400, fontWeight: '600', paddingVertical: 8 },
    kycDetail: { fontSize: 11, color: colors.slate400, fontWeight: '600', marginRight: 8 },
    kycChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill },
    kycChipText: { fontSize: 11, fontWeight: '800' },
  });
}
