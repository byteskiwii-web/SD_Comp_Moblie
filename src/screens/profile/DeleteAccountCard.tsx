import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { useT } from '../../i18n';
import { getApiErrorMessage } from '../../api/client';
import { confirmDeletion, getDeletionStatus, requestDeletionCode } from '../../api/auth.api';
import { useAuthStore } from '../../stores/authStore';

/**
 * "Request deletion of my data", on Profile.
 *
 * Both stores require an app with accounts to offer this from inside the app,
 * and the privacy policy already promised it from exactly here — so until now
 * the policy described a screen that did not exist, which is itself grounds
 * for rejection on both stores.
 *
 * TWO STEPS, EMAIL CODE IN BETWEEN. The realistic threat is not a stolen
 * password, it is an unlocked phone on a shop counter. A code sent to the
 * registered mailbox is the one factor somebody holding the handset does not
 * have. It is typed into the confirm box rather than pasted past a checkbox,
 * so the last action before an irreversible one is deliberate.
 *
 * WHAT THE SCREEN PROMISES IS WHAT THE SERVER DOES. It does not say "your
 * account will be deleted": payroll and attendance carry statutory retention
 * in India and cannot lawfully be erased on demand, and the DPDP erasure
 * right is expressly subject to that. So it says a request is sent, access
 * ends immediately, and what the law does not require us to keep is removed.
 * Overstating it would be the easy copy to write and a lie on the screen.
 */
export function DeleteAccountCard() {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const signOut = useAuthStore((s) => s.signOut);
  // The sheet's buttons clear the navigation bar / home indicator themselves.
  const insets = useSafeAreaInsets();

  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [reason, setReason] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState('');

  const status = useQuery({ queryKey: ['deletion-status'], queryFn: getDeletionStatus });

  const sendCode = useMutation({
    mutationFn: requestDeletionCode,
    onSuccess: (d) => { setSentTo(d.maskedEmail); setError(''); },
    onError: (e) => setError(getApiErrorMessage(e)),
  });

  const submit = useMutation({
    mutationFn: () => confirmDeletion(code.trim(), reason.trim() || undefined),
    // Access is revoked server-side the moment this succeeds, so every token
    // this app holds is already dead. Signing out locally is not politeness,
    // it is the app agreeing with the server instead of showing a session
    // that no longer exists.
    onSuccess: () => { setOpen(false); void signOut(); },
    onError: (e) => setError(getApiErrorMessage(e)),
  });

  const close = () => {
    if (submit.isPending) return;
    setOpen(false); setCode(''); setReason(''); setSentTo(null); setError('');
  };

  if (status.data?.pending) {
    return (
      <View style={[styles.card, styles.cardPending]}>
        <View style={styles.row}>
          <Ionicons name="hourglass-outline" size={18} color={colors.warningText} />
          <Text style={styles.pendingTitle}>{t('del.pendingTitle')}</Text>
        </View>
        <Text style={styles.pendingBody}>{t('del.pendingBody')}</Text>
      </View>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={styles.row}>
          <Ionicons name="trash-outline" size={17} color={colors.dangerText} />
          <Text style={styles.linkText}>{t('del.entry')}</Text>
          <Ionicons name="chevron-forward" size={15} color={colors.slate400} />
        </View>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
        {/* iOS does not move a Modal's content for the keyboard, which covered
            the code field and the confirm button. Android keeps its own
            handling: with no behavior this is a plain View there. */}
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>{t('del.title')}</Text>

              <Text style={styles.sectionLabel}>{t('del.goesLabel')}</Text>
              {[t('del.goes1'), t('del.goes2'), t('del.goes3')].map((l) => (
                <View key={l} style={styles.bullet}>
                  <Ionicons name="close-circle-outline" size={15} color={colors.dangerText} style={styles.tick} />
                  <Text style={styles.bulletText}>{l}</Text>
                </View>
              ))}

              <Text style={styles.sectionLabel}>{t('del.staysLabel')}</Text>
              {[t('del.stays1'), t('del.stays2')].map((l) => (
                <View key={l} style={styles.bullet}>
                  <Ionicons name="lock-closed-outline" size={15} color={colors.slate500} style={styles.tick} />
                  <Text style={styles.bulletText}>{l}</Text>
                </View>
              ))}
              <Text style={styles.why}>{t('del.whyKept')}</Text>

              {sentTo ? (
                <>
                  <Text style={styles.sentTo}>{t('del.codeSent', { email: sentTo })}</Text>
                  <Text style={styles.spamHint}>{t('auth.checkSpam')}</Text>
                  <TextInput
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!submit.isPending}
                    placeholder="000000"
                    placeholderTextColor={colors.slate400}
                    style={styles.codeInput}
                    accessibilityLabel={t('del.codeLabel')}
                  />
                  <TextInput
                    value={reason}
                    onChangeText={setReason}
                    multiline
                    editable={!submit.isPending}
                    placeholder={t('del.reasonPlaceholder')}
                    placeholderTextColor={colors.slate400}
                    style={styles.reasonInput}
                    accessibilityLabel={t('del.reasonPlaceholder')}
                  />
                  <Text style={styles.optional}>{t('del.reasonOptional')}</Text>
                </>
              ) : null}

              {error ? <Text style={styles.error}>{error}</Text> : null}
            </ScrollView>

            <View style={[styles.actions, { paddingBottom: Math.max(18, insets.bottom + 12) }]}>
              <Pressable onPress={close} disabled={submit.isPending}
                style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}>
                <Text style={styles.btnGhostText}>{t('common.cancel')}</Text>
              </Pressable>

              {sentTo ? (
                <Pressable
                  onPress={() => submit.mutate()}
                  disabled={code.trim().length !== 6 || submit.isPending}
                  style={({ pressed }) => [
                    styles.btn, styles.btnDanger,
                    (code.trim().length !== 6 || submit.isPending) && styles.btnOff,
                    pressed && styles.pressed,
                  ]}
                >
                  {submit.isPending
                    ? <ActivityIndicator size="small" color={colors.white} />
                    : <Text style={styles.btnDangerText}>{t('del.confirm')}</Text>}
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => sendCode.mutate()}
                  disabled={sendCode.isPending}
                  style={({ pressed }) => [styles.btn, styles.btnDanger, sendCode.isPending && styles.btnOff, pressed && styles.pressed]}
                >
                  {sendCode.isPending
                    ? <ActivityIndicator size="small" color={colors.white} />
                    : <Text style={styles.btnDangerText}>{t('del.sendCode')}</Text>}
                </Pressable>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface, borderRadius: radii.lg,
      padding: 16, marginTop: 12,
      borderWidth: 1, borderColor: colors.slate100,
    },
    cardPending: { backgroundColor: colors.warningBg, borderColor: colors.warningBg },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    linkText: { flex: 1, fontSize: 14.5, fontWeight: '700', color: colors.dangerText },
    pendingTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: colors.warningText },
    pendingBody: { fontSize: 13, lineHeight: 19, color: colors.warningText, marginTop: 8 },
    pressed: { opacity: 0.85 },

    backdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.6)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.surface, maxHeight: '90%',
      borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
    },
    body: { padding: 22, paddingBottom: 10 },
    title: { fontSize: 19, fontWeight: '800', color: colors.textLight, marginBottom: 6, letterSpacing: -0.3 },
    sectionLabel: {
      fontSize: 11, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase',
      color: colors.slate500, marginTop: 16, marginBottom: 8,
    },
    bullet: { flexDirection: 'row', gap: 9, marginBottom: 8, alignItems: 'flex-start' },
    tick: { marginTop: 2 },
    bulletText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.textLight },
    why: { fontSize: 12.5, lineHeight: 18, color: colors.slate500, marginTop: 10, fontStyle: 'italic' },

    sentTo: { fontSize: 13.5, color: colors.textLight, marginTop: 20, marginBottom: 4 },
    spamHint: { fontSize: 11.5, color: colors.slate400, fontWeight: '600', marginBottom: 10 },
    codeInput: {
      borderWidth: 1, borderColor: colors.slate300, borderRadius: radii.md,
      paddingHorizontal: 14, paddingVertical: 12, fontSize: 22, letterSpacing: 8,
      textAlign: 'center', color: colors.textLight, backgroundColor: colors.bgLight,
    },
    reasonInput: {
      borderWidth: 1, borderColor: colors.slate300, borderRadius: radii.md,
      paddingHorizontal: 12, paddingVertical: 10, marginTop: 12,
      minHeight: 70, textAlignVertical: 'top',
      fontSize: 14, color: colors.textLight, backgroundColor: colors.bgLight,
    },
    optional: { fontSize: 11.5, color: colors.slate500, marginTop: 6 },
    error: { fontSize: 13, color: colors.dangerText, marginTop: 14 },

    actions: {
      flexDirection: 'row', gap: 10, padding: 18,
      borderTopWidth: 1, borderTopColor: colors.slate100,
    },
    btn: { flex: 1, paddingVertical: 14, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
    btnGhost: { backgroundColor: colors.slate100 },
    btnGhostText: { fontSize: 14.5, fontWeight: '700', color: colors.textLight },
    btnDanger: { backgroundColor: colors.danger },
    btnDangerText: { fontSize: 14.5, fontWeight: '800', color: colors.white },
    btnOff: { opacity: 0.45 },
  });
