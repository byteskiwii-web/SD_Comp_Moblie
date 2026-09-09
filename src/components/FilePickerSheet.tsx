import React, { useMemo } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ColorScheme, radii } from '../theme/tokens';
import { useThemeStore } from '../stores/themeStore';
import type { PickedFile } from '../api/documents.api';

/**
 * Three ways to attach the same thing: camera, photo library, files.
 *
 * Which one people reach for depends entirely on the document. A cancelled
 * cheque is in somebody's hand, so it wants the camera. An Aadhaar card is
 * usually already a screenshot, so it wants the library. A bank statement
 * arrives as a PDF by email, so it wants the file browser — and a picker that
 * only opened the camera roll would leave that person stuck.
 *
 * Both pickers are Expo SDK modules present in the Expo Go runtime, but they
 * are still required LAZILY, behind the same rule the camera capture screen
 * follows: a module that throws at import takes the whole screen down with it,
 * and a missing attachment option should degrade to a message rather than a
 * blank app. See src/native/runtime.ts.
 */

type Source = 'camera' | 'library' | 'file';

const MAX_BYTES = 8 * 1024 * 1024;

/** Filename from a uri when the picker does not supply one. */
function nameFromUri(uri: string, fallbackExt: string) {
  const tail = uri.split('/').pop() ?? '';
  return tail.includes('.') ? tail : `upload-${Date.now()}.${fallbackExt}`;
}

async function pickFromCamera(): Promise<PickedFile | null> {
  const ImagePicker = require('expo-image-picker');
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Camera needed', 'Allow camera access to photograph the document.');
    return null;
  }
  const res = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  return {
    uri: a.uri,
    name: a.fileName ?? nameFromUri(a.uri, 'jpg'),
    mimeType: a.mimeType ?? 'image/jpeg',
  };
}

async function pickFromLibrary(): Promise<PickedFile | null> {
  const ImagePicker = require('expo-image-picker');
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Photos needed', 'Allow photo access to attach an existing picture.');
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: false });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  return {
    uri: a.uri,
    name: a.fileName ?? nameFromUri(a.uri, 'jpg'),
    mimeType: a.mimeType ?? 'image/jpeg',
  };
}

async function pickFile(): Promise<PickedFile | null> {
  const DocumentPicker = require('expo-document-picker');
  const res = await DocumentPicker.getDocumentAsync({
    type: ['image/*', 'application/pdf'],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  return {
    uri: a.uri,
    name: a.name ?? nameFromUri(a.uri, 'pdf'),
    mimeType: a.mimeType ?? 'application/pdf',
  };
}

export function FilePickerSheet({
  visible,
  onClose,
  onPicked,
  title = 'Attach a document',
}: {
  visible: boolean;
  onClose: () => void;
  onPicked: (file: PickedFile) => void;
  title?: string;
}) {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const choose = async (source: Source) => {
    try {
      const picked =
        source === 'camera'
          ? await pickFromCamera()
          : source === 'library'
            ? await pickFromLibrary()
            : await pickFile();

      // A cancelled picker is not an error and must not close over an empty
      // selection -- the sheet simply stays put.
      if (!picked) return;

      // Checked here because the server's own refusal costs an upload of
      // however many megabytes before it says no, over mobile data.
      const size = await sizeOf(picked.uri);
      if (size !== null && size > MAX_BYTES) {
        Alert.alert(
          'File too large',
          `That file is ${(size / 1024 / 1024).toFixed(1)} MB. Attach something under 8 MB — a photo taken in the app is usually well under.`
        );
        return;
      }

      onClose();
      onPicked(picked);
    } catch (err) {
      Alert.alert('Could not attach that', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.bar}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={colors.slate500} />
          </Pressable>
        </View>

        <Option icon="camera-outline" label="Take a photo" hint="Use the camera now" onPress={() => choose('camera')} />
        <Option
          icon="images-outline"
          label="Choose from photos"
          hint="Pick an existing picture"
          onPress={() => choose('library')}
        />
        <Option
          icon="document-outline"
          label="Choose a file"
          hint="Images or PDF"
          onPress={() => choose('file')}
          last
        />
      </View>
    </Modal>
  );
}

/** Best-effort size read; a picker that cannot report one is not a failure. */
async function sizeOf(uri: string): Promise<number | null> {
  try {
    const FileSystem = require('expo-file-system');
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    return typeof info?.size === 'number' ? info.size : null;
  } catch {
    return null;
  }
}

function Option({
  icon,
  label,
  hint,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  onPress: () => void;
  last?: boolean;
}) {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.option, !last && styles.optionDivided, pressed && styles.optionPressed]}
      accessibilityRole="button"
    >
      <View style={styles.optionIcon}>
        <Ionicons name={icon} size={19} color={colors.brand[700]} />
      </View>
      <View style={styles.optionText}>
        <Text style={styles.optionLabel}>{label}</Text>
        <Text style={styles.optionHint}>{hint}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.slate300} />
    </Pressable>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    backdrop: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15,23,42,0.35)',
    },
    sheet: {
      position: 'absolute', left: 0, right: 0, bottom: 0,
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
      paddingBottom: 28,
    },
    bar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: colors.slate100,
    },
    title: { fontSize: 14, fontWeight: '800', color: colors.textLight },

    option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
    optionDivided: { borderBottomWidth: 1, borderBottomColor: colors.slate100 },
    optionPressed: { backgroundColor: colors.slate50 },
    optionIcon: {
      width: 36, height: 36, borderRadius: radii.md, backgroundColor: colors.brand[50],
      alignItems: 'center', justifyContent: 'center',
    },
    optionText: { flex: 1 },
    optionLabel: { fontSize: 13, fontWeight: '700', color: colors.textLight },
    optionHint: { fontSize: 11, color: colors.slate400, marginTop: 2 },
  });
}
