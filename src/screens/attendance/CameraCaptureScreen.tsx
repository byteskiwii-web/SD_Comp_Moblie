import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';
import { useFaceDetectorOutput } from 'react-native-vision-camera-face-detector';
import { Button } from '../../components/ui';
import { colors } from '../../theme/tokens';
import { useLiveness } from '../../hooks/useLiveness';

type Props = {
  onCaptured: (filePath: string) => void;
  onCancel: () => void;
};

const CHALLENGE_LABEL: Record<string, string> = {
  'looking-for-face': 'Center your face in the frame',
  'challenge-blink': 'Blink to continue',
  'challenge-turn': 'Slowly turn your head',
  passed: 'Captured!',
  timeout: "Couldn't verify — try again",
};

export function CameraCaptureScreen({ onCaptured, onCancel }: Props) {
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();
  const photoOutput = usePhotoOutput({ quality: 0.8 });
  const [capturing, setCapturing] = useState(false);
  const capturedRef = useRef(false);

  const takePhoto = useCallback(async () => {
    if (capturedRef.current) return;
    capturedRef.current = true;
    setCapturing(true);
    try {
      const file = await photoOutput.capturePhotoToFile({}, {});
      onCaptured(file.filePath);
    } catch (err) {
      console.warn('[CameraCaptureScreen] capture failed', err);
      capturedRef.current = false;
      setCapturing(false);
    }
  }, [photoOutput, onCaptured]);

  const { state, challenge, onFacesDetected, reset } = useLiveness(takePhoto);

  const faceDetectorOutput = useFaceDetectorOutput({
    performanceMode: 'fast',
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
        isActive={!capturing}
        outputs={[photoOutput, faceDetectorOutput]}
      />

      {/* Corner-bracket viewfinder, ported from the prototype's CameraCapture UI */}
      <View pointerEvents="none" style={styles.viewfinder}>
        <View style={[styles.corner, styles.cornerTL]} />
        <View style={[styles.corner, styles.cornerTR]} />
        <View style={[styles.corner, styles.cornerBL]} />
        <View style={[styles.corner, styles.cornerBR]} />
      </View>

      <View style={styles.topBar}>
        <Text style={styles.topBarText}>Live selfie · liveness check</Text>
      </View>

      <View style={styles.bottomBar}>
        {capturing ? (
          <ActivityIndicator color={colors.white} size="large" />
        ) : (
          <Text style={styles.challengeText}>{CHALLENGE_LABEL[state]}</Text>
        )}

        {state === 'timeout' && !capturing && (
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
  viewfinder: { position: 'absolute', top: 80, left: 32, right: 32, bottom: 180 },
  corner: { position: 'absolute', width: 32, height: 32, borderColor: colors.white },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  topBar: { position: 'absolute', top: 48, left: 0, right: 0, alignItems: 'center' },
  topBarText: { color: colors.white, fontSize: 12, fontWeight: '600', opacity: 0.85 },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 40,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', gap: 12,
  },
  challengeText: { color: colors.white, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  cancelWrap: { width: '100%', marginTop: 4 },
});
