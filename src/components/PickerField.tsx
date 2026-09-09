import React, { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Icon, IconName } from './Icon';
import { ColorScheme, radii } from '../theme/tokens';
import { useThemeStore } from '../stores/themeStore';

// Two platforms, two interaction models, one contract.
//
// Android gets DateTimePickerAndroid.open() — an imperative call that raises
// the OS dialog. That call is a NO-OP on iOS: it neither opens anything nor
// throws, so the field simply did nothing when tapped, which is what shipped
// once this app started running on iOS as well.
//
// iOS gets the library's declarative component instead, in a sheet with an
// explicit Done, because the inline picker has no dismissal of its own. Both
// exports keep taking and returning the same "YYYY-MM-DD" / "HH:MM" strings,
// so callers need no platform knowledge.

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// "YYYY-MM-DD" <-> a local Date, built from local y/m/d components (never
// through toISOString(), which would convert to UTC and can shift the
// calendar day).
function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date();
  date.setFullYear(y || date.getFullYear(), (m || 1) - 1, d || 1);
  date.setHours(0, 0, 0, 0);
  return date;
}
function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDateDisplay(key: string): string {
  const d = parseDateKey(key);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// "HH:MM" <-> a Date carrying just that wall-clock time.
function parseTimeKey(key: string): Date {
  const [h, m] = key.split(':').map(Number);
  const date = new Date();
  date.setHours(h || 0, m || 0, 0, 0);
  return date;
}
function formatTimeKey(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
// Computed rather than via toLocaleTimeString, which on Hermes reported
// noon-hour times as AM — see utils/datetime.ts for the full account.
function formatTimeDisplay(key: string): string {
  const d = parseTimeKey(key);
  const h = d.getHours();
  const period = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${pad(d.getMinutes())} ${period}`;
}

function FieldShell({
  label,
  error,
  placeholder,
  displayValue,
  icon,
  onPress,
}: {
  label: string;
  error?: string;
  placeholder: string;
  displayValue: string | null;
  icon: IconName;
  onPress: () => void;
}) {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.input, error ? styles.inputError : null, pressed && styles.inputPressed]}
        accessibilityRole="button"
      >
        <Text style={[styles.valueText, !displayValue && styles.placeholderText]} numberOfLines={1}>
          {displayValue ?? placeholder}
        </Text>
        <Icon name={icon} size={16} color={colors.slate400} />
      </Pressable>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

/**
 * The iOS half: a sheet holding the declarative picker.
 *
 * The value is held locally while spinning and only handed back on Done, so a
 * cancelled spin leaves the field exactly as it was rather than committing
 * whatever happened to be under the wheel.
 */
function IosPickerSheet({
  visible,
  initial,
  mode,
  maximumDate,
  minimumDate,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  initial: Date;
  mode: 'date' | 'time';
  maximumDate?: Date;
  minimumDate?: Date;
  onCancel: () => void;
  onConfirm: (d: Date) => void;
}) {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [draft, setDraft] = useState(initial);

  // Remount on each open so the wheel starts from the current field value.
  React.useEffect(() => {
    if (visible) setDraft(initial);
  }, [visible, initial]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <View style={styles.sheet}>
        <View style={styles.sheetBar}>
          <Pressable onPress={onCancel} hitSlop={8}>
            <Text style={styles.sheetCancel}>Cancel</Text>
          </Pressable>
          <Pressable onPress={() => onConfirm(draft)} hitSlop={8}>
            <Text style={styles.sheetDone}>Done</Text>
          </Pressable>
        </View>
        <DateTimePicker
          value={draft}
          mode={mode}
          display="spinner"
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          onChange={(_e, picked) => picked && setDraft(picked)}
        />
      </View>
    </Modal>
  );
}

type DatePickerFieldProps = {
  label: string;
  value: string; // "YYYY-MM-DD"
  onChange: (value: string) => void;
  maximumDate?: Date;
  minimumDate?: Date;
  error?: string;
};

export function DatePickerField({ label, value, onChange, maximumDate, minimumDate, error }: DatePickerFieldProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const current = value ? parseDateKey(value) : new Date();

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        display: 'calendar',
        maximumDate,
        minimumDate,
        onChange: (event, selected) => {
          if (event.type === 'set' && selected) onChange(formatDateKey(selected));
        },
      });
      return;
    }
    setSheetOpen(true);
  };

  return (
    <>
      <FieldShell
        label={label}
        error={error}
        placeholder="Select date"
        displayValue={value ? formatDateDisplay(value) : null}
        icon="calendar"
        onPress={open}
      />
      {Platform.OS !== 'android' && (
        <IosPickerSheet
          visible={sheetOpen}
          initial={current}
          mode="date"
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          onCancel={() => setSheetOpen(false)}
          onConfirm={(d) => {
            setSheetOpen(false);
            onChange(formatDateKey(d));
          }}
        />
      )}
    </>
  );
}

type TimePickerFieldProps = {
  label: string;
  value: string; // "HH:MM", or '' when unset
  onChange: (value: string) => void;
  error?: string;
};

export function TimePickerField({ label, value, onChange, error }: TimePickerFieldProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const current = value ? parseTimeKey(value) : new Date();

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'time',
        display: 'clock',
        onChange: (event, selected) => {
          if (event.type === 'set' && selected) onChange(formatTimeKey(selected));
        },
      });
      return;
    }
    setSheetOpen(true);
  };

  return (
    <>
      <FieldShell
        label={label}
        error={error}
        placeholder="Select time"
        displayValue={value ? formatTimeDisplay(value) : null}
        icon="clock"
        onPress={open}
      />
      {Platform.OS !== 'android' && (
        <IosPickerSheet
          visible={sheetOpen}
          initial={current}
          mode="time"
          onCancel={() => setSheetOpen(false)}
          onConfirm={(d) => {
            setSheetOpen(false);
            onChange(formatTimeKey(d));
          }}
        />
      )}
    </>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
  fieldWrap: { marginBottom: 14 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: colors.slate500,
    marginBottom: 6,
  },
  input: {
    height: 50,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.slate200,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputPressed: { backgroundColor: colors.slate50, borderColor: colors.slate300 },
  inputError: { borderColor: colors.danger },
  valueText: { fontSize: 13, fontWeight: '600', color: colors.textLight, flexShrink: 1 },
  placeholderText: { color: colors.slate400, fontWeight: '500' },
  errorText: { color: colors.dangerText, fontSize: 11, fontWeight: '600', marginTop: 6 },

  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.35)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingBottom: 24,
  },
  sheetBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  sheetCancel: { fontSize: 13, fontWeight: '600', color: colors.slate500 },
  sheetDone: { fontSize: 13, fontWeight: '800', color: colors.brand[700] },
  });
}
