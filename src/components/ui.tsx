import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors, radii } from '../theme/tokens';
import { Icon, IconName } from './Icon';

type ButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'danger';
};

export function Button({ title, onPress, disabled, loading, variant = 'primary' }: ButtonProps) {
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
  const { label, error, style, ...rest } = props;
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.slate400}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
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
  const hue = hueFrom(employeeId || name || '?');
  const gradientId = `avatarGradient-${hue}`;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={`hsl(${hue},65%,50%)`} />
            <Stop offset="1" stopColor={`hsl(${(hue + 30) % 360},60%,40%)`} />
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

const BADGE_TONE: Record<BadgeTone, { bg: string; fg: string }> = {
  slate: { bg: colors.slate100, fg: colors.slate600 },
  brand: { bg: colors.brand[50], fg: colors.brand[700] },
  success: { bg: colors.successBg, fg: colors.success },
  warning: { bg: colors.warningBg, fg: colors.warning },
  danger: { bg: colors.dangerBg, fg: colors.danger },
};

export function Badge({ tone = 'slate', children }: { tone?: BadgeTone; children: React.ReactNode }) {
  const t = BADGE_TONE[tone];
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

const styles = StyleSheet.create({
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
    shadowColor: colors.brand[900],
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonOutline: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.slate200 },
  buttonDanger: { backgroundColor: colors.dangerBg, borderWidth: 1.5, borderColor: 'rgba(244,63,94,0.35)' },
  buttonDisabled: { opacity: 0.45, shadowOpacity: 0 },
  buttonPressed: { opacity: 0.85 },
  buttonText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.1 },
  buttonTextPrimary: { color: colors.white },
  buttonTextOutline: { color: colors.slate700 },
  buttonTextDanger: { color: colors.danger },

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
    fontSize: 13,
    fontWeight: '600',
    color: colors.textLight,
    backgroundColor: colors.white,
  },
  inputError: { borderColor: colors.danger },
  errorText: { color: colors.danger, fontSize: 11, fontWeight: '600', marginTop: 6 },

  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: 16,
    shadowColor: colors.slate900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
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
