import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, TextField } from '../../components/ui';
import { colors } from '../../theme/tokens';
import { useAuthStore } from '../../stores/authStore';
import { requestAadhaarOtp } from '../../api/verification.api';
import { getApiErrorMessage } from '../../api/client';
import { kycGateQueryKey } from '../../hooks/useKycGate';
import { aadhaarOtpRequestSchema } from '../../schemas/kyc.schema';
import { KycStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<KycStackParamList, 'AadhaarOtpRequest'>;

export function AadhaarOtpRequestScreen() {
  const navigation = useNavigation<Nav>();
  const employee = useAuthStore((s) => s.employee);
  const queryClient = useQueryClient();

  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => requestAadhaarOtp({ aadhaar_number: aadhaarNumber }),
    onSuccess: (result) => {
      // Clear the raw number from local state as soon as it's no longer
      // needed -- the next screen only ever receives referenceId.
      setAadhaarNumber('');
      if (result.otpSent && result.referenceId) {
        navigation.navigate('AadhaarOtpVerify', { referenceId: result.referenceId });
      } else {
        // Already-verified short-circuit: nothing to verify.
        queryClient.invalidateQueries({ queryKey: kycGateQueryKey(employee?.id) });
        navigation.goBack();
      }
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const submit = () => {
    setError('');
    const parsed = aadhaarOtpRequestSchema.safeParse({ aadhaar_number: aadhaarNumber, consentAccepted });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a valid Aadhaar number.');
      return;
    }
    mutation.mutate();
  };

  return (
    <SafeAreaView style={styles.flex}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Verify your Aadhaar</Text>
          <Text style={styles.subtitle}>We'll send a one-time code to your Aadhaar-linked mobile number.</Text>

          <TextField
            label="Aadhaar Number"
            value={aadhaarNumber}
            onChangeText={(t) => {
              setAadhaarNumber(t.replace(/\D/g, '').slice(0, 12));
              setError('');
            }}
            keyboardType="number-pad"
            maxLength={12}
            placeholder="123456789012"
          />

          <Pressable style={styles.consentRow} onPress={() => setConsentAccepted((v) => !v)}>
            <View style={[styles.checkbox, consentAccepted && styles.checkboxChecked]}>
              {consentAccepted ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
            <Text style={styles.consentText}>
              I consent to verifying my Aadhaar via OTP for employment KYC.
            </Text>
          </Pressable>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.buttonGap}>
            <Button title="Send OTP" onPress={submit} loading={mutation.isPending} disabled={!consentAccepted} />
          </View>
          <Button title="Back" variant="outline" onPress={() => navigation.goBack()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 17.5, fontWeight: '800', color: colors.textLight, textAlign: 'center' },
  subtitle: {
    fontSize: 11,
    color: colors.slate500,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 18,
  },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.slate300,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: colors.brand[700], borderColor: colors.brand[700] },
  checkmark: { color: colors.white, fontSize: 11.5, fontWeight: '800' },
  consentText: { flex: 1, fontSize: 11, color: colors.slate600, lineHeight: 17 },
  errorText: { color: colors.danger, fontSize: 11, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  buttonGap: { marginBottom: 12 },
});
