import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { Card } from '../../components/ui';
import { SkeletonList, SkeletonRows } from '../../components/Skeleton';
import { TourTarget } from '../../components/tour/TourTarget';
import { getApiErrorMessage } from '../../api/client';
import { newestFirst } from '../../utils/datetime';
import {
  cancelLeave,
  markWorkedDuringLeave,
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

function statusTone(colors: ColorScheme): Record<LeaveStatus, { bg: string; fg: string; label: string }> {
  return {
    pending: { bg: colors.warningBg, fg: colors.warningText, label: 'Pending' },
    approved: { bg: colors.successBg, fg: colors.successText, label: 'Approved' },
    rejected: { bg: colors.dangerBg, fg: colors.dangerText, label: 'Rejected' },
    cancelled: { bg: colors.slate100, fg: colors.slate500, label: 'Withdrawn' },
  };
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_NAMES[(m || 1) - 1]} ${y}`;
};

/** Steps a YYYY-MM key, rolling the year over rather than producing month 13. */
/** Every date a request covers, so the claim can only name one of them. */
function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(String(from).slice(0, 10) + 'T00:00:00Z');
  const end = new Date(String(to).slice(0, 10) + 'T00:00:00Z');
  // Bounded: the server caps a request at 30 days, so this cannot run away.
  for (let d = start; d <= end && out.length < 40; d = new Date(d.getTime() + 86400000)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function shiftMonth(key: string, by: number) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function LeaveScreen() {
  const queryClient = useQueryClient();
  const [applyOpen, setApplyOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which request is having a worked day claimed against it.
  const [claiming, setClaiming] = useState<LeaveRequest | null>(null);
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const STATUS_TONE = useMemo(() => statusTone(colors), [colors]);

  const listQuery = useQuery({ queryKey: ['leave'], queryFn: () => getMyLeave() });
  // Which month the card is showing. Leave is discussed by the month, so the
  // month is the unit -- and being able to step back through it is the history
  // the figures belong to.
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const summaryQuery = useQuery({
    queryKey: ['leave-summary', month],
    queryFn: () => getLeaveSummary(month),
  });

  /**
   * "I was on unpaid leave but I came in."
   *
   * Only offered on APPROVED UNPAID leave that has not already been claimed,
   * because those are the only requests the server will accept it for --
   * showing the action anywhere else would be an offer that always fails.
   */
  const claimWorked = useMutation({
    mutationFn: (input: { id: string; day: string }) => markWorkedDuringLeave(input.id, input.day),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['leave'] });
      queryClient.invalidateQueries({ queryKey: ['leave-summary'] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

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
          {/* The month leads, and can be stepped through. A bare figure with no
              month attached is the thing people misread. */}
          <View style={styles.monthBar}>
            <Pressable onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={10} accessibilityLabel="Previous month">
              <Ionicons name="chevron-back" size={18} color={colors.brand[700]} />
            </Pressable>
            <Text style={styles.monthLabel}>{monthLabel(month)}</Text>
            <Pressable
              onPress={() => setMonth(shiftMonth(month, 1))}
              hitSlop={10}
              disabled={month >= thisMonth()}
              accessibilityLabel="Next month"
            >
              <Ionicons
                name="chevron-forward"
                size={18}
                color={month >= thisMonth() ? colors.slate300 : colors.brand[700]}
              />
            </Pressable>
          </View>

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
                {/* Owed, not used. Kept visually apart from the two above for
                    that reason -- it is the opposite direction of travel. */}
                {(summaryQuery.data?.compOffOutstanding ?? 0) > 0 && (
                  <View style={[styles.typeChip, styles.compChip]}>
                    <Text style={[styles.typeChipLabel, styles.compChipLabel]}>Comp off owed</Text>
                    <Text style={[styles.typeChipValue, styles.compChipLabel]}>
                      {summaryQuery.data?.compOffOutstanding}
                    </Text>
                  </View>
                )}
              </View>

              {/* The twelve-month history, as a strip rather than a list: the
                  shape of a year of leave is the useful part, and any bar can
                  be tapped for its own figures. */}
              {(summaryQuery.data?.byMonth?.length ?? 0) > 0 && (
                <View style={styles.strip}>
                  {summaryQuery.data!.byMonth.map((m) => {
                    const peak = Math.max(1, ...summaryQuery.data!.byMonth.map((x) => x.takenTotal));
                    const on = m.month === month;
                    return (
                      <Pressable
                        key={m.month}
                        style={styles.stripCol}
                        onPress={() => setMonth(m.month)}
                        accessibilityLabel={`${monthLabel(m.month)}: ${m.takenTotal} days`}
                      >
                        <View
                          style={[
                            styles.stripBar,
                            { height: 4 + Math.round((m.takenTotal / peak) * 26) },
                            on && styles.stripBarOn,
                          ]}
                        />
                        <Text style={[styles.stripLabel, on && styles.stripLabelOn]}>
                          {m.month.slice(5)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Said plainly rather than implied by the absence of a balance. */}
              <Text style={styles.footnote}>
                Days approved in this month. Your entitlement isn't held in this app — HR has it.
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

                {/* Already claimed: state it rather than offering it twice. */}
                {r.compOffEarned > 0 ? (
                  <View style={styles.compRow}>
                    <Ionicons name="swap-horizontal-outline" size={13} color={'#047857'} />
                    <Text style={styles.compText}>
                      Worked {r.workedOn ? shortDate(r.workedOn) : 'a day'} · {r.compOffEarned} day
                      {r.compOffEarned === 1 ? '' : 's'} owed back
                    </Text>
                  </View>
                ) : r.status === 'approved' && r.leaveType === 'unpaid' ? (
                  <Pressable
                    onPress={() => setClaiming(r)}
                    disabled={claimWorked.isPending}
                    style={({ pressed }) => [styles.claim, pressed && styles.pressed]}
                    accessibilityRole="button"
                  >
                    <Ionicons name="briefcase-outline" size={13} color={colors.brand[700]} />
                    <Text style={styles.claimText}>I worked one of these days</Text>
                  </Pressable>
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Which day, chosen from the ones the leave actually covers -- the
          server refuses anything outside the range, so offering a free date
          field would invite an error it can already prevent. */}
      <Modal visible={claiming !== null} transparent animationType="slide" onRequestClose={() => setClaiming(null)}>
        <Pressable style={styles.backdrop} onPress={() => setClaiming(null)} />
        <View style={styles.sheet}>
          <View style={styles.sheetBar}>
            <Text style={styles.sheetTitle}>Which day did you work?</Text>
            <Pressable onPress={() => setClaiming(null)} hitSlop={12} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.slate500} />
            </Pressable>
          </View>
          {claiming
            ? daysBetween(claiming.startDate, claiming.endDate).map((d) => (
                <Pressable
                  key={d}
                  style={styles.sheetRow}
                  onPress={() => {
                    const id = claiming.id;
                    setClaiming(null);
                    claimWorked.mutate({ id, day: d });
                  }}
                >
                  <Text style={styles.sheetRowText}>{shortDate(d)}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.slate300} />
                </Pressable>
              ))
            : null}
          <Text style={styles.sheetNote}>
            Working an unpaid day earns it back as a day off. Your manager sees the claim.
          </Text>
        </View>
      </Modal>

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

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
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
    tilePending: { color: colors.warningText },
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

    monthBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 12,
    },
    monthLabel: { fontSize: 13, fontWeight: '800', color: colors.textLight, letterSpacing: -0.2 },

    compChip: { backgroundColor: colors.successBg },
    compChipLabel: { color: '#047857' },

    strip: {
      flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
      gap: 3, marginTop: 14, paddingTop: 10,
      borderTopWidth: 1, borderTopColor: colors.slate100,
    },
    stripCol: { flex: 1, alignItems: 'center', gap: 3 },
    stripBar: { width: '100%', borderRadius: 2, backgroundColor: colors.slate200, minHeight: 4 },
    stripBarOn: { backgroundColor: colors.brand[700] },
    stripLabel: { fontSize: 8.5, color: colors.slate400, fontWeight: '700' },
    stripLabelOn: { color: colors.brand[700] },

    sectionTitle: {
      fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4,
      color: colors.slate500, marginTop: 6, marginLeft: 2,
    },
    empty: { fontSize: 11.5, color: colors.slate400, fontWeight: '600' },
    error: { color: colors.dangerText, fontSize: 11.5, fontWeight: '600' },

    reqCard: { padding: 14, gap: 7 },
    reqHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    reqDates: { flex: 1, fontSize: 13, fontWeight: '800', color: colors.textLight, letterSpacing: -0.2 },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.sm },
    badgeText: { fontSize: 10, fontWeight: '800' },
    reqMeta: { fontSize: 10.5, color: colors.slate500, fontWeight: '700' },
    reqReason: { fontSize: 11.5, color: colors.slate600, lineHeight: 17 },
    reqNote: { fontSize: 11, color: colors.slate500, fontStyle: 'italic' },
    withdraw: { alignSelf: 'flex-start', paddingVertical: 4 },
    claim: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingVertical: 4 },
    claimText: { fontSize: 11.5, fontWeight: '800', color: colors.brand[700] },
    compRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
    compText: { fontSize: 11, fontWeight: '700', color: '#047857' },

    backdrop: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15,23,42,0.35)',
    },
    sheet: {
      position: 'absolute', left: 0, right: 0, bottom: 0,
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
      paddingBottom: 28,
    },
    sheetBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: colors.slate100,
    },
    sheetTitle: { fontSize: 14, fontWeight: '800', color: colors.textLight },
    sheetRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: colors.slate100,
    },
    sheetRowText: { fontSize: 13.5, fontWeight: '600', color: colors.textLight },
    sheetNote: { fontSize: 10.5, color: colors.slate400, paddingHorizontal: 20, paddingTop: 12, lineHeight: 15 },

    withdrawText: { fontSize: 11.5, fontWeight: '800', color: colors.dangerText },
  });
}
