import React from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { getPolicies } from '../../api/policies.api';
import { getKycStatus, KYC_STATUS_KEY, KycCheckStatus, kycStatusTone } from '../../api/verification.api';
import { useNavigation } from '@react-navigation/native';
import { formatDate, newestFirst } from '../../utils/datetime';
import { TourTarget } from '../../components/tour/TourTarget';
import { useTourStore } from '../../stores/tourStore';
import { useShiftStore } from '../../stores/shiftStore';
import { KitCard } from './KitCard';
import { DocumentsCard } from './DocumentsCard';
import { DeptManagerCard } from './DeptManagerCard';
import { ReportingCard } from './ReportingCard';
import { PersonalCard } from './PersonalCard';
import { PreferencesCard } from './PreferencesCard';
import { Button, Card } from '../../components/ui';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import { useT, type TKey } from '../../i18n';

const ROLE_LABEL: Record<string, string> = {
  'field-employee': 'role.field-employee',
  'team-lead': 'role.team-lead',
  'site-manager': 'role.site-manager',
  'cluster-manager': 'role.cluster-manager',
  'hr-manager': 'role.hr-manager',
  'super-admin': 'role.super-admin',
};

export function ProfileScreen() {
  const employee = useAuthStore((s) => s.employee);
  const store = useAuthStore((s) => s.store);
  const signOut = useAuthStore((s) => s.signOut);
  const isClockedIn = useShiftStore((s) => s.isClockedIn);
  const profile = useAuthStore((s) => s.profile);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const [refreshing, setRefreshing] = React.useState(false);

  const startTour = useTourStore((s) => s.start);
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  /**
   * Signing out mid-shift throws the shift away.
   *
   * Clock-in is held on the device until the matching clock-out is filed, so
   * signing out first leaves a shift that was started and never ended — and
   * the employee finds out on payday rather than here. The warning is
   * deliberately only shown while a shift is open: a confirmation on every
   * sign-out is one people learn to dismiss without reading, which is exactly
   * the habit that makes this one useless.
   *
   * Destructive on the sign-out option, cancel-styled on Cancel, so the safe
   * choice is the one the thumb lands on by default.
   */
  const confirmSignOut = React.useCallback(() => {
    if (!isClockedIn) {
      void signOut();
      return;
    }
    Alert.alert(
      t('profile.signOutShiftTitle'),
      t('profile.signOutShiftBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.signOut'), style: 'destructive', onPress: () => { void signOut(); } },
      ],
      { cancelable: true }
    );
  }, [isClockedIn, signOut, t]);

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
        <Text style={styles.headerTitle}>{t('profile.title')}</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand[700]} />}
      >
        <TourTarget id="profile-top" style={styles.heroCard}>
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
                {employee?.role
                  ? ROLE_LABEL[employee.role]
                    ? t(ROLE_LABEL[employee.role] as TKey)
                    : employee.role
                  : '—'}
              </Text>
            </View>
          </View>
        </TourTarget>

        <Card>
          <Text style={styles.cardTitle}>{t('profile.contact')}</Text>
          <Row icon="call-outline" label={t('common.phone')} value={employee?.phone ?? '—'} />
          <Row icon="mail-outline" label={t('common.email')} value={employee?.email ?? '—'} />
          <Row icon="business-outline" label={t('profile.assignedSite')} value={store?.name ?? '—'} />
          <Row
            icon="pricetag-outline"
            label={t('profile.siteCode')}
            value={store?.store_code ?? employee?.store_code ?? '—'}
          />
          <Row
            icon="navigate-outline"
            label={t('profile.geofence')}
            value={
              store?.geofence_radius_m
                ? t('profile.geofenceRadius', { metres: store.geofence_radius_m })
                : '—'
            }
          />
          {/* The rostered shift, named. '10:00 - 19:00' alone does not say
              which shift somebody is on. Break allowance used to live here
              too, but it's an attendance fact, not an identity one -- moved
              to the Attendance screen, next to where a break is actually
              taken. */}
          <Row
            icon="albums-outline"
            label={t('profile.shift')}
            value={profile?.shift?.name ?? (profile?.shiftStart && profile?.shiftEnd ? profile.shiftStart + ' – ' + profile.shiftEnd : '—')}
          />
          {/* The manager moved to its own card -- three read-only rows could
              show it and nothing could set it. */}
          <Row
            icon="calendar-outline"
            label={t('profile.joined')}
            value={profile?.dateOfJoining ? formatDate(profile.dateOfJoining) : '—'}
            last
          />
        </Card>

        {/* Moved up from the very bottom of the screen -- six cards below it
            (Preferences through Kit) meant almost nobody scrolled far enough
            to see it was there at all. */}
        <PolicyLibrary />

        <PreferencesCard />

        <PersonalCard />

        <DeptManagerCard />

        {/* Below the department manager, because they answer adjacent questions
            and reading them together is what makes the difference between the
            two obvious. */}
        <ReportingCard />

        <KycCard />

        <DocumentsCard />

        <KitCard />

        <Button title={t('home.replayTour')} variant="outline" onPress={startTour} />
        <Button title={t('common.signOut')} variant="danger" onPress={confirmSignOut} />
        
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
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
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
function KycCard() {
  const employee = useAuthStore((s) => s.employee);
  const worksAtSite = Boolean(employee?.store_code);
  // Above the early return below: a hook after a conditional `return null`
  // changes the hook count between renders the moment the role resolves.
  const navigation = useNavigation<any>();
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

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
      if (worksAtSite) refetch();
    }, [worksAtSite, refetch])
  );

  if (!worksAtSite) return null;

  const kyc = data?.kyc ?? null;

  return (
    <Card>
      <Text style={styles.cardTitle}>{t('kyc.title')}</Text>
      {isLoading && !kyc ? (
        <Text style={styles.kycMuted}>{t('common.loading')}</Text>
      ) : isError ? (
        <Text style={styles.kycMuted}>{t('kyc.statusFailed')}</Text>
      ) : kyc ? (
        <>
          {/* Every check that is not yet verified offers a way to finish it.
              A status nobody can act on is just a reminder that something is
              wrong -- and for two of these three, the KYC gate that used to be
              the only route in is gone by the time anyone reaches Profile. */}
          <KycRow
            icon="card-outline"
            label={t('kyc.panShort')}
            status={kyc.pan.status}
            detail={kyc.pan.masked}
            onPress={kyc.pan.status === 'verified' ? undefined : () => navigation.navigate('PanVerify')}
          />

          <KycRow
            icon="finger-print-outline"
            label={t('kyc.aadhaarShort')}
            status={kyc.aadhaar.status}
            onPress={
              kyc.aadhaar.status === 'verified'
                ? undefined
                : () => navigation.navigate('AadhaarOtpRequest')
            }
          />
          {/* A row of its own, at the same level as the checks around it.
              It was previously indented underneath PAN, which stacked a second
              line of chips and actions inside one row and made the card look
              cramped and nested for what is really just a fourth status.

              Placed after Aadhaar rather than after PAN because it is a fact
              about BOTH of them, so it reads as following from the pair. */}
          <LinkRow
            linked={kyc.pan.aadhaarLinked ?? null}
            onCheck={
              kyc.pan.aadhaarLinked === true ? undefined : () => navigation.navigate('PanVerify')
            }
          />
          <KycRow
            icon="wallet-outline"
            label={t('bank.title')}
            status={kyc.bank.status}
            detail={kyc.bank.masked}
            last
            onPress={
              kyc.bank.status === 'verified'
                ? undefined
                : () => navigation.navigate('BankVerify')
            }
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
function LinkRow({ linked, onCheck }: { linked: boolean | null; onCheck?: () => void }) {
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  const state =
    linked === true
      ? { icon: 'link' as const, tint: colors.successText, label: t('kyc.linked'), bg: colors.successBg }
      : linked === false
        ? { icon: 'unlink' as const, tint: colors.warningText, label: t('kyc.notLinked'), bg: colors.warningBg }
        : { icon: 'link-outline' as const, tint: colors.slate400, label: t('kyc.notChecked'), bg: colors.slate100 };

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

  if (!onCheck) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onCheck}
      accessibilityRole="button"
      accessibilityLabel={t('kyc.linkRowLabel', { state: state.label })}
    >
      {body}
    </Pressable>
  );
}

function PolicyLibrary() {
  const { data } = useQuery({ queryKey: ['policies-library'], queryFn: () => getPolicies(50) });
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const items = newestFirst(data?.items ?? [], 'publishedAt', 'updatedAt', 'createdAt');
  if (items.length === 0) return null;

  const signed = items.filter((p) => p.acknowledgedByMe).length;
  return (
    <Card>
      <Text style={styles.cardTitle}>{t('profile.policies')}</Text>
      <Text style={styles.policySummary}>
        {t('policy.summary', { total: items.length, signed })}
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

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.bgLight },
    header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
    headerTitle: { fontSize: 21, fontWeight: '800', color: colors.textLight, letterSpacing: -0.3 },
    content: { padding: 20, paddingTop: 12, gap: 16 },

    heroCard: { alignItems: 'center', paddingVertical: 8 },
    avatar: {
      width: 76, height: 76, borderRadius: 38, backgroundColor: colors.brand[700],
      alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    },
    avatarInitial: { color: colors.white, fontSize: 26, fontWeight: '800' },
    name: { fontSize: 16.5, fontWeight: '800', color: colors.textLight },
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
    rowChevron: { marginLeft: 6 },
    kycAction: { flexDirection: 'row', alignItems: 'center', gap: 1, marginLeft: 8 },
    kycActionText: { fontSize: 11, fontWeight: '800', color: colors.brand[700] },
    rowPressed: { opacity: 0.6 },
    rowLabel: { flex: 1, fontSize: 11, fontWeight: '600', color: colors.slate500 },
    policySummary: { fontSize: 11, color: colors.slate400, fontWeight: '600', marginBottom: 6 },
    rowValue: { fontSize: 11.5, fontWeight: '700', color: colors.textLight },

    kycMuted: { fontSize: 11, color: colors.slate400, fontWeight: '600', paddingVertical: 8 },
    kycDetail: { fontSize: 11, color: colors.slate400, fontWeight: '600', marginRight: 8 },
    kycChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill },
    kycChipText: { fontSize: 11, fontWeight: '800' },
  });
}
