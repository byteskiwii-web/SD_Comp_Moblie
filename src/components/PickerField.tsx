import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Icon, IconName } from './Icon';
import { colors, radii } from '../theme/tokens';

// Android only, by design -- DateTimePickerAndroid.open() is an
// Android-specific imperative API (the library's iOS equivalent is a
// declarative inline component with a different interaction model
// entirely). This app currently ships Android only; an iOS pass would add
// a platform branch here rather than change these two exports' contracts.

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// "YYYY-MM-DD" <-> a local Date, built from local y/m/d components (never
// through toISOString(), which would convert to UTC and can shift the
// calendar day) -- same convention RegularisePanel's own combineDateTime
// already uses for the corrected clock-in/out times.
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
function formatDateDisplay(key: string): string {
  return parseDateKey(key).toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// "HH:MM" <-> a Date carrying just that wall-clock time (today's date part
// is irrelevant and discarded by callers -- RegularisePanel re-combines the
// HH:MM with its own selected mark_date before submitting).
function parseTimeKey(key: string): Date {
  const [h, m] = key.split(':').map(Number);
  const date = new Date();
  date.setHours(h || 0, m || 0, 0, 0);
  return date;
}
function formatTimeKey(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function formatTimeDisplay(key: string): string {
  // Same toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) pattern
  // already used everywhere else times are shown (ClockPanel, HomeScreen) --
  // 12- vs 24-hour follows the device's own locale setting either way, so
  // this reads exactly as it would if it appeared anywhere else in the app.
  return parseTimeKey(key).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.input, error ? styles.inputError : null, pressed && styles.inputPressed]}
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

type DatePickerFieldProps = {
  label: string;
  value: string; // "YYYY-MM-DD"
  onChange: (value: string) => void;
  maximumDate?: Date;
  minimumDate?: Date;
  error?: string;
};

// Tap -> Android's native Material calendar dialog -> selected date. Kept as
// a plain "YYYY-MM-DD" string in and out, so RegularisePanel's existing
// state, validation and submit payload need no changes -- this is purely a
// friendlier way to produce the same value a typed date always was.
export function DatePickerField({ label, value, onChange, maximumDate, minimumDate, error }: DatePickerFieldProps) {
  const open = () => {
    DateTimePickerAndroid.open({
      value: value ? parseDateKey(value) : new Date(),
      mode: 'date',
      display: 'calendar',
      maximumDate,
      minimumDate,
      onChange: (event, selected) => {
        if (event.type === 'set' && selected) onChange(formatDateKey(selected));
      },
    });
  };
  return (
    <FieldShell
      label={label}
      error={error}
      placeholder="Select date"
      displayValue={value ? formatDateDisplay(value) : null}
      icon="calendar"
      onPress={open}
    />
  );
}

type TimePickerFieldProps = {
  label: string;
  value: string; // "HH:MM", or '' when unset
  onChange: (value: string) => void;
  error?: string;
};

// Tap -> Android's native clock-face dialog -> selected time. 12- vs
// 24-hour is left to the device's own setting (is24Hour omitted), matching
// how every other time display in this app already defers to locale rather
// than hardcoding a format.
export function TimePickerField({ label, value, onChange, error }: TimePickerFieldProps) {
  const open = () => {
    DateTimePickerAndroid.open({
      value: value ? parseTimeKey(value) : new Date(),
      mode: 'time',
      display: 'clock',
      onChange: (event, selected) => {
        if (event.type === 'set' && selected) onChange(formatTimeKey(selected));
      },
    });
  };
  return (
    <FieldShell
      label={label}
      error={error}
      placeholder="Select time"
      displayValue={value ? formatTimeDisplay(value) : null}
      icon="clock"
      onPress={open}
    />
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputPressed: { backgroundColor: colors.slate50, borderColor: colors.slate300 },
  inputError: { borderColor: colors.danger },
  valueText: { fontSize: 15, fontWeight: '600', color: colors.textLight, flexShrink: 1 },
  placeholderText: { color: colors.slate400, fontWeight: '500' },
  errorText: { color: colors.danger, fontSize: 12, fontWeight: '600', marginTop: 6 },
});
