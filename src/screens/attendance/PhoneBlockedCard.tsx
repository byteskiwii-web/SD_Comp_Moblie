import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button } from '../../components/ui';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { useT } from '../../i18n';
import { formatDate } from '../../utils/datetime';
import type { PhoneStatus } from '../../api/devices.api';

/**
 * Said where Punch In is, before the camera opens: this phone cannot punch
 * (the server enforces the phone check and this is not the registered phone),
 * and the one way forward. A pending request says so instead of offering a
 * second one.
 */
export function PhoneBlockedCard({ status, onOpen }: { status: PhoneStatus; onOpen: () => void }) {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  const pending = status.request?.status === 'pending' ? status.request : null;
  const phone = status.registeredPhone;
  const body =
    status.state === 'other-employee'
      ? t('phone.otherEmployee')
      : phone?.model
        ? t('phone.otherPhone', { model: phone.model, date: formatDate(phone.registeredAt) })
        : t('phone.otherPhoneNoModel');

  return (
    <View style={styles.wrap} accessibilityRole="alert">
      <View style={styles.head}>
        <Ionicons name="phone-portrait-outline" size={17} color={colors.warningText} />
        <Text style={styles.title}>{t('phone.blockedTitle')}</Text>
      </View>
      <Text style={styles.body}>{body}</Text>
      {pending ? (
        <Text style={styles.pending}>{t('phone.pending', { date: formatDate(pending.requestedAt) })}</Text>
      ) : null}
      <View style={styles.action}>
        <Button title={pending ? t('phone.title') : t('phone.request')} variant="outline" onPress={onOpen} />
      </View>
    </View>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    wrap: {
      padding: 14,
      borderRadius: radii.md,
      backgroundColor: colors.warningBg,
      borderWidth: 1,
      borderColor: colors.warning,
      gap: 8,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: 13.5, fontWeight: '700', color: colors.warningText, flex: 1 },
    body: { fontSize: 12.5, lineHeight: 18, color: colors.textLight },
    pending: { fontSize: 12, lineHeight: 17, color: colors.slate600 },
    action: { marginTop: 2 },
  });
