import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { getPolicies } from '../../api/policies.api';
import { getKycStatus, KYC_STATUS_LABEL, KycCheckStatus, kycStatusTone } from '../../api/verification.api';
import { useNavigation } from '@react-navigation/native';
import { formatDate, newestFirst } from '../../utils/datetime';
import { TourTarget } from '../../components/tour/TourTarget';
import { useTourStore } from '../../stores/tourStore';
import { KitCard } from './KitCard';
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
  const profile = useAuthStore((s) => s.profile);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const [refreshing, setRefreshing] = React.useState(false);
  const startTour = useTourStore((s) => s.start);

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
        <Text style={styles.headerTitle}>Profile</Text>
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
                {employee?.role ? (ROLE_LABEL[employee.role] ?? employee.role) : '—'}
              </Text>
            </View>
          </View>
        </TourTarget>

        <Card>
          <Text style={styles.cardTitle}>Contact & assignment</Text>
          <Row icon="call-outline" label="Phone" value={employee?.phone ?? '—'} />
          <Row icon="mail-outline" label="Email" value={employee?.email ?? '—'} />
          <Row icon="business-outline" label="Assigned site" value={store?.name ?? '—'} />
          <Row icon="pricetag-outline" label="Site code" value={store?.store_code ?? employee?.store_code ?? '—'} />
          <Row
            icon="navigate-outline"
            label="Geo-fence"
            value={store?.geofence_radius_m ? store.geofence_radius_m + ' m radius' : '—'}
          />
          <Row
            icon="time-outline"
            label="Shift"
            value={profile?.shiftStart && profile?.shiftEnd ? profile.shiftStart + ' – ' + profile.shiftEnd : '—'}
          />
          <Row
            icon="calendar-outline"
            label="Joined"
            value={profile?.dateOfJoining ? formatDate(profile.dateOfJoining) : '—'}
            last
          />
        </Card>

        <KycCard />

        <KitCard />

        <PolicyLibrary />

        <Button title="Replay app tour" variant="outline" onPress={startTour} />
                <Button title="Sign out" variant="outline" onPress={() => signOut()} />
        
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
 * Field employees only -- KYC does not apply to office roles, and the backend
 * scopes the subject to the caller regardless.
 */
function KycCard() {
  const employee = useAuthStore((s) => s.employee);
  const isFieldEmployee = employee?.role === 'field-employee';
  // Above the early return below: a hook after a conditional `return null`
  // changes the hook count between renders the moment the role resolves.
  const navigation = useNavigation<any>();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['profile-kyc-status', employee?.id],
    queryFn: getKycStatus,
    enabled: isFieldEmployee,
    retry: false,
  });

  // Bottom-tab screens stay mounted, so without this the card would only ever
  // reflect what it saw once per app session. Refetch whenever Profile regains
  // focus, to catch KYC finished via the gate flow (or by HR) while this sat
  // in the background.
  useFocusEffect(
    React.useCallback(() => {
      if (isFieldEmployee) refetch();
    }, [isFieldEmployee, refetch])
  );

  if (!isFieldEmployee) return null;

  const kyc = data?.kyc ?? null;

  return (
    <Card>
      <Text style={styles.cardTitle}>Identity verification</Text>
      {isLoading && !kyc ? (
        <Text style={styles.kycMuted}>Loading…</Text>
      ) : isError ? (
        <Text style={styles.kycMuted}>Could not load verification status.</Text>
      ) : kyc ? (
        <>
          {/* Every check that is not yet verified offers a way to finish it.
              A status nobody can act on is just a reminder that something is
              wrong -- and for two of these three, the KYC gate that used to be
              the only route in is gone by the time anyone reaches Profile. */}
          <KycRow
            icon="card-outline"
            label="PAN"
            status={kyc.pan.status}
            detail={kyc.pan.masked}
            onPress={kyc.pan.status === 'verified' ? undefined : () => navigation.navigate('PanVerify')}
          />
          <KycRow
            icon="finger-print-outline"
            label="Aadhaar"
            status={kyc.aadhaar.status}
            onPress={
              kyc.aadhaar.status === 'verified'
                ? undefined
                : () => navigation.navigate('AadhaarOtpRequest')
            }
          />
          <KycRow
            icon="wallet-outline"
            label="Bank account"
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
        <Text style={styles.kycMuted}>No verification on record yet.</Text>
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
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  status: KycCheckStatus;
  detail?: string | null;
  last?: boolean;
  onPress?: () => void;
}) {
  const tone = kycStatusTone(status);
  const body = (
    <>
      <Ionicons name={icon} size={15} color={colors.slate400} style={styles.rowIcon} />
      <Text style={styles.rowLabel}>{label}</Text>
      {detail ? <Text style={styles.kycDetail}>{detail}</Text> : null}
      <View style={[styles.kycChip, { backgroundColor: tone.bg }]}>
        <Text style={[styles.kycChipText, { color: tone.fg }]}>{KYC_STATUS_LABEL[status]}</Text>
      </View>
      {/* An actionable row says what to do as well as what is wrong. The chip
          stays -- "Failed" and "Pending" mean different things and both are
          worth keeping -- and this is what to do about either. Without it,
          people tap a Pending badge hoping something happens. */}
      {onPress ? (
        <View style={styles.kycAction}>
          <Text style={styles.kycActionText}>Verify now</Text>
          <Ionicons name="chevron-forward" size={13} color={colors.brand[700]} />
        </View>
      ) : null}
    </>
  );

  if (!onPress) return <View style={[styles.row, last && styles.rowLast]}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, last && styles.rowLast, pressed && styles.rowPressed]}
      accessibilityRole="button"
    >
      {body}
    </Pressable>
  );
}

/**
 * The policy library, read-only here. Anything still needing a signature is
 * surfaced on the home screen instead, where it can be acted on -- this is the
 * reference copy, so it says what exists and what has already been signed.
 */
function PolicyLibrary() {
  const { data } = useQuery({ queryKey: ['policies-library'], queryFn: () => getPolicies(50) });
  const items = newestFirst(data?.items ?? [], 'publishedAt', 'updatedAt', 'createdAt');
  if (items.length === 0) return null;

  const signed = items.filter((p) => p.acknowledgedByMe).length;
  return (
    <Card>
      <Text style={styles.cardTitle}>Company policies</Text>
      <Text style={styles.policySummary}>
        {items.length} assigned to you · {signed} acknowledged
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

const styles = StyleSheet.create({
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
