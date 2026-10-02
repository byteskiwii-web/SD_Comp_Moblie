import React, { useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui';
import { ColorScheme } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import { cancelFaceChange, getMyFaceChange, requestFaceChange } from '../../api/face.api';
import { getApiErrorCode, getApiErrorDetails, getApiErrorMessage } from '../../api/client';
import { CameraCaptureScreen } from '../attendance/CameraCaptureScreen';
import { ProfileStackParamList } from '../../navigation/types';
import { useT } from '../../i18n';
import { formatDate } from '../../utils/datetime';

type Nav = NativeStackNavigationProp<ProfileStackParamList, 'FaceChangeRequest'>;

/**
 * "My face has changed" -- an ALREADY-registered employee's own front door,
 * as opposed to FaceRegisterScreen (first enrolment / HR-reset re-enrolment).
 * enrolFace() now refuses with FACE_ALREADY_REGISTERED once a face is on
 * file, so this is the only self-service path left, and it does not enrol
 * anything itself: it raises a request, the CURRENT face keeps working for
 * clock-in, and only HR's approval (comparing this new photo against the
 * stored one) installs it as the live template. See
 * src/face/faceChange.service.js's header on the backend.
 *
 * A REASON IS REQUIRED, same rule as HR's own reset -- it is what a reviewer
 * reads next to the two photos, not idle paperwork.
 *
 * If one is already pending, the server refuses with FACE_CHANGE_PENDING
 * before ever opening the camera would matter -- so this is checked on
 * SUBMIT, not on screen entry: an employee reaching this screen from a stale
 * KycCard render (before its own query refetched) still gets a clear choice
 * rather than a bare error.
 */
export function FaceChangeRequestScreen() {
  const navigation = useNavigation<Nav>();
  const employee = useAuthStore((s) => s.employee);
  const queryClient = useQueryClient();
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  const [reason, setReason] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // Same one-shot guard as FaceRegisterScreen's submittedRef -- see its
  // comment: onCaptured can fire before the Modal has finished closing.
  const submittedRef = useRef(false);

  const invalidateAfterDecisionRelevantQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['face-change-mine', employee?.id] });
    queryClient.invalidateQueries({ queryKey: ['profile-kyc-status', employee?.id] });
  };

  const mutation = useMutation({
    mutationFn: (selfieFilePath: string) => requestFaceChange({ selfieFilePath, reason: reason.trim() }),
    onSuccess: () => {
      invalidateAfterDecisionRelevantQueries();
      setSuccess(t('face.changeSuccess'));
      setTimeout(() => navigation.goBack(), 900);
    },
    onError: (err) => {
      submittedRef.current = false;
      if (getApiErrorCode(err) === 'FACE_CHANGE_PENDING') {
        invalidateAfterDecisionRelevantQueries();
        const details = getApiErrorDetails<{ requestedAt?: string; id?: string }>(err);
        Alert.alert(
          t('face.changePendingTitle'),
          t('face.changePendingBody', { date: details?.requestedAt ? formatDate(details.requestedAt) : '' }),
          [
            { text: t('common.close'), style: 'cancel' },
            {
              text: t('face.changePendingWithdraw'),
              onPress: () => void withdrawAndRetry(),
            },
          ]
        );
        return;
      }
      setError(getApiErrorMessage(err));
    },
  });

  // The 409's own details carry only `requestedAt` (see faceChange.service.js
  // -- it does not hand out the pending request's id to an unauthenticated-
  // for-that-row caller path). Re-fetching `mine` first is one extra round
  // trip, on a path already this rare, to withdraw the exact row rather than
  // guessing.
  const withdrawAndRetry = async () => {
    try {
      const mine = await getMyFaceChange();
      if (mine && mine.status === 'pending') await cancelFaceChange(mine.id);
      invalidateAfterDecisionRelevantQueries();
      setError('');
      submittedRef.current = false;
      setCameraOpen(true);
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  const handleCaptured = (filePath: string) => {
    setCameraOpen(false);
    if (submittedRef.current) return;
    submittedRef.current = true;
    setError('');
    mutation.mutate(filePath);
  };

  const reasonOk = reason.trim().length >= 5;

  return (
    <SafeAreaView style={styles.flex}>
      <ScreenHeader title={t('face.changeTitle')} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.subtitle}>{t('face.changeIntro')}</Text>

        <Text style={styles.label}>{t('face.changeReasonLabel')}</Text>
        <TextInput
          value={reason}
          onChangeText={(v) => { setReason(v); if (error) setError(''); }}
          placeholder={t('face.changeReasonPlaceholder')}
          placeholderTextColor={colors.slate400}
          multiline
          editable={!mutation.isPending}
          style={styles.reasonInput}
          accessibilityLabel={t('face.changeReasonLabel')}
        />

        <Pressable style={styles.consentRow} onPress={() => setConsentAccepted((v) => !v)}>
          <View style={[styles.checkbox, consentAccepted && styles.checkboxChecked]}>
            {consentAccepted ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
          <Text style={styles.consentText}>{t('face.changeConsent')}</Text>
        </Pressable>

        {success ? <Text style={styles.successText}>{success}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.buttonGap}>
            <Button
              title={t('face.openCamera')}
              onPress={() => {
                submittedRef.current = false;
                setError('');
                setCameraOpen(true);
              }}
              loading={mutation.isPending}
              disabled={!consentAccepted || !reasonOk || mutation.isPending}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={cameraOpen} animationType="slide" onRequestClose={() => setCameraOpen(false)}>
        <CameraCaptureScreen onCancel={() => setCameraOpen(false)} onCaptured={handleCaptured} />
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.bgLight },
    // paddingBottom generous on purpose, same reasoning as every other screen
    // touched for this: a focused field can only scroll as far above the
    // keyboard as there is scrollable content below it.
    scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 280 },
    subtitle: { fontSize: 12.5, color: colors.slate600, textAlign: 'center', marginBottom: 20, lineHeight: 19 },
    label: { fontSize: 12, fontWeight: '700', color: colors.slate600, marginBottom: 8 },
    reasonInput: {
      borderWidth: 1, borderColor: colors.slate300, borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 10, marginBottom: 20,
      minHeight: 64, textAlignVertical: 'top',
      fontSize: 13.5, color: colors.textLight, backgroundColor: colors.surface,
    },
    consentRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20, gap: 10 },
    checkbox: {
      width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.slate300,
      alignItems: 'center', justifyContent: 'center', marginTop: 1,
    },
    checkboxChecked: { backgroundColor: colors.brand[700], borderColor: colors.brand[700] },
    checkmark: { color: colors.white, fontSize: 11.5, fontWeight: '800' },
    consentText: { flex: 1, fontSize: 11, color: colors.slate600, lineHeight: 17 },
    successText: { color: colors.successText, fontSize: 11, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
    errorText: { color: colors.dangerText, fontSize: 11, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
    buttonGap: { marginBottom: 12 },
  });
}
