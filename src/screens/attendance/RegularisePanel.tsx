import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, TextField } from '../../components/ui';
import { colors, radii } from '../../theme/tokens';
import { getApiErrorMessage } from '../../api/client';
import { formatDate, formatTime, toLocalDateKey } from '../../utils/datetime';
import {
  cancelRegularisation,
  createRegularisation,
  getMyRegularisations,
  type RegularisationRequestType,
  type RegularisationStatus,
} from '../../api/regularisation.api';

const STATUS_STYLE: Record<RegularisationStatus, { bg: string; fg: string }> = {
  pending: { bg: colors.warningBg, fg: '#B45309' },
  approved: { bg: colors.successBg, fg: '#047857' },
  rejected: { bg: colors.dangerBg, fg: '#BE123C' },
  cancelled: { bg: colors.slate100, fg: colors.slate500 },
};

type PickerTarget = 'date' | 'in' | 'out' | null;

/** A picked time expressed on the day being corrected, not on today. */
function onDay(day: Date, time: Date) {
  const d = new Date(day);
  d.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return d;
}

export function RegularisePanel() {
  const queryClient = useQueryClient();

  const [markDate, setMarkDate] = useState<Date>(new Date());
  const [requestType, setRequestType] = useState<RegularisationRequestType>('adjust');
  const [clockIn, setClockIn] = useState<Date | null>(null);
  const [clockOut, setClockOut] = useState<Date | null>(null);
  const [reason, setReason] = useState('');
  const [picker, setPicker] = useState<PickerTarget>(null);
  const [banner, setBanner] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null);

  const listQuery = useQuery({
    queryKey: ['regularisation-mine'],
    queryFn: () => getMyRegularisations(),
  });
  const requests = listQuery.data?.items ?? [];

  const fieldError = useMemo(() => {
    if (requestType === 'adjust' && !clockIn && !clockOut) return 'Pick at least one corrected time.';
    if (clockIn && clockOut && onDay(markDate, clockOut) <= onDay(markDate, clockIn)) {
      return 'Clock-out has to be after clock-in.';
    }
    if (!reason.trim()) return 'Say why the correction is needed.';
    return null;
  }, [requestType, clockIn, clockOut, markDate, reason]);

  const submit = useMutation({
    mutationFn: () =>
      createRegularisation({
        mark_date: toLocalDateKey(markDate),
        request_type: requestType,
        ...(requestType === 'adjust' && clockIn
          ? { requested_clock_in: onDay(markDate, clockIn).toISOString() }
          : {}),
        ...(requestType === 'adjust' && clockOut
          ? { requested_clock_out: onDay(markDate, clockOut).toISOString() }
          : {}),
        reason: reason.trim(),
      }),
    onSuccess: () => {
      setBanner({ tone: 'success', text: 'Request sent for approval.' });
      setClockIn(null);
      setClockOut(null);
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['regularisation-mine'] });
    },
    onError: (err) => setBanner({ tone: 'warning', text: getApiErrorMessage(err) }),
  });

  const withdraw = useMutation({
    mutationFn: (id: string) => cancelRegularisation(id),
    onSuccess: () => {
      setBanner({ tone: 'success', text: 'Request withdrawn.' });
      queryClient.invalidateQueries({ queryKey: ['regularisation-mine'] });
    },
    onError: (err) => setBanner({ tone: 'warning', text: getApiErrorMessage(err) }),
  });

  // Android's picker is an OS modal that dismisses itself; iOS renders inline
  // and has to be closed deliberately, so it keeps a Done button.
  const onPicked = (target: Exclude<PickerTarget, null>) => (_e: unknown, picked?: Date) => {
    if (Platform.OS !== 'ios') setPicker(null);
    if (!picked) return;
    if (target === 'date') setMarkDate(picked);
    else if (target === 'in') setClockIn(picked);
    else setClockOut(picked);
  };

  return (
    <View style={styles.wrap}>
      {banner && (
        <View style={[styles.banner, banner.tone === 'success' ? styles.bannerSuccess : styles.bannerWarning]}>
          <Text style={styles.bannerText}>{banner.text}</Text>
        </View>
      )}

      <Card>
        <Text style={styles.sectionLabel}>Date</Text>
        <Field
          icon="calendar-outline"
          value={formatDate(markDate)}
          onPress={() => setPicker(picker === 'date' ? null : 'date')}
          active={picker === 'date'}
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
              <View style={styles.timeCol}>
                <Text style={styles.miniLabel}>Clock in</Text>
                <Field
                  icon="time-outline"
                  value={clockIn ? formatTime(clockIn) : 'Not set'}
                  muted={!clockIn}
                  onPress={() => setPicker(picker === 'in' ? null : 'in')}
                  active={picker === 'in'}
                />
              </View>
              <View style={styles.timeCol}>
                <Text style={styles.miniLabel}>Clock out</Text>
                <Field
                  icon="time-outline"
                  value={clockOut ? formatTime(clockOut) : 'Not set'}
                  muted={!clockOut}
                  onPress={() => setPicker(picker === 'out' ? null : 'out')}
                  active={picker === 'out'}
                />
              </View>
            </View>
            <Text style={styles.hint}>Set only the one that is missing, if the other was recorded.</Text>
          </>
        )}

        {picker && (
          <View style={styles.pickerWrap}>
            <DateTimePicker
              value={picker === 'date' ? markDate : picker === 'in' ? clockIn ?? markDate : clockOut ?? markDate}
              mode={picker === 'date' ? 'date' : 'time'}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              // A correction is always about a day that has already happened.
              maximumDate={picker === 'date' ? new Date() : undefined}
              onChange={onPicked(picker)}
            />
            {Platform.OS === 'ios' && (
              <Pressable onPress={() => setPicker(null)} style={styles.pickerDone}>
                <Text style={styles.pickerDoneText}>Done</Text>
              </Pressable>
            )}
          </View>
        )}

        <View style={styles.balanceRow}>
          <Ionicons name="information-circle-outline" size={15} color={colors.slate500} />
          <Text style={styles.balanceText}>
            Corrections are limited per calendar month, counted on the day being corrected.
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

        {fieldError && reason.length > 0 ? <Text style={styles.fieldError}>{fieldError}</Text> : null}

        <Button
          title="Request"
          onPress={() => submit.mutate()}
          disabled={Boolean(fieldError)}
          loading={submit.isPending}
        />
      </Card>

      <Card>
        <Text style={styles.sectionLabel}>Your requests</Text>
        {listQuery.isLoading ? (
          <ActivityIndicator color={colors.brand[700]} style={styles.spacer} />
        ) : requests.length === 0 ? (
          <Text style={styles.empty}>No corrections raised yet.</Text>
        ) : (
          requests.map((r, i) => {
            const tone = STATUS_STYLE[r.status];
            return (
              <View key={r.id} style={[styles.row, i === requests.length - 1 && styles.rowLast]}>
                <View style={styles.rowMain}>
                  <View style={styles.rowTop}>
                    <Text style={styles.rowDate}>{formatDate(r.markDate)}</Text>
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

function Field({
  icon,
  value,
  onPress,
  active,
  muted,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onPress: () => void;
  active?: boolean;
  muted?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.field, active && styles.fieldActive, pressed && styles.fieldPressed]}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={16} color={active ? colors.brand[700] : colors.slate400} />
      <Text style={[styles.fieldText, muted && styles.fieldTextMuted]}>{value}</Text>
      <Ionicons name="chevron-down" size={15} color={colors.slate400} />
    </Pressable>
  );
}

function Choice({ selected, title, onPress }: { selected: boolean; title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.choice} accessibilityRole="radio" accessibilityState={{ selected }}>
      <View style={[styles.radio, selected && styles.radioOn]}>{selected && <View style={styles.radioDot} />}</View>
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
  miniLabel: {
    fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3,
    color: colors.slate400, marginBottom: 5,
  },

  field: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 48, paddingHorizontal: 12, borderRadius: radii.md,
    borderWidth: 1.5, borderColor: colors.slate200, backgroundColor: colors.white,
  },
  fieldActive: { borderColor: colors.brand[700] },
  fieldPressed: { opacity: 0.85 },
  fieldText: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textLight },
  fieldTextMuted: { color: colors.slate400, fontWeight: '600' },

  pickerWrap: { marginTop: 6, alignItems: 'stretch' },
  pickerDone: { alignSelf: 'flex-end', paddingHorizontal: 14, paddingVertical: 8 },
  pickerDoneText: { color: colors.brand[700], fontSize: 14, fontWeight: '800' },

  choice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.slate300,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  radioOn: { borderColor: colors.brand[700] },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand[700] },
  choiceText: { flex: 1, fontSize: 13, color: colors.textLight, lineHeight: 18 },

  timeRow: { flexDirection: 'row', gap: 12 },
  timeCol: { flex: 1 },
  hint: { fontSize: 11.5, color: colors.slate400, marginTop: 8 },

  balanceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.slate50, borderRadius: radii.sm, padding: 10, marginVertical: 10,
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
