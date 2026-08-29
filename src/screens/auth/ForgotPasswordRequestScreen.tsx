import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { AuthStackParamList } from '../../navigation/types';
import { Button, TextField } from '../../components/ui';
import { colors } from '../../theme/tokens';
import { requestPasswordResetOtp } from '../../api/auth.api';
import { getApiErrorMessage } from '../../api/client';
import { forgotPasswordRequestSchema } from '../../schemas/auth.schema';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPasswordRequest'>;

export function ForgotPasswordRequestScreen({ navigation, route }: Props) {
  const [employeeId, setEmployeeId] = useState('');
  const [error, setError] = useState('');
  const fromFirstLogin = route.params?.fromFirstLogin;

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
      setError(parsed.error.issues[0]?.message ?? 'Enter your employee ID.');
      return;
    }
    mutation.mutate();
  };

  return (
    <SafeAreaView style={styles.flex}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{fromFirstLogin ? "Let's set your password" : 'Forgot password'}</Text>
        <Text style={styles.subtitle}>
          {fromFirstLogin
            ? "You haven't set a password yet. We'll email you a one-time code to set one."
            : "We'll email a one-time code to your registered email address."}
        </Text>

        <TextField
          label="Employee ID"
          placeholder="EMP-00001"
          autoCapitalize="characters"
          autoCorrect={false}
          value={employeeId}
          onChangeText={(t) => { setEmployeeId(t); setError(''); }}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.buttonGap}>
          <Button title="Send code" onPress={submit} loading={mutation.isPending} />
        </View>
        <Button title="Back to sign in" variant="outline" onPress={() => navigation.navigate('Login')} />
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '800', color: colors.textLight, textAlign: 'center' },
  subtitle: { fontSize: 12, color: colors.slate500, textAlign: 'center', marginTop: 8, marginBottom: 24, lineHeight: 18 },
  errorText: { color: colors.danger, fontSize: 12, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  buttonGap: { marginBottom: 12 },
});
