import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';
import { useFaceDetectorOutput } from 'react-native-vision-camera-face-detector';
import { Button } from '../../components/ui';
import { radii } from '../../theme/tokens';
import { useLiveness } from '../../hooks/useLiveness';
import type { CameraCaptureProps } from './cameraCaptureTypes';
import { useT, type TKey } from '../../i18n';

type Props = CameraCaptureProps;

const CHALLENGE_KEY: Record<string, TKey> = {
  'looking-for-face': 'camera.centreFace',
  'challenge-blink': 'camera.blinkToContinue',
  'challenge-turn': 'camera.turnHead',
  timeout: 'camera.timedOut',
};

export function VisionCameraCaptureScreen({ onCaptured, onCancel }: Props) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();
  const photoOutput = usePhotoOutput({ quality: 0.8 });
  // Only ever set to true AFTER a successful capture -- a re-render at that
  // point is harmless since the parent immediately tears this screen down.
  // Setting it beforehand would race the in-flight capturePhotoToFile() call
  // (see useLiveness.ts for the full explanation).
  const [captured, setCaptured] = useState(false);
  const capturedRef = useRef(false);

  const takePhoto = useCallback(async () => {
    if (capturedRef.current) return;
    capturedRef.current = true;
    try {
      const file = await photoOutput.capturePhotoToFile({}, {});
      setCaptured(true);
      onCaptured(file.filePath);
    } catch (err) {
      console.warn('[CameraCaptureScreen] capture failed', err);
      capturedRef.current = false;
      // eslint-disable-next-line @typescript-eslint/no-use-before-define -- `reset` is stable across renders; referencing it here (not in the deps array) avoids a circular hook dependency with useLiveness below.
      reset();
    }
  }, [photoOutput, onCaptured]);

  const { state, challenge, onFacesDetected, reset } = useLiveness(takePhoto);

  const faceDetectorOutput = useFaceDetectorOutput({
    performanceMode: 'fast',
    // Required for leftEyeOpenProbability/rightEyeOpenProbability (blink
    // detection) -- ML Kit doesn't compute these unless classification is
    // explicitly enabled; they're `undefined` otherwise.
    runClassifications: true,
    onFacesDetected,
    onError: (err) => console.warn('[CameraCaptureScreen] face detector error', err),
  });

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>{t('camera.needed')}</Text>
        <Button title={t('camera.grant')} onPress={requestPermission} />
        <Button title={t('common.cancel')} variant="outline" onPress={onCancel} />
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>{t('camera.noFront')}</Text>
        <Button title={t('common.cancel')} variant="outline" onPress={onCancel} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        outputs={[photoOutput, faceDetectorOutput]}
      />

      {/* Corner-bracket viewfinder, ported from the prototype's CameraCapture UI */}
      <View
        pointerEvents="none"
        style={[styles.viewfinder, { top: insets.top + 70, bottom: 140 + insets.bottom }]}
      >
        <View style={[styles.corner, styles.cornerTL]} />
        <View style={[styles.corner, styles.cornerTR]} />
        <View style={[styles.corner, styles.cornerBL]} />
        <View style={[styles.corner, styles.cornerBR]} />
      </View>

      <View style={[styles.topBar, { top: insets.top + 12 }]}>
        <Text style={styles.topBarText}>Live selfie · liveness check</Text>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: 20 + insets.bottom }]}>
        {captured ? (
          <ActivityIndicator color="#FFFFFF" size="large" />
        ) : (
          <Text style={styles.challengeText}>{t(CHALLENGE_KEY[state])}</Text>
        )}

        {state === 'timeout' && !captured && (
          <Button title={t('common.retry')} onPress={reset} />
        )}

        <View style={styles.cancelWrap}>
          <Button title={t('common.cancel')} variant="outline" onPress={onCancel} />
        </View>
      </View>
    </View>
  );
}

// This screen is a full-screen camera viewfinder overlaid on a live feed, not
// a themed app surface -- its colors are fixed regardless of the app's
// light/dark setting, the same way the '#000' backdrop below is. Reading them
// from useThemeStore would invert the neutral ramp under dark mode and turn
// this dark overlay pale (the same bug once found on Home's heroInactive).
const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: '#0F172A',
  },
  permissionText: { color: '#FFFFFF', fontSize: 12.5, textAlign: 'center', marginBottom: 8 },
  viewfinder: { position: 'absolute', left: 32, right: 32 },
  corner: { position: 'absolute', width: 32, height: 32, borderColor: '#FFFFFF' },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  topBar: {
    position: 'absolute', left: 0, right: 0, alignItems: 'center',
  },
  topBarText: {
    color: '#FFFFFF', fontSize: 11, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill, overflow: 'hidden',
  },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 24,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', gap: 12,
  },
  challengeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  cancelWrap: { width: '100%', marginTop: 4 },
});
