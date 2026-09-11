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
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { Button } from '../../components/ui';
import { DatePickerField } from '../../components/PickerField';
import { getApiErrorMessage } from '../../api/client';
import { toLocalDateKey } from '../../utils/datetime';
import { useT } from '../../i18n';
import {
  applyForLeave,
  LEAVE_TYPES,
  LEAVE_TYPE_LABEL_KEY,
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
 */

const MAX_SPAN_DAYS = 30;
const MIN_REASON = 10;
const DAY_MS = 864e5;

export function ApplyLeaveSheet({
  visible,
  onClose,
  onApplied,
}: {
  visible: boolean;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [leaveType, setLeaveType] = useState<LeaveType>('paid');
  const [startDate, setStartDate] = useState(toLocalDateKey());
  const [endDate, setEndDate] = useState(toLocalDateKey());
  const [halfDay, setHalfDay] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const colors = useThemeStore((s) => s.colors);
  const t = useT();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // A fresh sheet every time. Reopening it with somebody's last rejected
  // reason still in the box is how a wrong request gets sent twice.
  useEffect(() => {
    if (!visible) return;
    setLeaveType('paid');
    setStartDate(toLocalDateKey());
    setEndDate(toLocalDateKey());
    setHalfDay(false);
    setReason('');
    setError(null);
  }, [visible]);

  // Keeping the end on or after the start, rather than letting somebody build
  // an invalid range and refusing it on submit.
  useEffect(() => {
    if (endDate < startDate) setEndDate(startDate);
  }, [startDate, endDate]);

  const singleDay = startDate === endDate;
  useEffect(() => {
    if (!singleDay && halfDay) setHalfDay(false);
  }, [singleDay, halfDay]);

  const days = useMemo(() => {
    if (halfDay) return 0.5;
    return Math.round((Date.parse(endDate) - Date.parse(startDate)) / DAY_MS) + 1;
  }, [startDate, endDate, halfDay]);

  const submit = useMutation({
    mutationFn: () =>
      applyForLeave({
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        half_day: halfDay,
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
  const problem =
    reason.trim().length < MIN_REASON
      ? `Add a reason (at least ${MIN_REASON} characters).`
      : days > MAX_SPAN_DAYS
        ? `That is ${days} days — apply for up to ${MAX_SPAN_DAYS} at a time.`
        : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>{t('apply.type')}</Text>
            <View style={styles.types}>
              {LEAVE_TYPES.map((kind) => {
                const on = leaveType === kind;
                return (
                  <Pressable
                    key={kind}
                    onPress={() => setLeaveType(kind)}
                    style={({ pressed }) => [styles.type, on && styles.typeOn, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.typeText, on && styles.typeTextOn]}>{t(LEAVE_TYPE_LABEL_KEY[kind])}</Text>
                  </Pressable>
                );
              })}
            </View>

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

            {singleDay && (
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

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t('common.total')}</Text>
              <Text style={styles.totalValue}>
                {t('apply.days', { count: days })}
              </Text>
            </View>

            <Text style={styles.label}>{t('apply.reason')}</Text>
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
    typeText: { fontSize: 11.5, fontWeight: '800', color: colors.slate600 },
    typeTextOn: { color: colors.brand[700] },
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
