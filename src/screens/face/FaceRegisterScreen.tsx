import React, { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui';
import { ColorScheme } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import { enrolFace, getFaceStatus } from '../../api/face.api';
import { getApiErrorMessage } from '../../api/client';
import { onboardingGateQueryKey } from '../../hooks/useOnboardingGate';
import { CameraCaptureScreen } from '../attendance/CameraCaptureScreen';
import { OnboardingStackParamList } from '../../navigation/types';
import { useT } from '../../i18n';

type Nav = NativeStackNavigationProp<OnboardingStackParamList, 'FaceRegister'>;

/**
 * Face enrolment: the employee's own photo, captured live under the same
 * liveness challenge a clock-in uses (CameraCaptureScreen + useLiveness),
 * turned into the template every future clock-in is matched against.
 *
 * CONSENT IS PER-ENROLMENT, NOT A DEVICE FLAG. Unlike background location's
 * BackgroundLocationDisclosure (persisted once in consentStore, shown at
 * most once per device), the server stamps a fresh, audited consent row
 * (employee_face_consent) on every /face/enrol call -- see
 * face.service.js#enrol. So the checkbox below starts unchecked every time
 * this screen opens, including a later re-enrolment: a re-taken photo is a
 * new consent event, not a continuation of the first one.
 *
 * RE-ENROLMENT IS THE SAME FLOW. Reached again from Profile (see KycCard.tsx)
 * after HR resets a template, or simply because the employee's appearance has
 * changed -- capturing a new photo supersedes the old template
 * (face.service.js's enrol() soft-deletes the previous row inside the same
 * transaction), so there is nothing here that branches on "first time" vs
 * "again" beyond the status banner below.
 */
export function FaceRegisterScreen() {
  const navigation = useNavigation<Nav>();
  const employee = useAuthStore((s) => s.employee);
  const queryClient = useQueryClient();
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  const statusQuery = useQuery({ queryKey: ['face-status', employee?.id], queryFn: getFaceStatus, enabled: !!employee });
  const alreadyRegistered = statusQuery.data?.status === 'registered';

  const [consentAccepted, setConsentAccepted] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // Same "closed is not the same as CLOSED" concern ClockPanel documents:
  // onCaptured fires the instant a frame lands on disk, before the Modal has
  // actually finished animating out, and enrolling from inside that window
  // has caused a stacked-modal freeze elsewhere in this app. One screen, one
  // Modal, no second one waiting behind it, so this is lower-risk than
  // ClockPanel's case -- but the flag still exists so a slow device cannot
  // fire the mutation from a capture callback twice.
  const submittedRef = useRef(false);

  const mutation = useMutation({
    mutationFn: (selfieFilePath: string) => enrolFace({ selfieFilePath, consent: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: onboardingGateQueryKey(employee?.id) });
      queryClient.invalidateQueries({ queryKey: ['face-status', employee?.id] });
      queryClient.invalidateQueries({ queryKey: ['profile-kyc-status', employee?.id] });
      setSuccess(t('face.success'));
      setTimeout(() => navigation.goBack(), 900);
    },
    onError: (err) => {
      setError(getApiErrorMessage(err));
      submittedRef.current = false;
    },
  });

  const handleCaptured = (filePath: string) => {
    setCameraOpen(false);
    if (submittedRef.current) return;
    submittedRef.current = true;
    setError('');
    mutation.mutate(filePath);
  };

  return (
    <SafeAreaView style={styles.flex}>
      <ScreenHeader title={t('face.title')} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.subtitle}>{t('face.intro')}</Text>

        {alreadyRegistered ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>{t('face.alreadyRegistered')}</Text>
          </View>
        ) : null}

        <Pressable style={styles.consentRow} onPress={() => setConsentAccepted((v) => !v)}>
          <View style={[styles.checkbox, consentAccepted && styles.checkboxChecked]}>
            {consentAccepted ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
          <Text style={styles.consentText}>{t('face.consent')}</Text>
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
            disabled={!consentAccepted || mutation.isPending}
          />
        </View>
        <Button title={t('common.back')} variant="outline" onPress={() => navigation.goBack()} />
      </ScrollView>

      <Modal visible={cameraOpen} animationType="slide" onRequestClose={() => setCameraOpen(false)}>
        <CameraCaptureScreen onCancel={() => setCameraOpen(false)} onCaptured={handleCaptured} />
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.bgLight },
    scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
    subtitle: {
      fontSize: 12.5,
      color: colors.slate600,
      textAlign: 'center',
      marginBottom: 20,
      lineHeight: 19,
    },
    infoCard: {
      backgroundColor: colors.brand[50],
      borderRadius: 10,
      padding: 12,
      marginBottom: 16,
    },
    infoText: { fontSize: 11.5, color: colors.slate700, lineHeight: 17, textAlign: 'center' },
    consentRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20, gap: 10 },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: colors.slate300,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    checkboxChecked: { backgroundColor: colors.brand[700], borderColor: colors.brand[700] },
    checkmark: { color: colors.white, fontSize: 11.5, fontWeight: '800' },
    consentText: { flex: 1, fontSize: 11, color: colors.slate600, lineHeight: 17 },
    successText: { color: colors.successText, fontSize: 11, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
    errorText: { color: colors.dangerText, fontSize: 11, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
    buttonGap: { marginBottom: 12 },
  });
}
