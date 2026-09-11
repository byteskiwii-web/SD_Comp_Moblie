import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { ColorScheme, radii } from '../theme/tokens';
import { useThemeStore } from '../stores/themeStore';
import { Icon, IconName } from './Icon';

type ButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'danger';
};

export function Button({ title, onPress, disabled, loading, variant = 'primary' }: ButtonProps) {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isOutline = variant === 'outline';
  const isDanger = variant === 'danger';
  const spinnerColor = isDanger ? colors.danger : isOutline ? colors.brand[700] : colors.white;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        isDanger ? styles.buttonDanger : isOutline ? styles.buttonOutline : styles.buttonPrimary,
        (disabled || loading) && styles.buttonDisabled,
        pressed && !disabled && !loading && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            isDanger ? styles.buttonTextDanger : isOutline ? styles.buttonTextOutline : styles.buttonTextPrimary,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function TextField(props: TextInputProps & { label: string; error?: string }) {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { label, error, style, secureTextEntry, ...rest } = props;
  // Only a password field ever gets the reveal toggle -- anything else
  // passing secureTextEntry (there isn't one today) would be an odd fit for
  // an eye icon, so the affordance is tied to the prop itself rather than a
  // separate flag callers would have to remember to also pass.
  const [revealed, setRevealed] = useState(false);
  const isPassword = secureTextEntry === true;

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          placeholderTextColor={colors.slate400}
          style={[
            styles.input,
            isPassword && styles.inputWithToggle,
            error ? styles.inputError : null,
            style,
          ]}
          secureTextEntry={isPassword && !revealed}
          {...rest}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            hitSlop={10}
            style={styles.toggleBtn}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
          >
            <Ionicons
              name={revealed ? 'eye-off-outline' : 'eye-outline'}
              size={19}
              color={colors.slate400}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={[styles.card, style]}>{children}</View>;
}

// Deterministic hue from a stable identifier, so the same employee always
// gets the same gradient. employeeId is preferred over name (immutable and
// unique, unlike a name which can be corrected or shared) -- mirrors the
// reference prototype's per-employee avatarHue idea without a stored column.
function hueFrom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  }
  return hash < 0 ? hash + 360 : hash;
}

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function Avatar({ name, employeeId, size = 56 }: { name: string; employeeId?: string; size?: number }) {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const hue = hueFrom(employeeId || name || '?');
  const gradientId = `avatarGradient-${hue}`;
  // A touch deeper in dark mode -- the same lightness/saturation that reads
  // as a rich accent against a white card reads as pastel-washed-out against
  // a near-black one.
  const [l1, l2] = colors.scheme === 'dark' ? [45, 34] : [50, 40];
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={`hsl(${hue},65%,${l1}%)`} />
            <Stop offset="1" stopColor={`hsl(${(hue + 30) % 360},60%,${l2}%)`} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${gradientId})`} />
      </Svg>
      <Text
        style={[
          styles.avatarInitials,
          { width: size, height: size, lineHeight: size, fontSize: size * 0.36 },
        ]}
      >
        {initialsOf(name)}
      </Text>
    </View>
  );
}

type BadgeTone = 'slate' | 'brand' | 'success' | 'warning' | 'danger';

function badgeTone(colors: ColorScheme): Record<BadgeTone, { bg: string; fg: string }> {
  return {
    slate: { bg: colors.slate100, fg: colors.slate600 },
    brand: { bg: colors.brand[50], fg: colors.brand[700] },
    success: { bg: colors.successBg, fg: colors.successText },
    warning: { bg: colors.warningBg, fg: colors.warningText },
    danger: { bg: colors.dangerBg, fg: colors.dangerText },
  };
}

export function Badge({ tone = 'slate', children }: { tone?: BadgeTone; children: React.ReactNode }) {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useMemo(() => badgeTone(colors)[tone], [colors, tone]);
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.badgeText, { color: t.fg }]}>{children}</Text>
    </View>
  );
}

export function InfoRow({
  icon,
  label,
  value,
  last,
}: {
  icon?: IconName;
  label: string;
  value: string;
  last?: boolean;
}) {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      {icon ? <Icon name={icon} size={16} color={colors.slate400} /> : null}
      <View style={styles.infoRowText}>
        <Text style={styles.infoRowLabel}>{label}</Text>
        <Text style={styles.infoRowValue}>{value}</Text>
      </View>
    </View>
  );
}

function makeStyles(colors: ColorScheme) {
  const cardShadow = colors.scheme === 'dark'
    ? { shadowOpacity: 0, elevation: 0, borderWidth: 1, borderColor: colors.slate200 }
    : { shadowOpacity: 0.06, elevation: 2, borderWidth: 0 };

  return StyleSheet.create({
  button: {
    height: 50,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    // Explicit rather than left to the parent's default cross-axis stretch:
    // Button is routinely one Pressable inside an unstyled wrapper (TourTarget,
    // a plain row View) two or more levels below whatever actually declares a
    // width. Each of those levels resolves the percentage fine on its own, but
    // on Android the chain was visibly full width while only the text in the
    // middle registered a tap -- the painted box and the responder's hit rect
    // had come from different layout passes. Stating the width on the
    // Pressable itself, instead of counting on it to inherit correctly through
    // several ancestors, makes the two the same measurement.
    alignSelf: 'stretch',
    width: '100%',
  },
  buttonPrimary: {
    backgroundColor: colors.brand[700],
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: colors.scheme === 'dark' ? 0 : 0.2,
    shadowRadius: 6,
    elevation: colors.scheme === 'dark' ? 0 : 3,
  },
  buttonOutline: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.slate200 },
  buttonDanger: { backgroundColor: colors.dangerBg, borderWidth: 1.5, borderColor: colors.danger + '59' },
  buttonDisabled: { opacity: 0.45, shadowOpacity: 0 },
  buttonPressed: { opacity: 0.85 },
  buttonText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.1 },
  buttonTextPrimary: { color: colors.white },
  buttonTextOutline: { color: colors.slate700 },
  buttonTextDanger: { color: colors.dangerText },

  fieldWrap: { marginBottom: 14 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: colors.slate500,
    marginBottom: 6,
  },
  inputRow: { position: 'relative', justifyContent: 'center' },
  input: {
    height: 50,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.slate200,
    paddingHorizontal: 14,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textLight,
    backgroundColor: colors.surface,
  },
  inputWithToggle: { paddingRight: 44 },
  toggleBtn: {
    position: 'absolute', right: 4, height: 50, width: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  inputError: { borderColor: colors.danger },
  errorText: { color: colors.dangerText, fontSize: 11, fontWeight: '600', marginTop: 6 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 16,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    ...cardShadow,
  },

  avatarInitials: {
    position: 'absolute',
    top: 0,
    left: 0,
    textAlign: 'center',
    color: colors.white,
    fontWeight: '800',
  },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoRowText: { flex: 1, minWidth: 0 },
  infoRowLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: colors.slate500,
  },
  infoRowValue: { fontSize: 11, fontWeight: '700', color: colors.textLight, marginTop: 2 },
  });
}
