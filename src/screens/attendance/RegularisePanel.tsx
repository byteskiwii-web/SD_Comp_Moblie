import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, TextField } from '../../components/ui';
import { DatePickerField, TimePickerField } from '../../components/PickerField';
import { TourTarget } from '../../components/tour/TourTarget';
import { colors, radii } from '../../theme/tokens';
import { useAuthStore } from '../../stores/authStore';
import { getAttendanceHistory, getMyRegularisations, submitRegularisation } from '../../api/attendance.api';
import { getApiErrorMessage } from '../../api/client';
import { formatDuration, summariseDay } from '../../utils/attendanceDay';
import { formatTime, newestFirst, toLocalDateKey } from '../../utils/datetime';
import type { Regularisation, RegularisationRequestType, RegularisationStatus } from '../../types/attendance';
import { SkeletonRows } from '../../components/Skeleton';

const today = () => toLocalDateKey();

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
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Combines a YYYY-MM-DD date with an HH:MM wall-clock time into a UTC ISO
 * instant, the way every other punch in this app is timestamped — never an
 * offset-less string whose timezone the server would have to guess.
 */
function combineDateTime(markDate: string, hhmm: string): string | null {
  const [y, mo, d] = markDate.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  if (!y || !mo || !d || Number.isNaN(h) || Number.isNaN(mi)) return null;
  const dt = new Date(y, mo - 1, d, h, mi, 0);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

const pad = (n: number) => String(n).padStart(2, '0');
const hhmmOf = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
/** 'HH:MM:SS' from /auth/me down to 'HH:MM'; falls back when there is no roster. */
const shiftHHMM = (v: string | null | undefined, fallback: string) =>
  v && /^\d{2}:\d{2}/.test(v) ? v.slice(0, 5) : fallback;

type StampRow = { key: string; inTime: string; outTime: string };

let rowSeq = 0;
const newKey = () => `r${++rowSeq}`;

export function RegularisePanel({ initialDate }: { initialDate?: string } = {}) {
  const employee = useAuthStore((s) => s.employee);
  const store = useAuthStore((s) => s.store);
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();

  const [markDate, setMarkDate] = useState(initialDate ?? today());
  const [requestType, setRequestType] = useState<RegularisationRequestType>('adjust');
  const [rows, setRows] = useState<StampRow[]>([]);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<{ time?: string; reason?: string }>({});
  const [banner, setBanner] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null);

  const dayStart = shiftHHMM(profile?.shiftStart, '10:00');
  const dayEnd = shiftHHMM(profile?.shiftEnd, '19:00');

  const dayQuery = useQuery({
    queryKey: ['attendance-day', employee?.id, markDate],
    queryFn: () => getAttendanceHistory(employee!.id, markDate, markDate),
    enabled: !!employee,
  });
  const day = useMemo(() => summariseDay(markDate, dayQuery.data ?? []), [markDate, dayQuery.data]);

  /**
   * Seed the editable rows from what was actually recorded that day.
   *
   * Never blank: a correction form that opens empty makes somebody retype times
   * the system already knows, and the commonest case — a missed clock-out — is
   * one where the clock-IN is on file and correct. A missing half is filled
   * with the rostered time as a starting point to adjust, not left for the user
   * to invent.
   */
  useEffect(() => {
    if (dayQuery.isLoading) return;
    const seeded: StampRow[] = day.pairs.map((p) => ({
      key: newKey(),
      inTime: hhmmOf(p.inAt),
      outTime: p.outAt ? hhmmOf(p.outAt) : dayEnd,
    }));
    setRows(seeded.length > 0 ? seeded : [{ key: newKey(), inTime: dayStart, outTime: dayEnd }]);
  }, [markDate, dayQuery.isLoading, dayQuery.data]);

  const listQuery = useQuery({
    queryKey: ['regularisation-mine', employee?.id],
    queryFn: getMyRegularisations,
    enabled: !!employee,
  });

  /**
   * What the server will actually store.
   *
   * The API takes ONE corrected clock-in and ONE corrected clock-out per
   * request, so several rows collapse to the day's span: earliest in, latest
   * out. Shown on the form rather than done quietly, because a row someone
   * edited that turns out not to be submitted separately is worse than one they
   * were told about.
   */
  const submitted = useMemo(() => {
    const ins = rows.map((r) => r.inTime).filter(Boolean).sort();
    const outs = rows.map((r) => r.outTime).filter(Boolean).sort();
    return { inTime: ins[0] ?? '', outTime: outs[outs.length - 1] ?? '' };
  }, [rows]);

  const submitMutation = useMutation({
    mutationFn: async () =>
      submitRegularisation({
        store_code: store!.store_code,
        mark_date: markDate,
        request_type: requestType,
        requested_clock_in:
          requestType === 'adjust' && submitted.inTime
            ? combineDateTime(markDate, submitted.inTime) ?? undefined
            : undefined,
        requested_clock_out:
          requestType === 'adjust' && submitted.outTime
            ? combineDateTime(markDate, submitted.outTime) ?? undefined
            : undefined,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regularisation-mine', employee?.id] });
      queryClient.invalidateQueries({ queryKey: ['attendance-day', employee?.id, markDate] });
      setBanner({ tone: 'success', text: 'Request submitted for approval.' });
      setReason('');
    },
    onError: (err) => setBanner({ tone: 'warning', text: getApiErrorMessage(err) }),
  });

  function validate(): boolean {
    const next: typeof errors = {};
    if (!reason.trim()) next.reason = 'Please add a note';
    if (requestType === 'adjust') {
      if (!submitted.inTime && !submitted.outTime) next.time = 'Set at least one time';
      else if (submitted.inTime && submitted.outTime && submitted.outTime <= submitted.inTime) {
        next.time = 'Clock-out must be after clock-in';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  const updateRow = (key: string, patch: Partial<StampRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key));
  const addRow = () =>
    setRows((rs) => [
      ...rs,
      // Seeded, not blank: a new row opens on the rostered window so it is
      // adjusted rather than authored from nothing.
      { key: newKey(), inTime: rs.length ? rs[rs.length - 1].outTime : dayStart, outTime: dayEnd },
    ]);

  // markDate leads so the dates on screen descend; createdAt breaks ties for
  // two corrections raised against the same day.
  const myRequests = useMemo(
    () => newestFirst(listQuery.data ?? [], 'markDate', 'createdAt'),
    [listQuery.data]
  );

  if (!employee || !store) return null;

  return (
    <View style={styles.wrap}>
      {banner && (
        <View style={[styles.banner, banner.tone === 'success' ? styles.bannerSuccess : styles.bannerWarning]}>
          <Text style={styles.bannerText}>{banner.text}</Text>
        </View>
      )}

      <Card style={styles.formCard}>
        <View style={styles.hoursRow}>
          <View style={styles.hoursTile}>
            <Text style={styles.hoursValue}>{formatDuration(day.grossMinutes)}</Text>
            <Text style={styles.hoursLabel}>Gross hours</Text>
          </View>
          <View style={styles.hoursTile}>
            <Text style={styles.hoursValue}>{formatDuration(day.effectiveMinutes)}</Text>
            <Text style={styles.hoursLabel}>Effective hours</Text>
          </View>
        </View>

        <TourTarget id="regularise-form">
          <DatePickerField label="Date" value={markDate} onChange={setMarkDate} maximumDate={new Date()} />
        </TourTarget>

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
          <>
            <Text style={styles.fieldLabel}>Attendance adjustment</Text>
            <Text style={styles.help}>
              {dayQuery.isLoading
                ? 'Loading what was recorded that day…'
                : day.pairs.length > 0
                  ? 'Times below are what was recorded. Tap any of them to change it.'
                  : 'Nothing was recorded that day, so these start from your rostered shift.'}
            </Text>

            <View style={styles.stampBox}>
              <Text style={styles.stampBoxTitle}>{day.storeName ?? store.name}</Text>
              {rows.map((row) => (
                <View key={row.key} style={styles.stampRow}>
                  <Ionicons name="arrow-down-outline" size={15} color={colors.success} />
                  <View style={styles.stampCell}>
                    <TimePickerField
                      label=""
                      value={row.inTime}
                      onChange={(v) => updateRow(row.key, { inTime: v })}
                    />
                  </View>
                  <Ionicons name="arrow-up-outline" size={15} color={colors.danger} />
                  <View style={styles.stampCell}>
                    <TimePickerField
                      label=""
                      value={row.outTime}
                      onChange={(v) => updateRow(row.key, { outTime: v })}
                    />
                  </View>
                  <Pressable
                    onPress={() => removeRow(row.key)}
                    disabled={rows.length === 1}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Remove this pair"
                  >
                    <Ionicons
                      name="remove-circle-outline"
                      size={22}
                      color={rows.length === 1 ? colors.slate200 : colors.danger}
                    />
                  </Pressable>
                </View>
              ))}

              <Pressable onPress={addRow} style={styles.addRow} accessibilityRole="button">
                <Ionicons name="add-circle-outline" size={26} color={colors.brand[700]} />
              </Pressable>
            </View>

            {rows.length > 1 && submitted.inTime && submitted.outTime && (
              <View style={styles.submitNote}>
                <Ionicons name="information-circle-outline" size={15} color={colors.slate500} />
                <Text style={styles.submitNoteText}>
                  Sent as one correction for the day: {formatTime(new Date(`${markDate}T${submitted.inTime}:00`))} to{' '}
                  {formatTime(new Date(`${markDate}T${submitted.outTime}:00`))}
                </Text>
              </View>
            )}

            {errors.time ? <Text style={styles.errorText}>{errors.time}</Text> : null}
          </>
        )}

        <TextField
          label="Note (mandatory)"
          value={reason}
          onChangeText={setReason}
          placeholder="Missed clock-out, network issue…"
          multiline
          error={errors.reason}
        />

        <View style={styles.actions}>
          <View style={styles.actionHalf}>
            <Button
              title="Cancel"
              variant="outline"
              onPress={() => {
                setBanner(null);
                setErrors({});
                setReason('');
                setMarkDate(today());
              }}
            />
          </View>
          <View style={styles.actionHalf}>
            <Button
              title="Request"
              onPress={() => {
                setBanner(null);
                if (validate()) submitMutation.mutate();
              }}
              loading={submitMutation.isPending}
            />
          </View>
        </View>
      </Card>

      <Card style={styles.listCard}>
        <Text style={styles.listTitle}>Your requests</Text>
        {listQuery.isLoading ? (
          <SkeletonRows count={3} />
        ) : myRequests.length === 0 ? (
          <Text style={styles.empty}>No corrections raised yet.</Text>
        ) : (
          myRequests.map((r: Regularisation, i: number) => (
            <View
              key={r.id}
              style={[styles.reqRow, i === myRequests.length - 1 && styles.reqRowLast]}
            >
              <View style={styles.reqMain}>
                <Text style={styles.reqDate}>{fmtDate(r.markDate)}</Text>
                <Text style={styles.reqReason} numberOfLines={2}>
                  {r.reason}
                </Text>
                {r.decisionNote ? <Text style={styles.reqNote}>“{r.decisionNote}”</Text> : null}
              </View>
              <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
            </View>
          ))
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },

  banner: { borderRadius: radii.md, padding: 12 },
  bannerSuccess: { backgroundColor: colors.successBg },
  bannerWarning: { backgroundColor: colors.warningBg },
  bannerText: { fontSize: 11.5, fontWeight: '600', color: colors.slate800 },

  formCard: {},
  hoursRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  hoursTile: {
    flex: 1, borderWidth: 1, borderColor: colors.slate200, borderRadius: radii.md,
    paddingVertical: 12, paddingHorizontal: 14,
  },
  hoursValue: { fontSize: 15.5, fontWeight: '800', color: colors.textLight },
  hoursLabel: { fontSize: 10.5, color: colors.slate500, fontWeight: '600', marginTop: 2 },

  fieldLabel: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4,
    color: colors.slate500, marginBottom: 6,
  },
  help: { fontSize: 11, color: colors.slate500, marginBottom: 10, lineHeight: 17 },

  segment: { flexDirection: 'row', backgroundColor: colors.slate100, borderRadius: radii.md, padding: 4, marginBottom: 14 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radii.sm },
  segmentItemActive: { backgroundColor: colors.white },
  segmentText: { fontSize: 11, fontWeight: '700', color: colors.slate500 },
  segmentTextActive: { color: colors.brand[700] },

  stampBox: { backgroundColor: colors.slate50, borderRadius: radii.md, padding: 12, marginBottom: 10 },
  stampBoxTitle: {
    fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4,
    color: colors.slate500, marginBottom: 6,
  },
  stampRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stampCell: { flex: 1 },
  addRow: { alignItems: 'center', paddingTop: 4 },

  submitNote: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.brand[50], borderRadius: radii.sm, padding: 10, marginBottom: 10,
  },
  submitNoteText: { flex: 1, fontSize: 10.5, color: colors.slate600, fontWeight: '600', lineHeight: 16 },

  errorText: { color: colors.danger, fontSize: 11, fontWeight: '600', marginBottom: 8 },

  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  actionHalf: { flex: 1 },

  listCard: {},
  listTitle: {
    fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4,
    color: colors.slate500, marginBottom: 4,
  },
  spacer: { marginVertical: 12 },
  empty: { fontSize: 11.5, color: colors.slate400, paddingVertical: 8 },
  reqRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.slate100,
  },
  reqRowLast: { borderBottomWidth: 0 },
  reqMain: { flex: 1 },
  reqDate: { fontSize: 12, fontWeight: '800', color: colors.textLight },
  reqReason: { fontSize: 11.5, color: colors.slate600, marginTop: 3 },
  reqNote: { fontSize: 11, color: colors.slate500, marginTop: 4, fontStyle: 'italic' },
});
