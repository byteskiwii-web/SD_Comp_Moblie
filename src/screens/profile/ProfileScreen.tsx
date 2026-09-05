import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Avatar, Badge, Button, Card, InfoRow } from '../../components/ui';
import { NotificationBell } from '../../components/NotificationBell';
import { NotificationPanel } from '../../components/NotificationPanel';
import { colors, fonts } from '../../theme/tokens';
import { useAuthStore } from '../../stores/authStore';
import { getMe } from '../../api/auth.api';
import { getKycStatus, KYC_STATUS_LABEL, KycCheckStatus, kycStatusTone } from '../../api/verification.api';
import { triggerBackgroundIntegrityCheckForTesting } from '../../utils/backgroundIntegrityTask';

const ROLE_LABEL: Record<string, string> = {
  'field-employee': 'Field Employee',
  'site-manager': 'Site Manager',
  'hr-manager': 'HR Manager',
  'super-admin': 'Super Admin',
};

function formatShift(start: string | null, end: string | null): string {
  if (!start || !end) return '—';
  const fmt = (t: string) => t.slice(0, 5); // "10:00:00" -> "10:00"
  return `${fmt(start)} – ${fmt(end)}`;
}

function formatJoined(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function KycRow({ label, status }: { label: string; status: KycCheckStatus }) {
  const tone = kycStatusTone(status);
  return (
    <View style={styles.kycRow}>
      <Text style={styles.kycLabel}>{label}</Text>
      <Badge tone={status === 'verified' ? 'success' : status === 'failed' ? 'danger' : 'warning'}>
        {KYC_STATUS_LABEL[status]}
      </Badge>
    </View>
  );
}

export function ProfileScreen() {
  const employee = useAuthStore((s) => s.employee);
  const store = useAuthStore((s) => s.store);
  const signOut = useAuthStore((s) => s.signOut);
  const [notifOpen, setNotifOpen] = useState(false);

  const isFieldEmployee = employee?.role === 'field-employee';

  // Shift/joining date aren't part of authStore's cached Employee (login
  // never returns them -- see zip-hrms-backend's auth.service.js#issueSession)
  // -- fetched on demand rather than folded into login, since they change
  // essentially never and don't need to be carried through every session.
  const meExtrasQuery = useQuery({
    queryKey: ['auth-me-extras', employee?.id],
    queryFn: getMe,
    enabled: !!employee,
    staleTime: 5 * 60 * 1000,
  });

  // Reads GET /verification/status directly -- NOT fetchKycGateStatus (the
  // mandatory-gate check useKycGate.ts uses), because those answer different
  // questions. The gate asks "should Attendance be blocked right now",
  // which correctly stays fail-open while verification is toggled off. This
  // screen asks "does this employee have KYC history worth showing", which
  // doesn't stop being true just because new verifications are currently
  // disabled -- an employee verified last month is still verified.
  // GET /verification/status is mounted unconditionally on the backend for
  // exactly this reason (see verification.status.routes.js).
  const kycQuery = useQuery({
    queryKey: ['profile-kyc-status', employee?.id],
    queryFn: getKycStatus,
    enabled: isFieldEmployee,
    retry: false,
  });

  // Bottom-tab screens stay mounted, so without this the KYC section would
  // only ever reflect whatever it saw once per app session -- refetch every
  // time Profile regains focus, to catch KYC completed via the gate flow
  // (or by HR) while this screen sat idle in the background.
  useFocusEffect(
    useCallback(() => {
      if (isFieldEmployee) kycQuery.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isFieldEmployee])
  );

  const kyc = kycQuery.data?.kyc ?? null;
  const showKycCard = isFieldEmployee;

  const aadhaarValue = !isFieldEmployee
    ? '—'
    : kycQuery.isLoading
      ? '…'
      : kyc
        ? KYC_STATUS_LABEL[kyc.aadhaar.status]
        : '—';
  const panValue = !isFieldEmployee
    ? '—'
    : kycQuery.isLoading
      ? '…'
      : kyc
        ? (kyc.pan.masked ?? KYC_STATUS_LABEL[kyc.pan.status])
        : '—';
  const bankValue = !isFieldEmployee
    ? '—'
    : kycQuery.isLoading
      ? '…'
      : kyc
        ? kyc.bank.status === 'verified' && kyc.bank.masked
          ? `Verified · ${kyc.bank.masked}`
          : KYC_STATUS_LABEL[kyc.bank.status]
        : '—';

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <NotificationBell onPress={() => setNotifOpen(true)} />
      </View>
      <NotificationPanel visible={notifOpen} onClose={() => setNotifOpen(false)} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.heroCard}>
          <Avatar name={`${employee?.first_name ?? ''} ${employee?.last_name ?? ''}`} employeeId={employee?.id} size={56} />
          <View style={styles.heroText}>
            <Text style={styles.name}>
              {employee?.first_name} {employee?.last_name}
            </Text>
            <Text style={styles.subline}>
              {employee?.id} · {employee?.role ? (ROLE_LABEL[employee.role] ?? employee.role) : '—'}
            </Text>
            <View style={styles.badgeRow}>
              <Badge tone="success">Active</Badge>
              <Badge tone="brand">{store?.name ?? '—'}</Badge>
            </View>
          </View>
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Contact & assignment</Text>
          <InfoRow icon="phone" label="Phone" value={employee?.phone ?? '—'} />
          <InfoRow icon="mail" label="Email" value={employee?.email ?? '—'} />
          <InfoRow icon="building" label="Assigned site" value={store?.name ?? '—'} />
          <InfoRow
            icon="clock"
            label="Shift"
            value={
              meExtrasQuery.isLoading ? '…' : formatShift(meExtrasQuery.data?.shiftStart ?? null, meExtrasQuery.data?.shiftEnd ?? null)
            }
          />
          <InfoRow icon="shield" label="Aadhaar" value={aadhaarValue} />
          <InfoRow icon="file" label="PAN" value={panValue} />
          <InfoRow icon="wallet" label="Bank" value={bankValue} />
          <InfoRow
            icon="calendar"
            label="Joined"
            value={meExtrasQuery.isLoading ? '…' : formatJoined(meExtrasQuery.data?.dateOfJoining ?? null)}
            last
          />
        </Card>

        {showKycCard ? (
          <Card>
            <Text style={styles.cardTitle}>KYC verification</Text>
            {kycQuery.isError ? (
              <View style={styles.kycError}>
                <Text style={styles.kycErrorText}>Couldn't load verification status</Text>
                <Pressable onPress={() => kycQuery.refetch()}>
                  <Text style={styles.kycRetryText}>Retry</Text>
                </Pressable>
              </View>
            ) : kycQuery.isLoading || !kyc ? (
              <View style={styles.kycLoading}>
                <ActivityIndicator size="small" color={colors.brand[700]} />
              </View>
            ) : (
              <>
                <KycRow label="PAN Verification" status={kyc.pan.status} />
                <KycRow label="Aadhaar Verification" status={kyc.aadhaar.status} />
                <KycRow label="Bank Verification" status={kyc.bank.status} />
              </>
            )}
          </Card>
        ) : null}

        {/*
          Dev-only diagnostic: forces the background integrity task to run
          right now instead of waiting for Android's own (15-min-minimum,
          not-guaranteed) schedule. Answers one question fast: does the task
          DO the right thing once invoked, or is the OS just never invoking
          it? __DEV__ is false in a release build, so this never ships.
        */}
        {__DEV__ && (
          <Card>
            <Text style={styles.cardTitle}>Dev tools</Text>
            <Button
              variant="outline"
              title="Trigger background check now"
              onPress={async () => {
                const ran = await triggerBackgroundIntegrityCheckForTesting();
                Alert.alert(
                  ran ? 'Triggered' : 'Not triggered',
                  ran
                    ? 'The background task ran. Check the Metro log for [backgroundIntegrityTask] lines, and watch for a notification if something was flagged.'
                    : 'expo-background-task reported it did not run this (only works in a debug/dev-client build).'
                );
              }}
            />
          </Card>
        )}

        <Button variant="danger" title="Sign out" onPress={() => signOut()} />

        <Text style={styles.footer}>S.D. Computronix HRMS · v{Constants.expoConfig?.version ?? '1.0'}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgLight },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: colors.textLight, letterSpacing: -0.3 },
  content: { padding: 20, paddingTop: 12, gap: 16 },

  heroCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroText: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: '800', color: colors.textLight },
  subline: { fontSize: 11, color: colors.slate500, marginTop: 2, fontFamily: fonts.mono },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },

  cardTitle: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: colors.slate500,
    marginBottom: 4,
  },

  kycRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  kycLabel: { fontSize: 13, fontWeight: '600', color: colors.textLight },
  kycLoading: { paddingVertical: 16, alignItems: 'center' },
  kycError: { paddingVertical: 10, gap: 8 },
  kycErrorText: { fontSize: 12, color: colors.slate500 },
  kycRetryText: { fontSize: 12, fontWeight: '700', color: colors.brand[700] },

  footer: { fontSize: 10, color: colors.slate400, textAlign: 'center', paddingVertical: 4 },
});
