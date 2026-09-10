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
import { verifyPan } from '../../api/verification.api';
import { getApiErrorMessage } from '../../api/client';
import { kycGateQueryKey } from '../../hooks/useKycGate';
import { panVerifySchema } from '../../schemas/kyc.schema';
import { KycStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<KycStackParamList, 'PanVerify'>;

export function PanVerifyScreen() {
  const navigation = useNavigation<Nav>();
  const employee = useAuthStore((s) => s.employee);
  const queryClient = useQueryClient();
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [pan, setPan] = useState('');
  const [nameAsPerPan, setNameAsPerPan] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const mutation = useMutation({
    mutationFn: () => verifyPan({ pan, name_as_per_pan: nameAsPerPan, date_of_birth: dateOfBirth }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: kycGateQueryKey(employee?.id) });
      if (result.verified) {
        setSuccess(`PAN ${result.pan.masked} verified`);
        setTimeout(() => navigation.goBack(), 900);
      } else {
        setError(result.message);
      }
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const formatDob = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
    return parts.join('/');
  };

  const submit = () => {
    setError('');
    const parsed = panVerifySchema.safeParse({
      pan,
      name_as_per_pan: nameAsPerPan,
      date_of_birth: dateOfBirth,
      consentAccepted,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a valid PAN.');
      return;
    }
    mutation.mutate();
  };

  return (
    <SafeAreaView style={styles.flex}>
      <ScreenHeader title="PAN" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.subtitle}>Enter your PAN exactly as it appears on your card.</Text>

          <TextField
            label="PAN Number"
            value={pan}
            onChangeText={(t) => {
              setPan(t.toUpperCase());
              setError('');
            }}
            autoCapitalize="characters"
            maxLength={10}
            placeholder="ABCDE1234F"
          />

          <TextField
            label="Name as per PAN"
            value={nameAsPerPan}
            onChangeText={(t) => {
              setNameAsPerPan(t);
              setError('');
            }}
            autoCapitalize="words"
            placeholder="As printed on your PAN card"
          />

          <TextField
            label="Date of Birth"
            value={dateOfBirth}
            onChangeText={(t) => {
              setDateOfBirth(formatDob(t));
              setError('');
            }}
            keyboardType="number-pad"
            maxLength={10}
            placeholder="DD/MM/YYYY"
          />

          <Pressable style={styles.consentRow} onPress={() => setConsentAccepted((v) => !v)}>
            <View style={[styles.checkbox, consentAccepted && styles.checkboxChecked]}>
              {consentAccepted ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
            <Text style={styles.consentText}>
              I consent to verifying my PAN with the government database for employment KYC.
            </Text>
          </Pressable>

          {success ? <Text style={styles.successText}>{success}</Text> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.buttonGap}>
            <Button title="Verify PAN" onPress={submit} loading={mutation.isPending} disabled={!consentAccepted} />
          </View>
          <Button title="Back" variant="outline" onPress={() => navigation.goBack()} />
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
    successText: { color: colors.successText, fontSize: 11, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
    errorText: { color: colors.dangerText, fontSize: 11, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
    buttonGap: { marginBottom: 12 },
  });
}
