import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, TextField } from '../../components/ui';
import { colors, radii } from '../../theme/tokens';
import { getApiErrorMessage } from '../../api/client';
import {
  cancelRegularisation,
  createRegularisation,
  getMyRegularisations,
  getRegularisationBalance,
  type RegularisationRequestType,
  type RegularisationStatus,
} from '../../api/regularisation.api';

const todayISO = () => new Date().toISOString().slice(0, 10);
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
const isTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s.trim());

/** 'HH:MM' on a given day, as the ISO instant the API expects. */
function atLocalTime(day: string, hhmm: string) {
  const [h, m] = hhmm.trim().split(':').map(Number);
  const d = new Date(`${day}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

const STATUS_STYLE: Record<RegularisationStatus, { bg: string; fg: string }> = {
  pending: { bg: colors.warningBg, fg: '#B45309' },
  approved: { bg: colors.successBg, fg: '#047857' },
  rejected: { bg: colors.dangerBg, fg: '#BE123C' },
  cancelled: { bg: colors.slate100, fg: colors.slate500 },
};

export function RegularisePanel() {
  const queryClient = useQueryClient();

  const [markDate, setMarkDate] = useState(todayISO());
  const [requestType, setRequestType] = useState<RegularisationRequestType>('adjust');
  const [clockIn, setClockIn] = useState('');
  const [clockOut, setClockOut] = useState('');
  const [reason, setReason] = useState('');
  const [banner, setBanner] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null);

  // Keyed on the date: the ration is counted on the day being corrected, so
  // editing the date changes which month's balance applies.
  const balanceQuery = useQuery({
    queryKey: ['regularisation-balance', isDate(markDate) ? markDate : todayISO()],
    queryFn: () => getRegularisationBalance(isDate(markDate) ? markDate : todayISO()),
  });

  const listQuery = useQuery({
    queryKey: ['regularisation-mine'],
    queryFn: getMyRegularisations,
  });

  const fieldError = useMemo(() => {
    if (!isDate(markDate)) return 'Use YYYY-MM-DD.';
    if (requestType === 'adjust') {
      if (!clockIn && !clockOut) return 'Give at least one corrected time.';
      if (clockIn && !isTime(clockIn)) return 'Clock-in must be HH:MM.';
      if (clockOut && !isTime(clockOut)) return 'Clock-out must be HH:MM.';
    }
    if (!reason.trim()) return 'Say why the correction is needed.';
    return null;
  }, [markDate, requestType, clockIn, clockOut, reason]);

  const submit = useMutation({
    mutationFn: () =>
      createRegularisation({
        mark_date: markDate.trim(),
        request_type: requestType,
        ...(requestType === 'adjust' && clockIn ? { requested_clock_in: atLocalTime(markDate, clockIn) } : {}),
        ...(requestType === 'adjust' && clockOut ? { requested_clock_out: atLocalTime(markDate, clockOut) } : {}),
        reason: reason.trim(),
      }),
    onSuccess: () => {
      setBanner({ tone: 'success', text: 'Request sent for approval.' });
      setClockIn('');
      setClockOut('');
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['regularisation-mine'] });
      queryClient.invalidateQueries({ queryKey: ['regularisation-balance'] });
    },
    onError: (err) => setBanner({ tone: 'warning', text: getApiErrorMessage(err) }),
  });

  const withdraw = useMutation({
    mutationFn: (id: string) => cancelRegularisation(id),
    onSuccess: () => {
      setBanner({ tone: 'success', text: 'Request withdrawn.' });
      queryClient.invalidateQueries({ queryKey: ['regularisation-mine'] });
      queryClient.invalidateQueries({ queryKey: ['regularisation-balance'] });
    },
    onError: (err) => setBanner({ tone: 'warning', text: getApiErrorMessage(err) }),
  });

  const balance = balanceQuery.data;
  const spent = balance ? balance.remaining === 0 : false;

  return (
    <View style={styles.wrap}>
      {banner && (
        <View style={[styles.banner, banner.tone === 'success' ? styles.bannerSuccess : styles.bannerWarning]}>
          <Text style={styles.bannerText}>{banner.text}</Text>
        </View>
      )}

      <Card>
        <Text style={styles.sectionLabel}>Date</Text>
        <TextField
          label=""
          value={markDate}
          onChangeText={setMarkDate}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
        />

        <Text style={styles.sectionLabel}>What are you asking for?</Text>
        <Choice
          selected={requestType === 'adjust'}
          title="Add/update time entries to adjust attendance logs."
          onPress={() => setRequestType('adjust')}
        />
        <Choice
          selected={requestType === 'other'}
          title="Others — raise a request that is not a time correction."
          onPress={() => setRequestType('other')}
        />

        {requestType === 'adjust' && (
          <>
            <Text style={styles.sectionLabel}>Attendance adjustment</Text>
            <View style={styles.timeRow}>
              <View style={styles.timeField}>
                <TextField
                  label="Clock in"
                  value={clockIn}
                  onChangeText={setClockIn}
                  placeholder="HH:MM"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={styles.timeField}>
                <TextField
                  label="Clock out"
                  value={clockOut}
                  onChangeText={setClockOut}
                  placeholder="HH:MM"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
            <Text style={styles.hint}>Leave one blank if only the other is missing.</Text>
          </>
        )}

        {/* Shown before the form is filled in, not on submit — the limit is a
            fact about the month, not a surprise about this attempt. */}
        <View style={styles.balanceRow}>
          <Ionicons name="information-circle-outline" size={15} color={colors.slate500} />
          <Text style={styles.balanceText}>
            {balanceQuery.isLoading || !balance
              ? 'Checking your remaining balance…'
              : `Remaining balance: ${balance.remaining} of ${balance.limit} this month`}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Reason</Text>
        <TextField
          label=""
          value={reason}
          onChangeText={setReason}
          placeholder="Missed clock-out, network issue…"
          multiline
        />

        {fieldError && reason.length > 0 && <Text style={styles.fieldError}>{fieldError}</Text>}
        {spent && (
          <Text style={styles.fieldError}>
            You have used every correction for this month. Pick a date in another month, or ask your manager.
          </Text>
        )}

        <Button
          title="Request"
          onPress={() => submit.mutate()}
          disabled={Boolean(fieldError) || spent}
          loading={submit.isPending}
        />
      </Card>

      <Card>
        <Text style={styles.sectionLabel}>Your requests</Text>
        {listQuery.isLoading ? (
          <ActivityIndicator color={colors.brand[700]} style={styles.spacer} />
        ) : !listQuery.data?.length ? (
          <Text style={styles.empty}>No corrections raised yet.</Text>
        ) : (
          listQuery.data.map((r, i) => {
            const tone = STATUS_STYLE[r.status];
            return (
              <View key={r.id} style={[styles.row, i === listQuery.data.length - 1 && styles.rowLast]}>
                <View style={styles.rowMain}>
                  <View style={styles.rowTop}>
                    <Text style={styles.rowDate}>{r.markDate.slice(0, 10)}</Text>
                    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.pillText, { color: tone.fg }]}>{r.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.rowReason} numberOfLines={2}>
                    {r.reason}
                  </Text>
                  {r.decisionNote ? <Text style={styles.rowNote}>“{r.decisionNote}”</Text> : null}
                </View>
                {r.status === 'pending' && (
                  <Pressable
                    onPress={() => withdraw.mutate(r.id)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Withdraw request"
                  >
                    <Ionicons name="close-circle-outline" size={20} color={colors.slate400} />
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

function Choice({ selected, title, onPress }: { selected: boolean; title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.choice} accessibilityRole="radio" accessibilityState={{ selected }}>
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected && <View style={styles.radioDot} />}
      </View>
      <Text style={styles.choiceText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },

  banner: { borderRadius: radii.md, padding: 12 },
  bannerSuccess: { backgroundColor: colors.successBg },
  bannerWarning: { backgroundColor: colors.warningBg },
  bannerText: { fontSize: 13, fontWeight: '600', color: colors.slate800 },

  sectionLabel: {
    fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4,
    color: colors.slate500, marginBottom: 8, marginTop: 4,
  },

  choice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.slate300,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  radioOn: { borderColor: colors.brand[700] },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand[700] },
  choiceText: { flex: 1, fontSize: 13, color: colors.textLight, lineHeight: 18 },

  timeRow: { flexDirection: 'row', gap: 12 },
  timeField: { flex: 1 },
  hint: { fontSize: 11.5, color: colors.slate400, marginTop: -6, marginBottom: 4 },

  balanceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.slate50, borderRadius: radii.sm, padding: 10, marginVertical: 6,
  },
  balanceText: { flex: 1, fontSize: 12, color: colors.slate600, fontWeight: '600' },

  fieldError: { color: colors.danger, fontSize: 12, fontWeight: '600', marginBottom: 8 },

  spacer: { marginVertical: 12 },
  empty: { fontSize: 13, color: colors.slate400, paddingVertical: 8 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.slate100,
  },
  rowLast: { borderBottomWidth: 0 },
  rowMain: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowDate: { fontSize: 13.5, fontWeight: '800', color: colors.textLight },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill },
  pillText: { fontSize: 10.5, fontWeight: '800', textTransform: 'capitalize' },
  rowReason: { fontSize: 12.5, color: colors.slate600, marginTop: 3 },
  rowNote: { fontSize: 12, color: colors.slate500, marginTop: 4, fontStyle: 'italic' },
});
