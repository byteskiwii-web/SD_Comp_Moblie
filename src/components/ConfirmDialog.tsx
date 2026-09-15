import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ColorScheme, radii } from '../theme/tokens';
import { useThemeStore } from '../stores/themeStore';
import { useT } from '../i18n';

/**
 * The app's confirmation for anything that cannot be undone.
 *
 * Replaces Alert.alert for destructive actions. Alert renders the OPERATING
 * SYSTEM's dialog: it ignores the app's theme entirely, so a employee in dark
 * mode got a white box, and it offers no way to show a typed confirmation or
 * a pending state. It also looks identical to every other app's alert, which
 * is precisely wrong for the one moment we want someone to stop and read.
 *
 * Three levels of friction, chosen by how bad the mistake would be:
 *
 *   tone="default"   two buttons. Signing out — annoying to undo, not harmful.
 *   tone="danger"    two buttons, red confirm. Withdrawing a leave request.
 *   challenge=...    the confirm button stays disabled until the exact text is
 *                    typed. For deleting an account, where a mis-tap is
 *                    unrecoverable. Same idea as GitHub's repository delete,
 *                    and for the same reason: the typing is not security, it
 *                    is a forced pause that makes the object being destroyed
 *                    impossible to mistake for a different one.
 *
 * The challenge match is case-insensitive and trims surrounding space. Being
 * strict about capitals punishes phone keyboards, not mistakes.
 */
export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  tone = 'default',
  challenge,
  challengeHint,
  pending = false,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  /** When set, the confirm button unlocks only once this is typed back. */
  challenge?: string;
  challengeHint?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const [typed, setTyped] = useState('');

  // A reopened dialog must never start with the previous answer still in it.
  useEffect(() => {
    if (visible) setTyped('');
  }, [visible]);

  const unlocked = !challenge || typed.trim().toLowerCase() === challenge.trim().toLowerCase();
  const danger = tone === 'danger' || Boolean(challenge);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={pending ? undefined : onCancel}>
        {/* Stops a tap inside the card reaching the dismiss handler above. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={[styles.badge, danger && styles.badgeDanger]}>
            <Ionicons
              name={danger ? 'alert-circle-outline' : 'help-circle-outline'}
              size={24}
              color={danger ? colors.dangerText : colors.brand[700]}
            />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>

          {challenge ? (
            <View style={styles.challengeWrap}>
              <Text style={styles.challengeHint}>
                {challengeHint || t('confirm.typeToConfirm', { text: challenge })}
              </Text>
              <TextInput
                value={typed}
                onChangeText={setTyped}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!pending}
                placeholder={challenge}
                placeholderTextColor={colors.slate400}
                style={[styles.input, unlocked && typed.length > 0 && styles.inputOk]}
                accessibilityLabel={challengeHint || challenge}
              />
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              disabled={pending}
              accessibilityRole="button"
              style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}
            >
              <Text style={styles.btnGhostText}>{cancelLabel || t('common.cancel')}</Text>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              disabled={!unlocked || pending}
              accessibilityRole="button"
              accessibilityState={{ disabled: !unlocked || pending }}
              style={({ pressed }) => [
                styles.btn,
                danger ? styles.btnDanger : styles.btnPrimary,
                (!unlocked || pending) && styles.btnOff,
                pressed && styles.pressed,
              ]}
            >
              {pending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.btnConfirmText}>{confirmLabel}</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1, backgroundColor: 'rgba(2,6,23,0.6)',
      alignItems: 'center', justifyContent: 'center', padding: 24,
    },
    card: {
      width: '100%', maxWidth: 400,
      backgroundColor: colors.surface,
      borderRadius: radii.lg, padding: 22,
    },
    badge: {
      width: 44, height: 44, borderRadius: radii.pill,
      backgroundColor: colors.brand[50],
      alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    },
    badgeDanger: { backgroundColor: colors.dangerBg },
    title: {
      fontSize: 17.5, fontWeight: '800', color: colors.textLight,
      letterSpacing: -0.3, marginBottom: 8,
    },
    body: { fontSize: 14.5, lineHeight: 21, color: colors.slate500 },
    challengeWrap: { marginTop: 18 },
    challengeHint: { fontSize: 12.5, color: colors.slate500, marginBottom: 7 },
    input: {
      borderWidth: 1, borderColor: colors.slate300, borderRadius: radii.md,
      paddingHorizontal: 13, paddingVertical: 11,
      fontSize: 15, color: colors.textLight, backgroundColor: colors.bgLight,
    },
    inputOk: { borderColor: colors.successText, borderWidth: 1.5 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
    btn: { flex: 1, paddingVertical: 13, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
    btnGhost: { backgroundColor: colors.slate100 },
    btnGhostText: { fontSize: 14.5, fontWeight: '700', color: colors.textLight },
    btnPrimary: { backgroundColor: colors.brand[700] },
    btnDanger: { backgroundColor: colors.danger },
    btnOff: { opacity: 0.45 },
    btnConfirmText: { fontSize: 14.5, fontWeight: '800', color: colors.white },
    pressed: { opacity: 0.85 },
  });
