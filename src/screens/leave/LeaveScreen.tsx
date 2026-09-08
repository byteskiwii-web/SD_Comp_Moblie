import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, radii } from '../../theme/tokens';
import { Card } from '../../components/ui';
import { SkeletonList, SkeletonRows } from '../../components/Skeleton';
import { TourTarget } from '../../components/tour/TourTarget';
import { getApiErrorMessage } from '../../api/client';
import { newestFirst } from '../../utils/datetime';
import {
  cancelLeave,
  getLeaveSummary,
  getMyLeave,
  LEAVE_TYPE_LABEL,
  type LeaveRequest,
  type LeaveStatus,
} from '../../api/leave.api';
import { ApplyLeaveSheet } from './ApplyLeaveSheet';

/**
 * Leave.
 *
 * Two things, in the order they are wanted: how much has been taken, and what
 * has been asked for. Applying is a sheet rather than a screen — it is a short
 * form, and coming back to a list that already shows the new pending row is
 * the confirmation, so there is nothing to navigate to afterwards.
 *
 * The top card says TAKEN, not "balance". The server has no entitlement to
 * subtract from, so a "days left" figure would be invented, and invented is
 * the worst thing a number on this screen could be — somebody reads it to
 * decide whether they can afford to be off.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const shortDate = (key: string) => {
  const d = new Date(`${String(key).slice(0, 10)}T00:00:00`);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

/** "12 Sep" for one day, "12 – 15 Sep" for a range. */
function rangeLabel(r: LeaveRequest) {
  const from = String(r.startDate).slice(0, 10);
  const to = String(r.endDate).slice(0, 10);
  if (from === to) return `${shortDate(from)}${r.halfDay ? ' · half day' : ''}`;
  return `${shortDate(from)} – ${shortDate(to)}`;
}

const STATUS_TONE: Record<LeaveStatus, { bg: string; fg: string; label: string }> = {
  pending: { bg: colors.warningBg, fg: '#B45309', label: 'Pending' },
  approved: { bg: colors.successBg, fg: '#047857', label: 'Approved' },
  rejected: { bg: colors.dangerBg, fg: '#BE123C', label: 'Rejected' },
  cancelled: { bg: colors.slate100, fg: colors.slate500, label: 'Withdrawn' },
};

export function LeaveScreen() {
  const queryClient = useQueryClient();
  const [applyOpen, setApplyOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listQuery = useQuery({ queryKey: ['leave'], queryFn: () => getMyLeave() });
  const summaryQuery = useQuery({ queryKey: ['leave-summary'], queryFn: () => getLeaveSummary() });

  const withdraw = useMutation({
    mutationFn: (id: string) => cancelLeave(id),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['leave'] });
      queryClient.invalidateQueries({ queryKey: ['leave-summary'] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  // Newest first, and re-sorted here rather than trusting the order the server
  // happened to send.
  const requests = useMemo(
    () => newestFirst(listQuery.data ?? [], 'startDate', 'createdAt'),
    [listQuery.data]
  );

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Leave</Text>
        <TourTarget id="leave-apply">
          <Pressable
            onPress={() => setApplyOpen(true)}
            style={({ pressed }) => [styles.applyBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Ionicons name="add" size={17} color={colors.white} />
            <Text style={styles.applyBtnText}>Apply</Text>
          </Pressable>
        </TourTarget>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card>
          <Text style={styles.cardTitle}>This year</Text>
          {summaryQuery.isLoading ? (
            <SkeletonRows count={2} />
          ) : (
            <>
              <View style={styles.tiles}>
                <View style={styles.tile}>
                  <Text style={styles.tileValue}>{summaryQuery.data?.takenTotal ?? 0}</Text>
                  <Text style={styles.tileLabel}>Days taken</Text>
                </View>
                <View style={styles.tile}>
                  <Text style={[styles.tileValue, styles.tilePending]}>
                    {summaryQuery.data?.pendingTotal ?? 0}
                  </Text>
                  <Text style={styles.tileLabel}>Awaiting approval</Text>
                </View>
              </View>
              <View style={styles.byType}>
                {(Object.keys(LEAVE_TYPE_LABEL) as (keyof typeof LEAVE_TYPE_LABEL)[]).map((t) => (
                  <View key={t} style={styles.typeChip}>
                    <Text style={styles.typeChipLabel}>{LEAVE_TYPE_LABEL[t]}</Text>
                    <Text style={styles.typeChipValue}>{summaryQuery.data?.taken[t] ?? 0}</Text>
                  </View>
                ))}
              </View>
              {/* Said plainly rather than implied by the absence of a balance. */}
              <Text style={styles.footnote}>
                Days approved so far. Your entitlement isn't held in this app — HR has it.
              </Text>
            </>
          )}
        </Card>

        <Text style={styles.sectionTitle}>My requests</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {listQuery.isLoading ? (
          <SkeletonList count={3} lines={1} />
        ) : listQuery.error ? (
          <Text style={styles.error}>{getApiErrorMessage(listQuery.error)}</Text>
        ) : requests.length === 0 ? (
          <Card>
            <Text style={styles.empty}>You haven't applied for any leave yet.</Text>
          </Card>
        ) : (
          requests.map((r) => {
            const tone = STATUS_TONE[r.status];
            return (
              <Card key={r.id} style={styles.reqCard}>
                <View style={styles.reqHead}>
                  <Text style={styles.reqDates}>{rangeLabel(r)}</Text>
                  <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.badgeText, { color: tone.fg }]}>{tone.label}</Text>
                  </View>
                </View>

                <Text style={styles.reqMeta}>
                  {LEAVE_TYPE_LABEL[r.leaveType]} · {r.totalDays ?? '—'}{' '}
                  {r.totalDays === 1 ? 'day' : 'days'}
                </Text>

                <Text style={styles.reqReason} numberOfLines={2}>
                  {r.reason}
                </Text>

                {r.decisionNote ? <Text style={styles.reqNote}>“{r.decisionNote}”</Text> : null}

                {r.status === 'pending' && (
                  <Pressable
                    onPress={() => withdraw.mutate(r.id)}
                    disabled={withdraw.isPending}
                    style={({ pressed }) => [styles.withdraw, pressed && styles.pressed]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.withdrawText}>Withdraw</Text>
                  </Pressable>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>

      <ApplyLeaveSheet
        visible={applyOpen}
        onClose={() => setApplyOpen(false)}
        onApplied={() => {
          setApplyOpen(false);
          queryClient.invalidateQueries({ queryKey: ['leave'] });
          queryClient.invalidateQueries({ queryKey: ['leave-summary'] });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgLight },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4,
  },
  headerTitle: { fontSize: 21, fontWeight: '800', color: colors.textLight, letterSpacing: -0.3 },
  applyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.brand[700], paddingHorizontal: 13, paddingVertical: 8,
    borderRadius: radii.pill,
  },
  applyBtnText: { color: colors.white, fontSize: 11.5, fontWeight: '800' },
  pressed: { opacity: 0.75 },

  content: { padding: 20, paddingTop: 12, gap: 12, paddingBottom: 28 },

  cardTitle: {
    fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4,
    color: colors.slate500, marginBottom: 12,
  },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1, borderWidth: 1, borderColor: colors.slate200, borderRadius: radii.md,
    paddingVertical: 12, paddingHorizontal: 12,
  },
  tileValue: { fontSize: 19, fontWeight: '800', color: colors.textLight, letterSpacing: -0.5 },
  tilePending: { color: '#B45309' },
  tileLabel: { fontSize: 11, color: colors.slate500, fontWeight: '700', marginTop: 3 },

  byType: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.slate50, borderRadius: radii.sm,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  typeChipLabel: { fontSize: 10.5, color: colors.slate500, fontWeight: '700' },
  typeChipValue: { fontSize: 11.5, color: colors.textLight, fontWeight: '800' },

  footnote: { fontSize: 11, color: colors.slate400, marginTop: 10, lineHeight: 15 },

  sectionTitle: {
    fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4,
    color: colors.slate500, marginTop: 6, marginLeft: 2,
  },
  empty: { fontSize: 11.5, color: colors.slate400, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 11.5, fontWeight: '600' },

  reqCard: { padding: 14, gap: 7 },
  reqHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  reqDates: { flex: 1, fontSize: 13, fontWeight: '800', color: colors.textLight, letterSpacing: -0.2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.sm },
  badgeText: { fontSize: 10, fontWeight: '800' },
  reqMeta: { fontSize: 10.5, color: colors.slate500, fontWeight: '700' },
  reqReason: { fontSize: 11.5, color: colors.slate600, lineHeight: 17 },
  reqNote: { fontSize: 11, color: colors.slate500, fontStyle: 'italic' },
  withdraw: { alignSelf: 'flex-start', paddingVertical: 4 },
  withdrawText: { fontSize: 11.5, fontWeight: '800', color: colors.danger },
});
