import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui';
import { OtpBoxes } from '../../components/OtpBoxes';
import { ColorScheme } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { OTP_LENGTH } from '../../constants/config';
import { useAuthStore } from '../../stores/authStore';
import { verifyAadhaarOtp } from '../../api/verification.api';
import { getApiErrorMessage } from '../../api/client';
import { kycGateQueryKey } from '../../hooks/useKycGate';
import { aadhaarOtpVerifySchema } from '../../schemas/kyc.schema';
import { KycStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<KycStackParamList, 'AadhaarOtpVerify'>;

export function AadhaarOtpVerifyScreen({ navigation, route }: Props) {
  const { referenceId } = route.params;
  const employee = useAuthStore((s) => s.employee);
  const queryClient = useQueryClient();
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const mutation = useMutation({
    mutationFn: () => verifyAadhaarOtp({ reference_id: referenceId, otp }),
    onSuccess: (result) => {
      if (result.verified) {
        queryClient.invalidateQueries({ queryKey: kycGateQueryKey(employee?.id) });
        setSuccess('Aadhaar verified');
        // No manual navigation needed -- RootNavigator re-renders on its own
        // once the gate query reflects the new status (to KycGateScreen if
        // only Aadhaar was outstanding, or straight to AppTabs if both
        // checks are now done).
      } else if (result.pending) {
        // Provider asks to retry the same reference shortly -- no new OTP
        // needed, so the filled boxes are left as-is for resubmission.
        setError('Still processing — try again in a moment.');
      } else {
        setError(result.message);
      }
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const submit = () => {
    setError('');
    const parsed = aadhaarOtpVerifySchema.safeParse({ otp });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? `Enter the ${OTP_LENGTH}-digit code.`);
      return;
    }
    mutation.mutate();
  };

  return (
    <SafeAreaView style={styles.flex}>
      <ScreenHeader title="Verify OTP" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Enter the code</Text>
          <Text style={styles.subtitle}>We sent a {OTP_LENGTH}-digit code to your Aadhaar-linked mobile number.</Text>

          <View style={styles.otpWrap}>
            <OtpBoxes
              value={otp}
              onChange={(v) => {
                setOtp(v);
                setError('');
              }}
              autoFocus
            />
          </View>

          {success ? <Text style={styles.successText}>{success}</Text> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.buttonGap}>
            <Button title="Verify" onPress={submit} loading={mutation.isPending} />
          </View>
          <Button title="Resend OTP" variant="outline" onPress={() => navigation.navigate('AadhaarOtpRequest')} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.bgLight },
    scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
    title: { fontSize: 17.5, fontWeight: '800', color: colors.textLight, textAlign: 'center' },
    subtitle: {
      fontSize: 11,
      color: colors.slate500,
      textAlign: 'center',
      marginTop: 8,
      marginBottom: 24,
      lineHeight: 18,
    },
    otpWrap: { marginBottom: 20 },
    successText: { color: colors.successText, fontSize: 11, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
    errorText: { color: colors.dangerText, fontSize: 11, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
    buttonGap: { marginBottom: 12 },
  });
}
