import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation } from '@tanstack/react-query';
import { Button, TextField } from '../../components/ui';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { changeOwnPassword } from '../../api/auth.api';
import { getApiErrorMessage } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { useT } from '../../i18n';

/**
 * Replace a password an administrator handed over.
 *
 * Shown by RootNavigator INSTEAD of the app, ahead of the profile, KYC and
 * policy gates — not as a matter of taste: while the account carries this flag
 * the API refuses every route but this one, so each of those gates would sit
 * there loading data it cannot have.
 *
 * There is no skip and no back, and that is the point. The password was read
 * out loud, written on a slip of paper, or sent over WhatsApp, and until it is
 * replaced somebody other than this employee can sign in as them — which in an
 * attendance app means somebody else can mark them present.
 *
 * The employee is asked for the password they were GIVEN, not "your current
 * password": at this moment those are different ideas to the person holding
 * the phone, and the second one invites them to type something they never had.
 *
 * Sign out is deliberately available. Somebody handed the wrong phone, or the
 * wrong slip of paper, must be able to get out — and the flag is on the
 * account, not the device, so it will be waiting when the right person signs in.
 */
export function SetPasswordScreen() {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  const clearMustChangePassword = useAuthStore((s) => s.clearMustChangePassword);
  const signOut = useAuthStore((s) => s.signOut);

  const [issued, setIssued] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const MIN = 8;

  const mutation = useMutation({
    mutationFn: () => changeOwnPassword(issued, next),
    onSuccess: () => {
      /* The server has cleared the flag; clearing it here is what lets the
         navigator show the app. No sign-out, no second trip through login. */
      clearMustChangePassword();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const submit = () => {
    setError('');
    if (!issued) return setError(t('setPassword.enterIssued'));
    if (next.length < MIN) return setError(t('setPassword.tooShort', { min: MIN }));
    if (next === issued) return setError(t('setPassword.sameAsIssued'));
    if (next !== confirm) return setError(t('setPassword.mismatch'));
    mutation.mutate();
  };

  return (
    <SafeAreaView style={styles.flex}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.badge}>
            <Ionicons name="key-outline" size={22} color={colors.brand[700]} />
          </View>

          <Text style={styles.title}>{t('setPassword.title')}</Text>
          <Text style={styles.subtitle}>{t('setPassword.body')}</Text>

          <TextField
            label={t('setPassword.issuedLabel')}
            placeholder={t('setPassword.issuedPlaceholder')}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            value={issued}
            onChangeText={(v) => { setIssued(v); setError(''); }}
          />
          <TextField
            label={t('setPassword.newLabel')}
            placeholder={t('setPassword.minChars', { min: MIN })}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            value={next}
            onChangeText={(v) => { setNext(v); setError(''); }}
          />
          <TextField
            label={t('setPassword.confirmLabel')}
            placeholder={t('setPassword.reenter')}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            value={confirm}
            onChangeText={(v) => { setConfirm(v); setError(''); }}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Button title={t('setPassword.save')} onPress={submit} loading={mutation.isPending} />

          <Text style={styles.note}>{t('setPassword.note')}</Text>

          <Button
            title={t('setPassword.signOut')}
            variant="outline"
            onPress={() => { void signOut(); }}
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
    badge: {
      alignSelf: 'center', width: 46, height: 46, borderRadius: radii.pill,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.brand[100], marginBottom: 14,
    },
    title: { fontSize: 17.5, fontWeight: '800', color: colors.textLight, textAlign: 'center' },
    subtitle: { fontSize: 11, color: colors.slate500, textAlign: 'center', marginTop: 8, marginBottom: 20 },
    errorText: { color: colors.dangerText, fontSize: 11, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
    note: { fontSize: 10.5, color: colors.slate500, textAlign: 'center', marginTop: 14, marginBottom: 4 },
  });
}
