import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { AuthStackParamList } from '../../navigation/types';
import { Button, TextField } from '../../components/ui';
import { ColorScheme } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { resetPassword } from '../../api/auth.api';
import { getApiErrorMessage } from '../../api/client';
import { resetPasswordSchema } from '../../schemas/auth.schema';
import { useT } from '../../i18n';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

export function ResetPasswordScreen({ navigation, route }: Props) {
  const { resetToken } = route.params;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  const mutation = useMutation({
    mutationFn: () => resetPassword(resetToken, password),
    onSuccess: () => {
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const submit = () => {
    setError('');
    const parsed = resetPasswordSchema.safeParse({
      resetToken,
      new_password: password,
      confirm_password: confirm,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t('auth.checkDetails'));
      return;
    }
    mutation.mutate();
  };

  return (
    <SafeAreaView style={styles.flex}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('auth.newPasswordTitle')}</Text>
        <Text style={styles.subtitle}>{t('auth.newPasswordBody')}</Text>

        <TextField
          label={t('auth.newPassword')}
          placeholder={t('auth.minChars')}
          secureTextEntry
          value={password}
          onChangeText={(t) => { setPassword(t); setError(''); }}
        />
        <TextField
          label={t('auth.confirmPassword')}
          placeholder={t('auth.reenter')}
          secureTextEntry
          value={confirm}
          onChangeText={(t) => { setConfirm(t); setError(''); }}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button title={t('auth.updatePassword')} onPress={submit} loading={mutation.isPending} />
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
    subtitle: { fontSize: 11, color: colors.slate500, textAlign: 'center', marginTop: 8, marginBottom: 24 },
    errorText: { color: colors.dangerText, fontSize: 11, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  });
}
