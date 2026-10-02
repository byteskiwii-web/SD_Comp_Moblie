import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { Button } from '../../components/ui';
import { DatePickerField } from '../../components/PickerField';
import { getApiErrorMessage } from '../../api/client';
import { formatDate, toLocalDateKey } from '../../utils/datetime';
import { useT } from '../../i18n';
import { nationalHolidaysIn, useNationalHolidays } from '../../hooks/useNationalHolidays';
import {
  applyForLeave,
  LEAVE_TYPES,
  LEAVE_TYPE_HINT_KEY,
  LEAVE_TYPE_LABEL_KEY,
  WEEK_OFF_DAYS,
  type LeaveType,
} from '../../api/leave.api';

/**
 * The leave form.
 *
 * Short on purpose: type, dates, reason. Everything else the server needs it
 * already knows — who is applying, and which store they belong to.
 *
 * The half-day toggle only appears once the dates are a single day, because
 * "half of which day?" has no answer over a range and the server refuses it.
 * Hiding an option that cannot apply beats showing one that produces an error
 * after the fact.
 *
 * Two types carry their own rules, stated on the form rather than learned
 * from a refusal:
 *
 *   Comp off   spends what has been earned. The chip shows how much is left
 *              and is off when there is none; asking for more is caught here.
 *   Week off   one full weekday. Saturday and Sunday are working days at the
 *              stores, so a weekend is flagged before sending. One date, no
 *              half day, and no reason needed -- it is the weekly off, not an
 *              absence to explain. The one-per-week rule is the server's.
 */

/** Mirrors LEAVE_MAX_SPAN_DAYS. */
const MAX_SPAN_DAYS = 30;
/** Mirrors LEAVE_REASON_MIN_LENGTH: the team asked for no practical minimum. */
const MIN_REASON = 1;
const DAY_MS = 864e5;

const isoWeekday = (dateKey: string) => {
  const d = new Date(`${dateKey}T00:00:00`).getDay();
  return d === 0 ? 7 : d;
};

export function ApplyLeaveSheet({
  visible,
  onClose,
  onApplied,
  compOffAvailable = 0,
  initialType = 'paid',
}: {
  visible: boolean;
  onClose: () => void;
  onApplied: () => void;
  /** Comp off days left to take (LeaveSummary.compOffOutstanding). */
  compOffAvailable?: number;
  /** The type the form opens on -- Comp off when opened from the comp-off card. */
  initialType?: LeaveType;
}) {
  const { upcoming: nationalHolidays } = useNationalHolidays();
  const [leaveType, setLeaveType] = useState<LeaveType>('paid');
  const [startDate, setStartDate] = useState(toLocalDateKey());
  const [endDate, setEndDate] = useState(toLocalDateKey());
  const [halfDay, setHalfDay] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const colors = useThemeStore((s) => s.colors);
  const t = useT();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // Send is the last thing in the scroll body, and the Modal draws under the
  // navigation bar edge-to-edge -- the body's end has to clear it.
  const insets = useSafeAreaInsets();

  const isWeekOff = leaveType === 'week-off';
  const isCompOff = leaveType === 'comp-off';

  // A fresh sheet every time. Reopening it with somebody's last rejected
  // reason still in the box is how a wrong request gets sent twice.
  useEffect(() => {
    if (!visible) return;
    setLeaveType(initialType);
    setStartDate(toLocalDateKey());
    setEndDate(toLocalDateKey());
    setHalfDay(false);
    setReason('');
    setError(null);
  }, [visible, initialType]);

  // Keeping the end on or after the start, rather than letting somebody build
  // an invalid range and refusing it on submit. A week off is one date, so its
  // end simply follows the start.
  useEffect(() => {
    if (isWeekOff ? endDate !== startDate : endDate < startDate) setEndDate(startDate);
  }, [startDate, endDate, isWeekOff]);

  const singleDay = startDate === endDate;
  useEffect(() => {
    if ((!singleDay || isWeekOff) && halfDay) setHalfDay(false);
  }, [singleDay, halfDay, isWeekOff]);

  // A stale server message about the previous type is not about this one.
  useEffect(() => setError(null), [leaveType]);

  const days = useMemo(() => {
    if (halfDay) return 0.5;
    return Math.round((Date.parse(endDate) - Date.parse(startDate)) / DAY_MS) + 1;
  }, [startDate, endDate, halfDay]);

  /* National holidays inside the chosen dates. Nobody needs leave for one --
     and working it is what earns a comp off -- so it is said on the form,
     before somebody spends a paid day on a day they did not need to. */
  const holidaysInRange = useMemo(
    () => nationalHolidaysIn(nationalHolidays, startDate, isWeekOff ? startDate : endDate),
    [nationalHolidays, startDate, endDate, isWeekOff]
  );
  const dayLabel = (date: string) => formatDate(`${String(date).slice(0, 10)}T00:00:00`);

  const submit = useMutation({
    mutationFn: () =>
      applyForLeave({
        leave_type: leaveType,
        start_date: startDate,
        end_date: isWeekOff ? startDate : endDate,
        half_day: isWeekOff ? false : halfDay,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      setError(null);
      onApplied();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  // Checked here as well as on the server so the button can say why it is off,
  // instead of the form bouncing back with a message after a round trip.
  const problem = isWeekOff
    ? !WEEK_OFF_DAYS.includes(isoWeekday(startDate))
      ? t('apply.weekOffWeekday')
      : null
    : isCompOff && compOffAvailable <= 0
      ? t('apply.compOffNone')
      : isCompOff && days > compOffAvailable
        ? t('apply.compOffLeft', { count: compOffAvailable })
        : reason.trim().length < MIN_REASON
          ? t('apply.reasonNeeded')
          : days > MAX_SPAN_DAYS
            ? t('apply.tooLong', { days, max: MAX_SPAN_DAYS })
            : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.lift}
        pointerEvents="box-none"
      >
        <View style={styles.sheet}>
          <View style={styles.bar}>
            <Text style={styles.title}>{t('apply.title')}</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.close')}>
              <Ionicons name="close" size={22} color={colors.slate500} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={[styles.body, { paddingBottom: Math.max(32, insets.bottom + 12) }]}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.label}>{t('apply.type')}</Text>
            <View style={styles.types}>
              {LEAVE_TYPES.map((kind) => {
                const on = leaveType === kind;
                // Comp off with nothing earned is shown, not hidden: the empty
                // chip is how somebody learns the option exists and why it is off.
                const empty = kind === 'comp-off' && compOffAvailable <= 0;
                return (
                  <Pressable
                    key={kind}
                    onPress={() => setLeaveType(kind)}
                    style={({ pressed }) => [
                      styles.type, on && styles.typeOn, empty && !on && styles.typeEmpty, pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.typeText, on && styles.typeTextOn, empty && !on && styles.typeTextEmpty]}>
                      {t(LEAVE_TYPE_LABEL_KEY[kind])}
                      {kind === 'comp-off' ? ` · ${compOffAvailable}` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.typeHint}>{t(LEAVE_TYPE_HINT_KEY[leaveType])}</Text>

            {/* How to earn comp off, where the question comes up: choosing it.
                Most useful when the balance is 0 -- the next national holiday
                is the next chance to get one. */}
            {isCompOff ? (
              <View style={styles.earnBox}>
                <Text style={styles.earnTitle}>{t('compOff.howTitle')}</Text>
                <Text style={styles.earnLine}>• {t('compOff.howHoliday')}</Text>
                <Text style={styles.earnLine}>• {t('compOff.howUnpaid')}</Text>
                {nationalHolidays.length > 0 ? (
                  <>
                    <Text style={[styles.earnTitle, styles.earnTitleGap]}>{t('compOff.nextHolidays')}</Text>
                    {nationalHolidays.slice(0, 3).map((h) => (
                      <Text key={h.id} style={styles.earnLine}>
                        <Text style={styles.earnDate}>{dayLabel(h.date)}</Text>  {h.name}
                      </Text>
                    ))}
                  </>
                ) : null}
              </View>
            ) : null}

            {isWeekOff ? (
              <DatePickerField label={t('apply.date')} value={startDate} onChange={setStartDate} />
            ) : (
              <View style={styles.dates}>
                <View style={styles.dateCol}>
                  <DatePickerField label={t('apply.from')} value={startDate} onChange={setStartDate} />
                </View>
                <View style={styles.dateCol}>
                  <DatePickerField
                    label={t('apply.to')}
                    value={endDate}
                    onChange={setEndDate}
                    minimumDate={new Date(`${startDate}T00:00:00`)}
                  />
                </View>
              </View>
            )}

            {singleDay && !isWeekOff && (
              <Pressable
                onPress={() => setHalfDay((v) => !v)}
                style={styles.halfRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: halfDay }}
              >
                <Ionicons
                  name={halfDay ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={halfDay ? colors.brand[700] : colors.slate400}
                />
                <Text style={styles.halfText}>{t('apply.halfDay')}</Text>
              </Pressable>
            )}

            {holidaysInRange.map((h) => (
              <View key={h.id} style={styles.holidayNote}>
                <Ionicons name="flag" size={14} color={colors.brand[700]} style={styles.holidayNoteIcon} />
                <Text style={styles.holidayNoteText}>
                  {t('compOff.holidayInRange', { date: dayLabel(h.date), name: h.name })}
                </Text>
              </View>
            ))}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t('common.total')}</Text>
              <Text style={styles.totalValue}>
                {t('apply.days', { count: isWeekOff ? 1 : days })}
              </Text>
            </View>

            <Text style={styles.label}>{isWeekOff ? t('apply.reasonOptional') : t('apply.reason')}</Text>
            <TextInput
              style={styles.input}
              value={reason}
              onChangeText={setReason}
              placeholder={t('apply.reasonHint')}
              placeholderTextColor={colors.slate400}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {!error && problem ? <Text style={styles.hint}>{problem}</Text> : null}

            <View style={styles.actions}>
              <Button
                title={t('apply.send')}
                onPress={() => submit.mutate()}
                disabled={!!problem}
                loading={submit.isPending}
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    backdrop: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15,23,42,0.35)',
    },
    lift: { flex: 1, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
      maxHeight: '88%',
    },
    bar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: colors.slate100,
    },
    title: { fontSize: 14, fontWeight: '800', color: colors.textLight, letterSpacing: -0.2 },

    body: { padding: 20, paddingBottom: 32, gap: 10 },
    label: {
      fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3,
      color: colors.slate400, marginTop: 4,
    },

    types: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    type: {
      paddingHorizontal: 14, paddingVertical: 9, borderRadius: radii.sm,
      borderWidth: 1.5, borderColor: colors.slate200, backgroundColor: colors.surface,
    },
    typeOn: { borderColor: colors.brand[700], backgroundColor: colors.brand[50] },
    typeEmpty: { borderStyle: 'dashed' },
    typeText: { fontSize: 11.5, fontWeight: '800', color: colors.slate600 },
    typeTextOn: { color: colors.brand[700] },
    typeTextEmpty: { color: colors.slate400 },
    typeHint: { fontSize: 11.5, lineHeight: 16, color: colors.slate500, fontWeight: '600' },
    earnBox: { backgroundColor: colors.successBg, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10 },
    earnTitle: { fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3, color: colors.successText, marginBottom: 4 },
    earnTitleGap: { marginTop: 8 },
    earnLine: { fontSize: 12, lineHeight: 18, color: colors.slate600 },
    earnDate: { fontWeight: '800', color: colors.textLight },
    holidayNote: {
      flexDirection: 'row', gap: 8, alignItems: 'flex-start',
      backgroundColor: colors.brand[50], borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 9,
    },
    holidayNoteIcon: { marginTop: 2 },
    holidayNoteText: { flex: 1, fontSize: 12, lineHeight: 17, color: colors.slate600, fontWeight: '600' },
    pressed: { opacity: 0.75 },

    dates: { flexDirection: 'row', gap: 12, marginTop: 4 },
    dateCol: { flex: 1 },

    halfRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 4 },
    halfText: { fontSize: 12, fontWeight: '700', color: colors.slate600 },

    totalRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: colors.slate50, borderRadius: radii.md,
      paddingHorizontal: 14, paddingVertical: 11,
    },
    totalLabel: { fontSize: 11, fontWeight: '700', color: colors.slate500 },
    totalValue: { fontSize: 13, fontWeight: '800', color: colors.textLight },

    input: {
      borderWidth: 1, borderColor: colors.slate200, borderRadius: radii.md,
      paddingHorizontal: 14, paddingVertical: 12, minHeight: 86,
      fontSize: 12.5, color: colors.textLight, backgroundColor: colors.surface,
    },

    error: { color: colors.dangerText, fontSize: 11.5, fontWeight: '600' },
    hint: { color: colors.slate400, fontSize: 11, fontWeight: '600' },
    actions: { marginTop: 6 },
  });
}
