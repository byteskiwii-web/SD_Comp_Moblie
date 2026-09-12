import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
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
import { useT } from '../../i18n';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  /* Defaults ON, which is what the app has always done. The switch exists so
     somebody on a borrowed or shared handset can decline, not to make every
     field employee retype a password at the start of each shift. */
  const [remember, setRemember] = useState(true);
  const setAuth = useAuthStore((s) => s.setAuth);
  const endedReason = useAuthStore((s) => s.endedReason);
  const clearEndedReason = useAuthStore((s) => s.clearEndedReason);
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  /**
   * Say why they are back here, when it was not their own doing.
   *
   * Landing on an empty login form with no explanation, minutes after signing
   * in on a new phone, reads as the app having dropped the session at random —
   * and that is the kind of thing that gets reported as a bug by somebody who
   * caused it themselves. Consumed once: it describes the last session, not
   * this attempt, so it must not survive into the next failure message.
   */
  useEffect(() => {
    if (endedReason === 'SIGNED_IN_ELSEWHERE') {
      setError(t('auth.signedInElsewhere'));
      clearEndedReason();
    }
  }, [endedReason, clearEndedReason, t]);

  const mutation = useMutation({
    mutationFn: () => login(employeeId.trim(), password),
    onSuccess: async (data) => {
      await setAuth(data, { remember });
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
      setError(parsed.error.issues[0]?.message ?? t('auth.checkDetails'));
      return;
    }
    mutation.mutate();
  };

  return (
    <SafeAreaView style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logoDot}>
            <Text style={styles.logoDotText}>Z</Text>
          </View>
          <Text style={styles.brandLabel}>{t('auth.brand')}</Text>
          <Text style={styles.title}>{t('auth.signIn')}</Text>
          <Text style={styles.subtitle}>{t('auth.intro')}</Text>
        </View>

        {/* Accepts an employee id or the email address on the record. The
            server matches both exactly; autoCapitalize is off because an
            address typed in capitals is the commonest way to fail a login that
            should have worked, and the server lower-cases it anyway.

            Its own label, not the shared auth.employeeId: Forgot password
            posts to an endpoint that still validates the employee ID pattern
            alone, so the two screens genuinely accept different things. */}
        <TextField
          label={t('auth.idOrEmail')}
          placeholder={t('auth.idOrEmailPlaceholder')}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={employeeId}
          onChangeText={(t) => { setEmployeeId(t); setError(''); }}
        />
        <TextField
          label={t('auth.password')}
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={(t) => { setPassword(t); setError(''); }}
        />

        {/* The whole row is the target, not just the switch: a 32px control is
            a poor thing to aim at on a phone held in one hand at a shopfront. */}
        <Pressable
          style={styles.rememberRow}
          onPress={() => setRemember((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: remember }}
          accessibilityLabel={t('auth.rememberMe')}
        >
          <View style={styles.rememberText}>
            <Text style={styles.rememberLabel}>{t('auth.rememberMe')}</Text>
            {!remember && <Text style={styles.rememberHint}>{t('auth.rememberMeOff')}</Text>}
          </View>
          <Switch
            value={remember}
            onValueChange={setRemember}
            trackColor={{ false: colors.slate300, true: colors.brand[600] }}
            thumbColor={colors.surface}
          />
        </Pressable>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.buttonGap}>
          <Button title={t('auth.signIn')} onPress={submit} loading={mutation.isPending} />
        </View>

        <Button
          title={t('auth.forgot')}
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
    rememberRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, paddingVertical: 10, marginBottom: 4,
    },
    rememberText: { flex: 1 },
    rememberLabel: { fontSize: 12.5, fontWeight: '600', color: colors.textLight },
    rememberHint: { fontSize: 10.5, color: colors.slate500, marginTop: 2, lineHeight: 15 },
    buttonGap: { marginBottom: 12 },
  });
}
