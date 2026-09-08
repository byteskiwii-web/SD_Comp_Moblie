import React, { useRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { colors, radii } from '../theme/tokens';
import { OTP_LENGTH } from '../constants/config';

// Visible boxes + a single hidden TextInput driving them — ported from the
// prototype's OtpBoxes (mobile_auth.jsx) but adapted for native text input.
type Props = {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
};

export function OtpBoxes({ value, onChange, autoFocus }: Props) {
  const inputRef = useRef<TextInput>(null);
  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] ?? '');

  return (
    <View style={styles.wrap} onTouchEnd={() => inputRef.current?.focus()}>
      {digits.map((d, i) => (
        <View key={i} style={[styles.box, d ? styles.boxFilled : null]}>
          <View style={styles.boxTextWrap}>
            <TextInput
              editable={false}
              value={d || '·'}
              style={[styles.boxText, d ? styles.boxTextFilled : styles.boxTextEmpty]}
            />
          </View>
        </View>
      ))}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, OTP_LENGTH))}
        keyboardType="number-pad"
        maxLength={OTP_LENGTH}
        autoFocus={autoFocus}
        style={styles.hiddenInput}
        // OS-level OTP autofill -- no native module or SMS permission needed.
        // Android offers a one-tap "Allow" suggestion via the SMS User Consent
        // API when it spots an OTP-shaped incoming message; iOS shows the
        // code directly above the keyboard from Messages. Neither requires
        // the SMS text to match any particular format on our side.
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  box: {
    width: 40,
    height: 48,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.slate200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: { borderColor: colors.brand[500], backgroundColor: colors.brand[50] },
  boxTextWrap: { pointerEvents: 'none' },
  boxText: { fontSize: 15.5, fontWeight: '700', textAlign: 'center', padding: 0 },
  boxTextEmpty: { color: colors.slate300 },
  boxTextFilled: { color: colors.brand[800] },
  hiddenInput: { position: 'absolute', opacity: 0, height: 48, width: '100%' },
});
