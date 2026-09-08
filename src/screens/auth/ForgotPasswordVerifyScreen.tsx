import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { AuthStackParamList } from '../../navigation/types';
import { Button } from '../../components/ui';
import { OtpBoxes } from '../../components/OtpBoxes';
import { colors } from '../../theme/tokens';
import { OTP_LENGTH } from '../../constants/config';
import { verifyPasswordResetOtp } from '../../api/auth.api';
import { getApiErrorMessage } from '../../api/client';
import { forgotPasswordVerifySchema } from '../../schemas/auth.schema';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPasswordVerify'>;

export function ForgotPasswordVerifyScreen({ navigation, route }: Props) {
  const { employeeId, maskedEmail } = route.params;
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => verifyPasswordResetOtp(employeeId, otp),
    onSuccess: (data) => {
      navigation.navigate('ResetPassword', { resetToken: data.resetToken });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const submit = () => {
    setError('');
    const parsed = forgotPasswordVerifySchema.safeParse({ employee_id: employeeId, otp });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? `Enter the ${OTP_LENGTH}-digit code.`);
      return;
    }
    mutation.mutate();
  };

  return (
    <SafeAreaView style={styles.flex}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>
          We sent a {OTP_LENGTH}-digit code to <Text style={styles.bold}>{maskedEmail}</Text>
        </Text>

        <View style={styles.otpWrap}>
          <OtpBoxes value={otp} onChange={(v) => { setOtp(v); setError(''); }} autoFocus />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.buttonGap}>
          <Button title="Verify" onPress={submit} loading={mutation.isPending} />
        </View>
        <Button title="Change employee ID" variant="outline" onPress={() => navigation.goBack()} />
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 17.5, fontWeight: '800', color: colors.textLight, textAlign: 'center' },
  subtitle: { fontSize: 11, color: colors.slate500, textAlign: 'center', marginTop: 8, marginBottom: 24, lineHeight: 18 },
  bold: { fontWeight: '700', color: colors.slate700 },
  otpWrap: { marginBottom: 20 },
  errorText: { color: colors.danger, fontSize: 11, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  buttonGap: { marginBottom: 12 },
});
