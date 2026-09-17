import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, TextField } from '../../components/ui';
import { ColorScheme } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import { getKycStatus, verifyPan } from '../../api/verification.api';
import { getApiErrorMessage } from '../../api/client';
import { onboardingGateQueryKey as kycGateQueryKey } from '../../hooks/useOnboardingGate';
import { panVerifySchema } from '../../schemas/kyc.schema';
import { KycStackParamList } from '../../navigation/types';
import { useT } from '../../i18n';

type Nav = NativeStackNavigationProp<KycStackParamList, 'PanVerify'>;

export function PanVerifyScreen() {
  const navigation = useNavigation<Nav>();
  const employee = useAuthStore((s) => s.employee);
  const queryClient = useQueryClient();
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  // Which provider is active decides whether this screen also verifies
  // Aadhaar. Cheap DB-only read, and this screen is reached from two
  // different stacks (KycGate and Profile) that each already know this from
  // their OWN query -- fetching it again here, rather than threading it
  // through as a route param from both, keeps this screen self-contained.
  const { data: status } = useQuery({
    queryKey: ['kyc-capabilities'],
    queryFn: getKycStatus,
    staleTime: 5 * 60 * 1000,
  });
  const combinedPanAadhaar = status?.capabilities.combinedPanAadhaar ?? false;

  const [pan, setPan] = useState('');
  const [nameAsPerPan, setNameAsPerPan] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      verifyPan({
        pan,
        name_as_per_pan: nameAsPerPan,
        date_of_birth: dateOfBirth,
        ...(combinedPanAadhaar ? { aadhaar_number: aadhaarNumber } : {}),
      }),
    onSuccess: (result) => {
      // Cleared regardless of outcome: the raw number has done its one job
      // and this screen never holds onto it longer than the request needs.
      setAadhaarNumber('');
      queryClient.invalidateQueries({ queryKey: kycGateQueryKey(employee?.id) });
      queryClient.invalidateQueries({ queryKey: ['profile-kyc-status', employee?.id] });
      if (result.verified && (!result.aadhaar || result.aadhaar.verified)) {
        setSuccess(
          result.aadhaar ? t('pan.combinedVerified') : t('pan.verifiedWith', { masked: result.pan.masked })
        );
        setTimeout(() => navigation.goBack(), 900);
      } else if (result.aadhaar && !result.aadhaar.verified) {
        // PAN itself may still be verified here -- the message is about
        // Aadhaar specifically, which is what stopped this from completing.
        setError(result.aadhaar.message);
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
      aadhaar_number: aadhaarNumber,
      consentAccepted,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t('pan.invalid'));
      return;
    }
    // Whether this field is required at all depends on the active provider,
    // which the static schema above has no way to express -- see
    // pan.service.js#requireCombinedFields on the server for the same check.
    if (combinedPanAadhaar && !aadhaarNumber) {
      setError(t('pan.aadhaarRequired'));
      return;
    }
    mutation.mutate();
  };

  return (
    <SafeAreaView style={styles.flex}>
      <ScreenHeader title={t('kyc.panShort')} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.subtitle}>{combinedPanAadhaar ? t('pan.introCombined') : t('pan.intro')}</Text>

          <TextField
            label={t('pan.number')}
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
            label={t('pan.name')}
            value={nameAsPerPan}
            onChangeText={(t) => {
              setNameAsPerPan(t);
              setError('');
            }}
            autoCapitalize="words"
            placeholder={t('pan.nameHint')}
          />

          <TextField
            label={t('pan.dob')}
            value={dateOfBirth}
            onChangeText={(t) => {
              setDateOfBirth(formatDob(t));
              setError('');
            }}
            keyboardType="number-pad"
            maxLength={10}
            placeholder="DD/MM/YYYY"
          />

          {combinedPanAadhaar ? (
            <TextField
              label={t('pan.aadhaarNumber')}
              value={aadhaarNumber}
              onChangeText={(t) => {
                setAadhaarNumber(t.replace(/\D/g, '').slice(0, 12));
                setError('');
              }}
              keyboardType="number-pad"
              maxLength={12}
              placeholder={t('pan.aadhaarHint')}
            />
          ) : null}

          <Pressable style={styles.consentRow} onPress={() => setConsentAccepted((v) => !v)}>
            <View style={[styles.checkbox, consentAccepted && styles.checkboxChecked]}>
              {consentAccepted ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
            <Text style={styles.consentText}>
              {combinedPanAadhaar ? t('pan.consentCombined') : t('pan.consent')}
            </Text>
          </Pressable>

          {success ? <Text style={styles.successText}>{success}</Text> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.buttonGap}>
            <Button
              title={t('pan.verify')}
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
    successText: { color: colors.successText, fontSize: 11, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
    errorText: { color: colors.dangerText, fontSize: 11, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
    buttonGap: { marginBottom: 12 },
  });
}
