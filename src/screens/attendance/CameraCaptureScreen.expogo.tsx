import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/ui';
import { colors, radii } from '../../theme/tokens';

// Mirrors the real CameraCaptureScreen's props so ClockPanel can swap one for
// the other without knowing which it got. Declared here rather than imported
// from the real screen so this file pulls in nothing native.
export type CameraCaptureProps = {
  onCaptured: (filePath: string) => void;
  onCancel: () => void;
};

// Stand-in used only inside Expo Go, which has no VisionCamera or face
// detector. Selfie punches genuinely cannot be completed there -- the point is
// that every other screen stays reachable for review instead of the whole app
// failing to boot.
export function CameraCaptureScreen({ onCancel }: CameraCaptureProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.wrap,
        { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 },
      ]}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Camera not available in Expo Go</Text>
        <Text style={styles.body}>
          Face verification needs the native camera module, which only exists in
          a development or preview build. Shift punches can't be completed here.
        </Text>
        <Text style={styles.body}>
          Everything else -- login, KYC, history and profile -- works normally.
        </Text>
      </View>
      <Button title="Go back" onPress={onCancel} variant="outline" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 24,
    backgroundColor: colors.white,
  },
  card: {
    gap: 12,
    padding: 20,
    borderRadius: radii.md,
    backgroundColor: colors.warningBg,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.slate800 },
  body: { fontSize: 13, lineHeight: 19, color: colors.slate800 },
});
