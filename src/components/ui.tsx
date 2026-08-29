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
import { colors, radii } from '../theme/tokens';

type ButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'outline';
};

export function Button({ title, onPress, disabled, loading, variant = 'primary' }: ButtonProps) {
  const isOutline = variant === 'outline';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        isOutline ? styles.buttonOutline : styles.buttonPrimary,
        (disabled || loading) && styles.buttonDisabled,
        pressed && !disabled && !loading && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? colors.brand[700] : colors.white} />
      ) : (
        <Text style={[styles.buttonText, isOutline ? styles.buttonTextOutline : styles.buttonTextPrimary]}>
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

const styles = StyleSheet.create({
  button: {
    height: 50,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
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
  buttonDisabled: { opacity: 0.45, shadowOpacity: 0 },
  buttonPressed: { opacity: 0.85 },
  buttonText: { fontSize: 15, fontWeight: '700', letterSpacing: 0.1 },
  buttonTextPrimary: { color: colors.white },
  buttonTextOutline: { color: colors.slate700 },

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
    fontSize: 15,
    fontWeight: '600',
    color: colors.textLight,
    backgroundColor: colors.white,
  },
  inputError: { borderColor: colors.danger },
  errorText: { color: colors.danger, fontSize: 12, fontWeight: '600', marginTop: 6 },

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
});
