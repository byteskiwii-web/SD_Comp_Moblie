import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { AuthStackParamList } from '../../navigation/types';
import { Button, TextField } from '../../components/ui';
import { colors } from '../../theme/tokens';
import { resetPassword } from '../../api/auth.api';
import { getApiErrorMessage } from '../../api/client';
import { resetPasswordSchema } from '../../schemas/auth.schema';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

export function ResetPasswordScreen({ navigation, route }: Props) {
  const { resetToken } = route.params;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

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
      setError(parsed.error.issues[0]?.message ?? 'Check your details and try again.');
      return;
    }
    mutation.mutate();
  };

  return (
    <SafeAreaView style={styles.flex}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Set a new password</Text>
        <Text style={styles.subtitle}>Choose a password you haven't used before.</Text>

        <TextField
          label="New password"
          placeholder="At least 8 characters"
          secureTextEntry
          value={password}
          onChangeText={(t) => { setPassword(t); setError(''); }}
        />
        <TextField
          label="Confirm password"
          placeholder="Re-enter your new password"
          secureTextEntry
          value={confirm}
          onChangeText={(t) => { setConfirm(t); setError(''); }}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button title="Update password" onPress={submit} loading={mutation.isPending} />
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 17.5, fontWeight: '800', color: colors.textLight, textAlign: 'center' },
  subtitle: { fontSize: 11, color: colors.slate500, textAlign: 'center', marginTop: 8, marginBottom: 24 },
  errorText: { color: colors.danger, fontSize: 11, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
});
