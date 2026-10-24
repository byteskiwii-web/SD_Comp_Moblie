import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SectionScreen } from '../SectionScreen';
import { Button, Card } from '../../../components/ui';
import { RadioRow } from '../../../components/RadioRow';
import { ColorScheme } from '../../../theme/tokens';
import { useThemeStore } from '../../../stores/themeStore';
import { useAuthStore } from '../../../stores/authStore';
import { useT, type TKey } from '../../../i18n';
import { formatDate } from '../../../utils/datetime';
import { getApiErrorCode, getApiErrorMessage } from '../../../api/client';
import { cancelPhoneChange, requestPhoneChange, type PhoneChangeReason } from '../../../api/devices.api';
import { phoneCheckApplies, phoneStatusQueryKey, usePhoneStatus } from '../../../hooks/usePhoneStatus';

const REASONS: PhoneChangeReason[] = ['new-phone', 'reinstalled', 'lost-or-broken', 'other'];
const NOTE_MIN = 5;

/**
 * "This phone": whether it is the phone registered for attendance, and -- when
 * it is not -- the request that asks HR to make it so (backend:
 * modules/devices/phone.service.js). The request is raised FROM this phone, so
 * HR's approval registers exactly this one; the current phone keeps working
 * until then. One pending request at a time, cancellable while pending.
 */
export function PhoneScreen() {
  const t = useT();
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const employeeId = useAuthStore((s) => s.employee?.id);
  const queryClient = useQueryClient();
  const status = usePhoneStatus();
  const [reason, setReason] = useState<PhoneChangeReason | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');

  useFocusEffect(
    React.useCallback(() => {
      void status.refetch();
      // refetch is stable across renders (react-query)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: phoneStatusQueryKey(employeeId) });

  const send = useMutation({
    mutationFn: () => requestPhoneChange({ reason: reason as PhoneChangeReason, note: note.trim() || undefined }),
    onSuccess: () => {
      setError('');
      setSent(t('phone.sent'));
      setReason(null);
      setNote('');
      void refresh();
    },
    onError: (err) => {
      setError(getApiErrorMessage(err));
      const code = getApiErrorCode(err);
      if (code === 'PHONE_CHANGE_PENDING' || code === 'PHONE_ALREADY_REGISTERED' || code === 'PHONE_CHANGE_NOT_NEEDED') void refresh();
    },
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelPhoneChange(id),
    onSuccess: () => { setSent(''); void refresh(); },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const data = status.data;
  const pending = data?.request?.status === 'pending' ? data.request : null;
  const rejected = data?.request?.status === 'rejected' ? data.request : null;
  const canRequest = !!data && (data.state === 'other-phone' || data.state === 'other-employee') && !pending;
  const noteOk = reason !== 'other' || note.trim().length >= NOTE_MIN;

  const confirmCancel = (id: string) =>
    Alert.alert(t('phone.cancelConfirmTitle'), undefined, [
      { text: t('common.close'), style: 'cancel' },
      { text: t('phone.cancel'), style: 'destructive', onPress: () => cancel.mutate(id) },
    ]);

  let icon: keyof typeof Ionicons.glyphMap = 'phone-portrait-outline';
  let tone = colors.slate600;
  let line = '';
  if (data && phoneCheckApplies(data)) {
    if (data.state === 'registered') {
      icon = 'checkmark-circle';
      tone = colors.successText;
      line = t('phone.registered');
    } else if (data.state === 'unregistered') {
      line = t('phone.unregistered');
    } else if (data.state === 'other-employee') {
      icon = 'alert-circle';
      tone = colors.warningText;
      line = t('phone.otherEmployee');
    } else {
      icon = 'alert-circle';
      tone = colors.warningText;
      line = data.registeredPhone?.model
        ? t('phone.otherPhone', { model: data.registeredPhone.model, date: formatDate(data.registeredPhone.registeredAt) })
        : t('phone.otherPhoneNoModel');
    }
  }

  return (
    <SectionScreen title={t('phone.title')}>
      <Card>
        {status.isLoading && !data ? (
          <Text style={styles.muted}>{t('common.loading')}</Text>
        ) : !data ? (
          <Text style={styles.muted}>{t('phone.loadFailed')}</Text>
        ) : (
          <>
            <View style={styles.row}>
              <Ionicons name={icon} size={20} color={tone} />
              <Text style={[styles.line, { color: tone === colors.slate600 ? colors.textLight : tone }]}>{line}</Text>
            </View>
            {data.state === 'registered' && data.registeredPhone?.registeredAt ? (
              <Text style={styles.muted}>{t('phone.registeredSince', { date: formatDate(data.registeredPhone.registeredAt) })}</Text>
            ) : null}
          </>
        )}
      </Card>

      {pending ? (
        <Card>
          <Text style={styles.body}>{t('phone.pending', { date: formatDate(pending.requestedAt) })}</Text>
          <View style={styles.gap}>
            <Button title={t('phone.cancel')} variant="outline" loading={cancel.isPending} onPress={() => confirmCancel(pending.id)} />
          </View>
        </Card>
      ) : null}

      {canRequest ? (
        <Card>
          {rejected?.decisionNote ? (
            <Text style={styles.rejected}>{t('phone.rejected', { note: rejected.decisionNote })}</Text>
          ) : null}
          <Text style={styles.body}>{t('phone.requestIntro')}</Text>
          <Text style={styles.label}>{t('phone.reasonLabel')}</Text>
          {REASONS.map((r) => (
            <RadioRow
              key={r}
              selected={reason === r}
              label={t(`phone.reason.${r}` as TKey)}
              onPress={() => { setReason(r); if (error) setError(''); }}
            />
          ))}
          {reason ? (
            <TextInput
              value={note}
              onChangeText={(v) => { setNote(v); if (error) setError(''); }}
              placeholder={t('phone.notePlaceholder')}
              placeholderTextColor={colors.slate400}
              multiline
              maxLength={500}
              editable={!send.isPending}
              style={styles.note}
              accessibilityLabel={t('phone.notePlaceholder')}
            />
          ) : null}
          {reason === 'other' && !noteOk ? <Text style={styles.hint}>{t('phone.noteRequired')}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.gap}>
            <Button
              title={t('phone.send')}
              loading={send.isPending}
              disabled={!reason || !noteOk || send.isPending}
              onPress={() => { setSent(''); send.mutate(); }}
            />
          </View>
        </Card>
      ) : null}

      {sent ? <Text style={styles.success}>{sent}</Text> : null}
      {!canRequest && error ? <Text style={styles.error}>{error}</Text> : null}
    </SectionScreen>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    line: { flex: 1, fontSize: 13.5, lineHeight: 19, fontWeight: '600' },
    muted: { fontSize: 12, color: colors.slate600, marginTop: 6 },
    body: { fontSize: 12.5, lineHeight: 18, color: colors.textLight, marginBottom: 10 },
    label: { fontSize: 12, fontWeight: '700', color: colors.slate600, marginBottom: 6 },
    note: {
      borderWidth: 1, borderColor: colors.slate300, borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 10, marginTop: 8,
      minHeight: 56, textAlignVertical: 'top',
      fontSize: 13.5, color: colors.textLight, backgroundColor: colors.surface,
    },
    hint: { fontSize: 11, color: colors.slate600, marginTop: 6 },
    rejected: { fontSize: 12, lineHeight: 17, color: colors.dangerText, marginBottom: 10 },
    error: { color: colors.dangerText, fontSize: 11.5, fontWeight: '600', marginTop: 10 },
    success: { color: colors.successText, fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 4 },
    gap: { marginTop: 12 },
  });
