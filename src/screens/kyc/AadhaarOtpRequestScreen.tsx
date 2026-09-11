import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, TextField } from '../../components/ui';
import { ColorScheme } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import { requestAadhaarOtp } from '../../api/verification.api';
import { getApiErrorMessage } from '../../api/client';
import { kycGateQueryKey } from '../../hooks/useKycGate';
import { aadhaarOtpRequestSchema } from '../../schemas/kyc.schema';
import { KycStackParamList } from '../../navigation/types';
import { useT } from '../../i18n';

type Nav = NativeStackNavigationProp<KycStackParamList, 'AadhaarOtpRequest'>;

export function AadhaarOtpRequestScreen() {
  const navigation = useNavigation<Nav>();
  const employee = useAuthStore((s) => s.employee);
  const queryClient = useQueryClient();
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

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
      setError(parsed.error.issues[0]?.message ?? t('aadhaar.invalid'));
      return;
    }
    mutation.mutate();
  };

  return (
    <SafeAreaView style={styles.flex}>
      <ScreenHeader title={t('kyc.aadhaarShort')} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{t('aadhaar.title')}</Text>
          <Text style={styles.subtitle}>{t('aadhaar.body')}</Text>

          <TextField
            label={t('aadhaar.number')}
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
              {t('aadhaar.consent')}
            </Text>
          </Pressable>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.buttonGap}>
            <Button
              title={t('aadhaar.sendOtp')}
              onPress={submit}
              loading={mutation.isPending}
              disabled={!consentAccepted}
            />
          </View>
          <Button title={t('common.back')} variant="outline" onPress={() => navigation.goBack()} />
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
    errorText: { color: colors.dangerText, fontSize: 11, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
    buttonGap: { marginBottom: 12 },
  });
}
