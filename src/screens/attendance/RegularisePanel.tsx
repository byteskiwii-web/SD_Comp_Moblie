import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, TextField } from '../../components/ui';
import { colors, radii } from '../../theme/tokens';
import { useAuthStore } from '../../stores/authStore';
import { getMyRegularisations, submitRegularisation } from '../../api/attendance.api';
import { getApiErrorMessage } from '../../api/client';
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
    queryFn: () => getMyRegularisations(employee!.id),
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
        <TextField
          label="Date"
          value={markDate}
          onChangeText={setMarkDate}
          placeholder="YYYY-MM-DD"
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
              <TextField label="Corrected clock-in" value={clockIn} onChangeText={setClockIn} placeholder="HH:MM" />
            </View>
            <View style={styles.timeField}>
              <TextField label="Corrected clock-out" value={clockOut} onChangeText={setClockOut} placeholder="HH:MM" />
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
          (listQuery.data as Regularisation[]).map((r, i, arr) => (
            <View key={r.id} style={[styles.reqRow, i === arr.length - 1 && styles.reqRowLast]}>
              <View style={styles.reqHeader}>
                <Text style={styles.reqDate}>{fmtDate(r.mark_date)}</Text>
                <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
              </View>
              <Text style={styles.reqReason} numberOfLines={2}>
                {r.reason}
              </Text>
            </View>
          ))
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
});
