import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { AuthStackParamList } from '../../navigation/types';
import { Button, TextField } from '../../components/ui';
import { ColorScheme } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { requestPasswordResetOtp } from '../../api/auth.api';
import { getApiErrorMessage } from '../../api/client';
import { forgotPasswordRequestSchema } from '../../schemas/auth.schema';
import { useT } from '../../i18n';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPasswordRequest'>;

export function ForgotPasswordRequestScreen({ navigation, route }: Props) {
  const [employeeId, setEmployeeId] = useState('');
  const [error, setError] = useState('');
  const fromFirstLogin = route.params?.fromFirstLogin;
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  const mutation = useMutation({
    mutationFn: () => requestPasswordResetOtp(employeeId.trim()),
    onSuccess: (data) => {
      navigation.navigate('ForgotPasswordVerify', {
        employeeId: employeeId.trim(),
        maskedEmail: data.maskedEmail,
      });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const submit = () => {
    setError('');
    const parsed = forgotPasswordRequestSchema.safeParse({ employee_id: employeeId });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t('auth.needEmployeeId'));
      return;
    }
    mutation.mutate();
  };

  return (
    <SafeAreaView style={styles.flex}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>
          {fromFirstLogin ? t('auth.setPasswordTitle') : t('auth.forgotTitle')}
        </Text>
        <Text style={styles.subtitle}>
          {fromFirstLogin ? t('auth.firstLoginBody') : t('auth.forgotBody')}
        </Text>

        <TextField
          label={t('auth.employeeId')}
          placeholder="EMP-00001"
          autoCapitalize="characters"
          autoCorrect={false}
          value={employeeId}
          onChangeText={(t) => { setEmployeeId(t); setError(''); }}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.buttonGap}>
          <Button title={t('auth.sendCode')} onPress={submit} loading={mutation.isPending} />
        </View>
        <Button
          title={t('auth.backToSignIn')}
          variant="outline"
          onPress={() => navigation.navigate('Login')}
        />
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
    subtitle: { fontSize: 11, color: colors.slate500, textAlign: 'center', marginTop: 8, marginBottom: 24, lineHeight: 18 },
    errorText: { color: colors.dangerText, fontSize: 11, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
    buttonGap: { marginBottom: 12 },
  });
}
