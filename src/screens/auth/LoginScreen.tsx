import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { AuthStackParamList } from '../../navigation/types';
import { Button, TextField } from '../../components/ui';
import { ColorScheme } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { login } from '../../api/auth.api';
import { getApiErrorCode, getApiErrorMessage } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { loginSchema } from '../../schemas/auth.schema';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const setAuth = useAuthStore((s) => s.setAuth);
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const mutation = useMutation({
    mutationFn: () => login(employeeId.trim(), password),
    onSuccess: async (data) => {
      await setAuth(data);
    },
    onError: (err) => {
      const code = getApiErrorCode(err);
      if (code === 'PASSWORD_NOT_SET') {
        navigation.navigate('ForgotPasswordRequest', { fromFirstLogin: true });
        return;
      }
      setError(getApiErrorMessage(err));
    },
  });

  const submit = () => {
    setError('');
    const parsed = loginSchema.safeParse({ employee_id: employeeId, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check your details and try again.');
      return;
    }
    mutation.mutate();
  };

  return (
    <SafeAreaView style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logoDot}>
            <Text style={styles.logoDotText}>Z</Text>
          </View>
          <Text style={styles.brandLabel}>ZIP HRMS · FIELD APP</Text>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.subtitle}>Use the employee ID and password given by your HR team.</Text>
        </View>

        <TextField
          label="Employee ID"
          placeholder="EMP-00001"
          autoCapitalize="characters"
          autoCorrect={false}
          value={employeeId}
          onChangeText={(t) => { setEmployeeId(t); setError(''); }}
        />
        <TextField
          label="Password"
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={(t) => { setPassword(t); setError(''); }}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.buttonGap}>
          <Button title="Sign in" onPress={submit} loading={mutation.isPending} />
        </View>

        <Button
          title="Forgot password?"
          variant="outline"
          onPress={() => navigation.navigate('ForgotPasswordRequest')}
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
    header: { alignItems: 'center', marginBottom: 32 },
    logoDot: {
      width: 52, height: 52, borderRadius: 16, backgroundColor: colors.brand[700], marginBottom: 14,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: colors.brand[900], shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
    },
    logoDotText: { color: colors.white, fontSize: 19, fontWeight: '800' },
    brandLabel: {
      fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: colors.brand[700], marginBottom: 16,
    },
    title: { fontSize: 19, fontWeight: '800', color: colors.textLight },
    subtitle: {
      fontSize: 11, color: colors.slate500, textAlign: 'center', marginTop: 6, lineHeight: 18, paddingHorizontal: 12,
    },
    errorText: { color: colors.dangerText, fontSize: 11, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
    buttonGap: { marginBottom: 12 },
  });
}
