import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Button, TextField, Card } from '../../components/ui';
import { DatePickerField } from '../../components/PickerField';
import { ColorScheme } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import { updateMyProfile } from '../../api/auth.api';
import { getApiErrorMessage } from '../../api/client';
import { useT } from '../../i18n';
import { onboardingGateQueryKey } from '../../hooks/useOnboardingGate';

/**
 * "Sign up complete": the last step between HR creating an account and the
 * employee actually starting the job. HR knows a new hire's identity and
 * where they're posted the moment the record is created -- everything else
 * (date of birth, address, supporting documents) is the employee's own to
 * supply, which this screen collects in one place.
 *
 * The first row of the onboarding checklist (OnboardingChecklistScreen):
 * saving ticks it and returns there. Also reachable later from Profile.
 */
export function CompleteProfileScreen() {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const employee = useAuthStore((s) => s.employee);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const queryClient = useQueryClient();
  const navigation = useNavigation<any>();

  const [dateOfBirth, setDateOfBirth] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipcode, setZipcode] = useState('');
  const [error, setError] = useState('');

  const submit = useMutation({
    mutationFn: () =>
      updateMyProfile({
        date_of_birth: dateOfBirth,
        address_line1: addressLine1.trim(),
        address_line2: addressLine2.trim() || null,
        city: city.trim(),
        state: state.trim(),
        zipcode: zipcode.trim(),
      }),
    onSuccess: async () => {
      setError('');
      // Profile and the onboarding checklist both read this; the checklist
      // is where the back navigation lands, and it must already show the
      // tick when it does.
      await refreshProfile();
      await queryClient.invalidateQueries({ queryKey: onboardingGateQueryKey(employee?.id) });
      if (navigation.canGoBack()) navigation.goBack();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const canSubmit =
    dateOfBirth.length > 0 &&
    addressLine1.trim().length > 0 &&
    city.trim().length > 0 &&
    state.trim().length > 0 &&
    /^[1-9][0-9]{5}$/.test(zipcode.trim());

  return (
    <SafeAreaView style={styles.flex}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.backRow}>
            <Button title={t('common.back')} variant="outline" onPress={() => navigation.goBack()} />
          </View>
          <Text style={styles.title}>{t('onboard.title')}</Text>
          <Text style={styles.subtitle}>
            {t('onboard.subtitle', { name: employee?.first_name ?? '' })}
          </Text>

          <Card style={styles.card}>
            <DatePickerField
              label={t('onboard.dob')}
              value={dateOfBirth}
              onChange={setDateOfBirth}
              maximumDate={new Date()}
            />
            <TextField
              label={t('onboard.addressLine1')}
              placeholder={t('onboard.addressLine1Hint')}
              value={addressLine1}
              onChangeText={setAddressLine1}
            />
            <TextField
              label={t('onboard.addressLine2')}
              placeholder={t('onboard.addressLine2Hint')}
              value={addressLine2}
              onChangeText={setAddressLine2}
            />
            <View style={styles.row}>
              <View style={styles.rowItem}>
                <TextField label={t('onboard.city')} value={city} onChangeText={setCity} />
              </View>
              <View style={styles.rowItem}>
                <TextField label={t('onboard.state')} value={state} onChangeText={setState} />
              </View>
            </View>
            <TextField
              label={t('onboard.zipcode')}
              placeholder="380001"
              keyboardType="number-pad"
              maxLength={6}
              value={zipcode}
              onChangeText={(v) => setZipcode(v.replace(/\D/g, ''))}
            />
          </Card>


          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.buttonGap}>
            <Button
              title={t('onboard.submit')}
              onPress={() => submit.mutate()}
              loading={submit.isPending}
              disabled={!canSubmit}
            />
          </View>
          {!canSubmit ? <Text style={styles.hint}>{t('onboard.hint')}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.bgLight },
    scroll: { flexGrow: 1, padding: 24, paddingBottom: 40 },
    title: { fontSize: 19, fontWeight: '800', color: colors.textLight, textAlign: 'center' },
    subtitle: {
      fontSize: 11.5, color: colors.slate500, textAlign: 'center',
      marginTop: 8, marginBottom: 20, lineHeight: 18,
    },
    backRow: { alignSelf: 'flex-start', marginBottom: 10 },
    card: { marginBottom: 14, gap: 2 },
    row: { flexDirection: 'row', gap: 12 },
    rowItem: { flex: 1 },
    errorText: { color: colors.dangerText, fontSize: 11, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
    buttonGap: { marginTop: 14, marginBottom: 8 },
    hint: { fontSize: 10.5, color: colors.slate400, textAlign: 'center', fontWeight: '600' },
  });
}
