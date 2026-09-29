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
import { confirmDeletion, DELETION_CONFIRMATION_WORD, getDeletionStatus } from '../../api/auth.api';
import { useAuthStore } from '../../stores/authStore';

/**
 * "Request deletion of my data", on Profile.
 *
 * Both stores require an app with accounts to offer this from inside the app,
 * and the privacy policy already promised it from exactly here — so until now
 * the policy described a screen that did not exist, which is itself grounds
 * for rejection on both stores.
 *
 * CONFIRMED BY TYPING A WORD. It used to email a 6-digit code first, and
 * field staff without a working mailbox could not get past that step -- the
 * right was on the screen but out of reach. Now the employee types DELETE:
 * still a deliberate act that no stray tap can complete, with no mailbox
 * needed. The request cuts access and goes to HR, who review it before
 * anything is removed, so a request somebody else made on an unlocked phone
 * can still be caught and rejected.
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
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const status = useQuery({ queryKey: ['deletion-status'], queryFn: getDeletionStatus });
  const confirmed = typed.trim().toUpperCase() === DELETION_CONFIRMATION_WORD;

  const submit = useMutation({
    mutationFn: () => confirmDeletion(typed.trim(), reason.trim() || undefined),
    // Access is revoked server-side the moment this succeeds, so every token
    // this app holds is already dead. Signing out locally is not politeness,
    // it is the app agreeing with the server instead of showing a session
    // that no longer exists.
    onSuccess: () => { setOpen(false); void signOut(); },
    onError: (e) => setError(getApiErrorMessage(e)),
  });

  const close = () => {
    if (submit.isPending) return;
    setOpen(false); setTyped(''); setReason(''); setError('');
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

              <Text style={styles.typePrompt}>{t('del.typePrompt', { word: DELETION_CONFIRMATION_WORD })}</Text>
              <TextInput
                value={typed}
                onChangeText={(v) => { setTyped(v); if (error) setError(''); }}
                autoCapitalize="characters"
                autoCorrect={false}
                autoComplete="off"
                maxLength={20}
                editable={!submit.isPending}
                placeholder={DELETION_CONFIRMATION_WORD}
                placeholderTextColor={colors.slate300}
                style={[styles.wordInput, confirmed && styles.wordInputOk]}
                accessibilityLabel={t('del.typeLabel')}
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

              {error ? <Text style={styles.error}>{error}</Text> : null}
            </ScrollView>

            <View style={[styles.actions, { paddingBottom: Math.max(18, insets.bottom + 12) }]}>
              <Pressable onPress={close} disabled={submit.isPending}
                style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}>
                <Text style={styles.btnGhostText}>{t('common.cancel')}</Text>
              </Pressable>

              <Pressable
                onPress={() => submit.mutate()}
                disabled={!confirmed || submit.isPending}
                accessibilityRole="button"
                accessibilityState={{ disabled: !confirmed || submit.isPending, busy: submit.isPending }}
                style={({ pressed }) => [
                  styles.btn, styles.btnDanger,
                  (!confirmed || submit.isPending) && styles.btnOff,
                  pressed && styles.pressed,
                ]}
              >
                {submit.isPending
                  ? <ActivityIndicator size="small" color={colors.white} />
                  : <Text style={styles.btnDangerText}>{t('del.confirm')}</Text>}
              </Pressable>
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

    typePrompt: { fontSize: 13.5, fontWeight: '700', color: colors.textLight, marginTop: 20, marginBottom: 8 },
    wordInput: {
      borderWidth: 1, borderColor: colors.slate300, borderRadius: radii.md,
      paddingHorizontal: 14, paddingVertical: 12, fontSize: 20, fontWeight: '800', letterSpacing: 4,
      textAlign: 'center', color: colors.textLight, backgroundColor: colors.bgLight,
    },
    wordInputOk: { borderColor: colors.danger, borderWidth: 2 },
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
