import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, TextField } from '../../components/ui';
import { DatePickerField, TimePickerField } from '../../components/PickerField';
import { colors, radii } from '../../theme/tokens';
import { useAuthStore } from '../../stores/authStore';
import { cancelRegularisation, getMyRegularisations, submitRegularisation } from '../../api/attendance.api';
import { getApiErrorCode, getApiErrorMessage } from '../../api/client';
import type { Regularisation, RegularisationRequestType, RegularisationStatus } from '../../types/attendance';

const today = () => new Date().toISOString().slice(0, 10);

const STATUS_TONE: Record<RegularisationStatus, 'warning' | 'success' | 'danger' | 'slate'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'slate',
};
const STATUS_LABEL: Record<RegularisationStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Combines a YYYY-MM-DD date with an HH:MM wall-clock time into a proper UTC
// ISO instant, the same way every other punch on this app is timestamped
// (new Date(...).toISOString()) -- avoids ever sending an offset-less string
// whose timezone a server would have to guess.
function combineDateTime(markDate: string, hhmm: string): string | null {
  const [y, mo, d] = markDate.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  if (!y || !mo || !d || Number.isNaN(h) || Number.isNaN(mi)) return null;
  const dt = new Date(y, mo - 1, d, h, mi, 0);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

export function RegularisePanel() {
  const employee = useAuthStore((s) => s.employee);
  const store = useAuthStore((s) => s.store);
  const queryClient = useQueryClient();

  const [markDate, setMarkDate] = useState(today());
  const [requestType, setRequestType] = useState<RegularisationRequestType>('other');
  const [clockIn, setClockIn] = useState('');
  const [clockOut, setClockOut] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<{ markDate?: string; time?: string; reason?: string }>({});
  const [banner, setBanner] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null);

  const listQuery = useQuery({
    queryKey: ['regularisation-mine', employee?.id],
    queryFn: getMyRegularisations,
    enabled: !!employee,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const requested_clock_in = clockIn ? combineDateTime(markDate, clockIn) ?? undefined : undefined;
      const requested_clock_out = clockOut ? combineDateTime(markDate, clockOut) ?? undefined : undefined;
      return submitRegularisation({
        store_code: store!.store_code,
        mark_date: markDate,
        request_type: requestType,
        requested_clock_in,
        requested_clock_out,
        reason: reason.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regularisation-mine', employee?.id] });
      setBanner({ tone: 'success', text: 'Request submitted for approval.' });
      setReason('');
      setClockIn('');
      setClockOut('');
    },
    onError: (err) => setBanner({ tone: 'warning', text: getApiErrorMessage(err) }),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelRegularisation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regularisation-mine', employee?.id] });
      setBanner({ tone: 'success', text: 'Request withdrawn.' });
    },
    // Refetch on failure too. The server answers "not yours", "already
    // decided" and "never existed" with the same 404 so ids cannot be probed,
    // and by far the likeliest of those here is a reviewer deciding the
    // request between this list rendering and the button being pressed --
    // in which case the list on screen is simply stale, and refetching both
    // explains the message and corrects the row.
    onError: (err) => {
      queryClient.invalidateQueries({ queryKey: ['regularisation-mine', employee?.id] });
      // The server's own copy for that 404 is "That request was not found.",
      // which is the honest wording for an id nobody can see and the wrong
      // one for a row the employee is looking at. Only the collapsed code is
      // available to tell them apart, so this substitutes the reading that
      // fits being here at all -- every other error keeps the server's text.
      const text =
        getApiErrorCode(err) === 'REGULARISATION_NOT_FOUND'
          ? 'That request is no longer pending — it may have just been decided.'
          : getApiErrorMessage(err);
      setBanner({ tone: 'warning', text });
    },
  });

  function confirmWithdraw(request: Regularisation) {
    // Cancelling is one-way: there is no un-cancel, and re-raising means
    // filling the form in again. Worth a confirm on a row whose button sits
    // directly under a scrolling list.
    Alert.alert('Withdraw request?', `Your regularisation for ${fmtDate(request.markDate)} will be cancelled.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: () => {
          setBanner(null);
          cancelMutation.mutate(request.id);
        },
      },
    ]);
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(markDate) || Number.isNaN(new Date(markDate).getTime())) {
      next.markDate = 'Enter a valid date as YYYY-MM-DD';
    }
    if (!reason.trim()) {
      next.reason = 'Please add a reason';
    }
    if (requestType === 'adjust' && !clockIn && !clockOut) {
      next.time = 'Enter at least one corrected time';
    }
    if (clockIn && clockOut) {
      const inIso = combineDateTime(markDate, clockIn);
      const outIso = combineDateTime(markDate, clockOut);
      if (inIso && outIso && outIso <= inIso) {
        next.time = 'Corrected clock-out must be after clock-in';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit() {
    setBanner(null);
    if (!validate()) return;
    submitMutation.mutate();
  }

  if (!employee || !store) return null;

  return (
    <View style={styles.wrap}>
      {banner && (
        <View style={[styles.banner, banner.tone === 'success' ? styles.bannerSuccess : styles.bannerWarning]}>
          <Text style={styles.bannerText}>{banner.text}</Text>
        </View>
      )}

      <Card style={styles.formCard}>
        <DatePickerField
          label="Date"
          value={markDate}
          onChange={setMarkDate}
          maximumDate={new Date()}
          error={errors.markDate}
        />

        <Text style={styles.fieldLabel}>Request type</Text>
        <View style={styles.segment}>
          {(['other', 'adjust'] as RegularisationRequestType[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => setRequestType(t)}
              style={[styles.segmentItem, requestType === t && styles.segmentItemActive]}
            >
              <Text style={[styles.segmentText, requestType === t && styles.segmentTextActive]}>
                {t === 'adjust' ? 'Missing/wrong punch' : 'Other (on-duty, WFH)'}
              </Text>
            </Pressable>
          ))}
        </View>

        {requestType === 'adjust' && (
          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <TimePickerField label="Corrected clock-in" value={clockIn} onChange={setClockIn} />
            </View>
            <View style={styles.timeField}>
              <TimePickerField label="Corrected clock-out" value={clockOut} onChange={setClockOut} />
            </View>
          </View>
        )}
        {errors.time && <Text style={styles.errorText}>{errors.time}</Text>}

        <TextField
          label="Reason"
          value={reason}
          onChangeText={setReason}
          placeholder="Missed clock-in, network issue…"
          error={errors.reason}
          multiline
        />

        <Button title="Submit request" onPress={handleSubmit} loading={submitMutation.isPending} />
      </Card>

      <Card style={styles.listCard}>
        <Text style={styles.cardTitle}>Your requests</Text>
        {listQuery.isLoading ? (
          <ActivityIndicator color={colors.brand[700]} style={styles.loadingSpacer} />
        ) : listQuery.isError ? (
          <Text style={styles.errorText}>Could not load your requests.</Text>
        ) : (listQuery.data ?? []).length === 0 ? (
          <Text style={styles.emptyText}>No requests yet.</Text>
        ) : (
          (listQuery.data as Regularisation[]).map((r, i, arr) => {
            // Two different things during an in-flight cancel, deliberately.
            // Every row's button is disabled and greyed, so a second withdraw
            // cannot be started before the first has settled. Only the row
            // being withdrawn says so, which `variables` -- the id handed to
            // the in-flight mutate call -- is what identifies.
            const withdrawing = cancelMutation.isPending && cancelMutation.variables === r.id;
            return (
              <View key={r.id} style={[styles.reqRow, i === arr.length - 1 && styles.reqRowLast]}>
                <View style={styles.reqHeader}>
                  <Text style={styles.reqDate}>{fmtDate(r.markDate)}</Text>
                  <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                </View>
                <Text style={styles.reqReason} numberOfLines={2}>
                  {r.reason}
                </Text>
                {/* Pending is the only withdrawable state -- the server
                    refuses anything else, so offering the button on a decided
                    row would only produce an error the UI already knows. */}
                {r.status === 'pending' && (
                  <Pressable
                    onPress={() => confirmWithdraw(r)}
                    disabled={cancelMutation.isPending}
                    hitSlop={8}
                    style={styles.withdrawButton}
                  >
                    <Text style={[styles.withdrawText, cancelMutation.isPending && styles.withdrawTextDisabled]}>
                      {withdrawing ? 'Withdrawing…' : 'Withdraw'}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  banner: { borderRadius: radii.md, padding: 12 },
  bannerSuccess: { backgroundColor: colors.successBg },
  bannerWarning: { backgroundColor: colors.warningBg },
  bannerText: { fontSize: 12, fontWeight: '600', color: colors.slate800 },

  formCard: { gap: 2 },
  fieldLabel: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4,
    color: colors.slate500, marginBottom: 6,
  },
  segment: {
    flexDirection: 'row', backgroundColor: colors.slate100, borderRadius: radii.md, padding: 4, marginBottom: 14,
  },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radii.sm },
  segmentItemActive: {
    backgroundColor: colors.white,
    shadowColor: colors.slate900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: { fontSize: 12, fontWeight: '700', color: colors.slate500, textAlign: 'center' },
  segmentTextActive: { color: colors.brand[700] },
  timeRow: { flexDirection: 'row', gap: 12 },
  timeField: { flex: 1 },

  errorText: { color: colors.danger, fontSize: 12, fontWeight: '600', marginTop: -8, marginBottom: 14 },

  listCard: { gap: 4 },
  cardTitle: {
    fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4,
    color: colors.slate500, marginBottom: 4,
  },
  loadingSpacer: { marginVertical: 12 },
  emptyText: { fontSize: 13, color: colors.slate400, paddingVertical: 8, textAlign: 'center' },
  reqRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.slate100, gap: 4 },
  reqRowLast: { borderBottomWidth: 0 },
  reqHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reqDate: { fontSize: 13, fontWeight: '700', color: colors.textLight },
  reqReason: { fontSize: 12, color: colors.slate500 },
  // Text-only, and sized to its own text rather than the row: a filled button
  // per row would compete with "Submit request" above, which is the panel's
  // primary action, and a full-width tap target under a scrolling list is easy
  // to hit by accident.
  withdrawButton: { alignSelf: 'flex-start', paddingVertical: 2 },
  withdrawText: { fontSize: 12, fontWeight: '700', color: colors.danger },
  withdrawTextDisabled: { color: colors.slate400 },
});
