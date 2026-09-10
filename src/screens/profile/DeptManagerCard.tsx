import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation } from '@tanstack/react-query';
import { Card } from '../../components/ui';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { getApiErrorMessage } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { updateMyProfile } from '../../api/auth.api';
import { useT } from '../../i18n';

/**
 * Who to call.
 *
 * Editable by the employee, which is a reversal: this began HR-only on the
 * reasoning that nobody should name their own manager. That holds only where
 * the field carries authority, and it carries none — nothing routes an
 * approval through it. Meanwhile HR has no screen that writes it, so HR-only
 * meant nobody could fill it at all.
 *
 * Read mode leads with the phone as a tappable action, because the entire
 * point of storing a manager's number is the moment somebody needs to ring
 * them. Edit is deliberately a mode rather than three always-live inputs: this
 * changes a few times a year, and a form that is permanently open invites an
 * accidental edit every time somebody scrolls past.
 */
export function DeptManagerCard() {
  const profile = useAuthStore((s) => s.profile);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const manager = profile?.deptManager ?? null;

  // Seeded on entering edit, not on every render — otherwise a refetch
  // mid-edit would overwrite what is being typed.
  useEffect(() => {
    if (!editing) return;
    setName(manager?.name ?? '');
    setEmail(manager?.email ?? '');
    setPhone(manager?.phone ?? '');
    setError(null);
  }, [editing]);

  const save = useMutation({
    mutationFn: () =>
      updateMyProfile({
        // Empty clears the field rather than sending "", which the server would
        // refuse against the email and phone patterns.
        dept_manager_name: name.trim() || null,
        dept_manager_email: email.trim() || null,
        dept_manager_phone: phone.trim() || null,
      }),
    onSuccess: async () => {
      setError(null);
      setEditing(false);
      await refreshProfile();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  // Checked here so the button can say why, rather than the form bouncing back
  // after a round trip. Both patterns match the server's exactly.
  const problem =
    phone.trim() && !/^[6-9][0-9]{9}$/.test(phone.trim())
      ? t('deptMgr.badPhone')
      : email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
        ? t('deptMgr.badEmail')
        : null;

  return (
    <Card>
      <View style={styles.head}>
        <Text style={styles.cardTitle}>{t('deptMgr.title')}</Text>
        {!editing && (
          <Pressable onPress={() => setEditing(true)} hitSlop={10} accessibilityRole="button">
            <Text style={styles.action}>{manager ? t('common.edit') : t('common.add')}</Text>
          </Pressable>
        )}
      </View>

      {editing ? (
        <>
          <Text style={styles.label}>{t('common.name')}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t('deptMgr.namePlaceholder')}
            placeholderTextColor={colors.slate400}
          />

          <Text style={styles.label}>{t('common.phone')}</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={(t) => setPhone(t.replace(/\D/g, ''))}
            placeholder={t('deptMgr.tenDigits')}
            placeholderTextColor={colors.slate400}
            keyboardType="number-pad"
            maxLength={10}
          />

          <Text style={styles.label}>{t('common.email')}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="name@example.com"
            placeholderTextColor={colors.slate400}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!error && problem ? <Text style={styles.hint}>{problem}</Text> : null}

          <View style={styles.buttons}>
            <Pressable
              onPress={() => setEditing(false)}
              style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.btnGhostText}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={() => save.mutate()}
              disabled={!!problem || save.isPending}
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrimary,
                (!!problem || save.isPending) && styles.btnDisabled,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.btnPrimaryText}>
                {save.isPending ? t('common.saving') : t('common.save')}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.note}>
            {t('deptMgr.hint')}
          </Text>
        </>
      ) : manager ? (
        <>
          <Text style={styles.name}>{manager.name ?? t('deptMgr.unnamed')}</Text>
          <View style={styles.contacts}>
            {manager.phone ? (
              <Pressable
                onPress={() => Linking.openURL(`tel:${manager.phone}`)}
                style={({ pressed }) => [styles.contact, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Ionicons name="call-outline" size={15} color={colors.brand[700]} />
                <Text style={styles.contactText}>{manager.phone}</Text>
              </Pressable>
            ) : null}
            {manager.email ? (
              <Pressable
                onPress={() => Linking.openURL(`mailto:${manager.email}`)}
                style={({ pressed }) => [styles.contact, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Ionicons name="mail-outline" size={15} color={colors.brand[700]} />
                <Text style={styles.contactText} numberOfLines={1}>
                  {manager.email}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : (
        <Text style={styles.empty}>
          {t('deptMgr.empty')}
        </Text>
      )}
    </Card>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    cardTitle: {
      fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4,
      color: colors.slate500,
    },
    action: { fontSize: 11.5, fontWeight: '800', color: colors.brand[700] },

    name: { fontSize: 14, fontWeight: '800', color: colors.textLight },
    contacts: { gap: 8, marginTop: 8 },
    contact: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    contactText: { fontSize: 12.5, fontWeight: '700', color: colors.brand[700] },
    empty: { fontSize: 11.5, color: colors.slate400, lineHeight: 17 },

    label: {
      fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3,
      color: colors.slate400, marginTop: 10, marginBottom: 5,
    },
    input: {
      borderWidth: 1, borderColor: colors.slate200, borderRadius: radii.md,
      paddingHorizontal: 12, paddingVertical: 10,
      fontSize: 13, color: colors.textLight, backgroundColor: colors.surface,
    },
    error: { fontSize: 11.5, color: colors.danger, fontWeight: '600', marginTop: 8 },
    hint: { fontSize: 11, color: colors.slate400, fontWeight: '600', marginTop: 8 },

    buttons: { flexDirection: 'row', gap: 10, marginTop: 14 },
    btn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: radii.md },
    btnGhost: { borderWidth: 1.5, borderColor: colors.slate200 },
    btnGhostText: { fontSize: 13, fontWeight: '700', color: colors.slate600 },
    btnPrimary: { backgroundColor: colors.brand[700] },
    btnPrimaryText: { fontSize: 13, fontWeight: '800', color: colors.white },
    btnDisabled: { opacity: 0.5 },
    pressed: { opacity: 0.7 },

    note: { fontSize: 10.5, color: colors.slate400, marginTop: 10, lineHeight: 15 },
  });
