import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';
import { useFaceDetectorOutput } from 'react-native-vision-camera-face-detector';
import { Button } from '../../components/ui';
import { colors, radii } from '../../theme/tokens';
import { useLiveness } from '../../hooks/useLiveness';
import type { CameraCaptureProps } from './cameraCaptureTypes';

type Props = CameraCaptureProps;

const CHALLENGE_LABEL: Record<string, string> = {
  'looking-for-face': 'Center your face in the frame',
  'challenge-blink': 'Blink to continue',
  'challenge-turn': 'Slowly turn your head',
  timeout: "Couldn't verify — try again",
};

export function VisionCameraCaptureScreen({ onCaptured, onCancel }: Props) {
  const insets = useSafeAreaInsets();
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
        <Text style={styles.permissionText}>Camera access is needed to verify your identity.</Text>
        <Button title="Grant camera access" onPress={requestPermission} />
        <Button title="Cancel" variant="outline" onPress={onCancel} />
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>No front camera found on this device.</Text>
        <Button title="Cancel" variant="outline" onPress={onCancel} />
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
          <ActivityIndicator color={colors.white} size="large" />
        ) : (
          <Text style={styles.challengeText}>{CHALLENGE_LABEL[state]}</Text>
        )}

        {state === 'timeout' && !captured && (
          <Button title="Try again" onPress={reset} />
        )}

        <View style={styles.cancelWrap}>
          <Button title="Cancel" variant="outline" onPress={onCancel} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: colors.textLight,
  },
  permissionText: { color: colors.white, fontSize: 14, textAlign: 'center', marginBottom: 8 },
  viewfinder: { position: 'absolute', left: 32, right: 32 },
  corner: { position: 'absolute', width: 32, height: 32, borderColor: colors.white },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  topBar: {
    position: 'absolute', left: 0, right: 0, alignItems: 'center',
  },
  topBarText: {
    color: colors.white, fontSize: 12, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill, overflow: 'hidden',
  },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 24,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', gap: 12,
  },
  challengeText: { color: colors.white, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  cancelWrap: { width: '100%', marginTop: 4 },
});
