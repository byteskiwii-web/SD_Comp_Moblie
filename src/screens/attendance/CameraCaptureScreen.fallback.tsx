import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button } from '../../components/ui';
import { colors, radii } from '../../theme/tokens';
import { runtimeLabel } from '../../native/runtime';
import type { CameraCaptureProps } from './cameraCaptureTypes';

// Plain expo-camera capture for runtimes that have no VisionCamera: Expo Go
// and web. expo-camera is bundled with the Expo Go binary, so importing it
// here is safe where importing the real screen is not.
//
// The trade-off is deliberate and visible: this takes a still photo with no
// face detection and no liveness challenge, so it verifies nothing about who
// is holding the phone. That is why the banner below is permanent -- this is
// a review/demo path, not something to attend real shifts with.
export function FallbackCameraCaptureScreen({ onCaptured, onCancel }: CameraCaptureProps) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  // Ref, not state: a double-tap lands both handlers before React re-renders,
  // and a second takePictureAsync() against a camera that is already writing
  // rejects. Same reasoning as the VisionCamera screen's capturedRef.
  const capturingRef = useRef(false);
  const [busy, setBusy] = useState(false);

  const takePhoto = useCallback(async () => {
    if (capturingRef.current) return;
    capturingRef.current = true;
    setBusy(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) throw new Error('camera returned no image');
      // Left latched on success -- the parent unmounts this screen straight
      // away, so there is nothing to reset and re-entry must stay blocked.
      onCaptured(photo.uri);
    } catch (err) {
      console.warn('[CameraCaptureScreen.fallback] capture failed', err);
      capturingRef.current = false;
      setBusy(false);
    }
  }, [onCaptured]);

  // null while the permission hook is still resolving -- distinct from denied.
  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.white} size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>
          {permission.canAskAgain
            ? 'Camera access is needed to verify your identity.'
            : 'Camera access was denied. Enable it for this app in your device settings, then try again.'}
        </Text>
        {permission.canAskAgain && (
          <Button title="Grant camera access" onPress={requestPermission} />
        )}
        <Button title="Cancel" variant="outline" onPress={onCancel} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />

      {/* Corner-bracket viewfinder, matching the VisionCamera screen */}
      <View
        pointerEvents="none"
        style={[styles.viewfinder, { top: insets.top + 110, bottom: 140 + insets.bottom }]}
      >
        <View style={[styles.corner, styles.cornerTL]} />
        <View style={[styles.corner, styles.cornerTR]} />
        <View style={[styles.corner, styles.cornerBL]} />
        <View style={[styles.corner, styles.cornerBR]} />
      </View>

      <View style={[styles.topBar, { top: insets.top + 12 }]}>
        <Text style={styles.topBarText}>Live selfie</Text>
      </View>

      <View style={[styles.banner, { top: insets.top + 48 }]} pointerEvents="none">
        <Text style={styles.bannerText}>
          No liveness check on {runtimeLabel} — a photo of a photo would pass
        </Text>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: 20 + insets.bottom }]}>
        {busy ? (
          <ActivityIndicator color={colors.white} size="large" />
        ) : (
          <Text style={styles.hintText}>Center your face in the frame</Text>
        )}

        <View style={styles.actionWrap}>
          <Button title="Take photo" onPress={takePhoto} disabled={busy} loading={busy} />
        </View>
        <View style={styles.actionWrap}>
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
  topBar: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  topBarText: {
    color: colors.white, fontSize: 12, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill, overflow: 'hidden',
  },
  banner: {
    position: 'absolute', left: 16, right: 16, backgroundColor: colors.warning,
    borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 8,
  },
  bannerText: {
    color: colors.slate900, fontSize: 12, fontWeight: '700', textAlign: 'center', lineHeight: 17,
  },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 24,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', gap: 12,
  },
  hintText: { color: colors.white, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  actionWrap: { width: '100%' },
});
