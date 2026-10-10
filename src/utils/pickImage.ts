import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { t as tr } from '../i18n';
import type { PickedFile } from '../api/documents.api';

/**
 * The app's one "take a photo or choose one from the gallery" primitive —
 * moved out of ProfilePhoto.tsx (where it started, avatar-only) so
 * RegularisePanel.tsx can use the exact same picker for a regularisation's
 * supporting photo rather than a second, slightly different copy.
 *
 * Deliberately `expo-image-picker`, not CameraCaptureScreen.*: this is the
 * plain system camera/gallery, with NO liveness or face-detection challenge
 * at all. A regularisation photo is evidence (a visit slip, a screenshot),
 * not an identity check, and CameraCaptureScreen's vision path hard-wires a
 * mandatory two-blink challenge with no way to skip it — wrong tool here.
 */

export type PickImageOptions = {
  /** JPEG compression, 0–1. */
  quality?: number;
  /** Whether the system picker lets the user crop before returning. */
  allowsEditing?: boolean;
  /** Only meaningful with allowsEditing. */
  aspect?: [number, number];
  /** Longest edge after the optional resize step, in pixels. */
  maxEdgePx?: number;
};

const DEFAULT_MAX_EDGE_PX = 1024;

/**
 * Resizes down to `maxEdgePx` on the longest side. Loaded lazily and allowed
 * to fail: expo-image-manipulator is in Expo Go, but an APK built before it
 * was added does not have the native half, and requiring it there throws.
 * Such a build uploads the original, as before.
 */
async function shrinkTo(uri: string, maxEdgePx: number, width?: number, height?: number): Promise<string | null> {
  // The picker reports 0 when the system did not say; only skip when it did.
  if (width && height && Math.max(width, height) <= maxEdgePx) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ImageManipulator, SaveFormat } = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
    const context = ImageManipulator.manipulate(uri);
    context.resize((width ?? 0) >= (height ?? 0) ? { width: maxEdgePx } : { height: maxEdgePx });
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.82 });
    return saved.uri;
  } catch (err) {
    console.warn('[pickImage] could not resize the picture; using the original', err);
    return null;
  }
}

/**
 * Launches the camera or the system photo picker and returns what was
 * chosen, or null on cancel/refusal.
 *
 * ONLY THE CAMERA ASKS PERMISSION (STORE-024 / STORE-031). The system
 * library picker (Android photo picker / GET_CONTENT, iOS PHPicker) hands
 * back only what the person chooses and needs no permission grant — on
 * Android 12 and below the old media-library permission was for
 * WRITE_EXTERNAL_STORAGE, which app.json deliberately blocks, so requesting
 * it always failed.
 */
export async function pickImage(from: 'camera' | 'library', opts: PickImageOptions = {}): Promise<PickedFile | null> {
  // Required lazily: expo-image-picker registers native handlers at module
  // scope and a static import has broken startup on Android before.
  const ImagePicker = require('expo-image-picker');

  if (from === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(tr('file.cameraNeeded'), tr('file.cameraNeededBody'));
      return null;
    }
  }

  const pickerOpts: Record<string, unknown> = { quality: opts.quality ?? 0.7 };
  if (opts.allowsEditing) {
    pickerOpts.allowsEditing = true;
    if (opts.aspect) pickerOpts.aspect = opts.aspect;
  }

  const res =
    from === 'camera'
      ? await ImagePicker.launchCameraAsync(pickerOpts)
      : await ImagePicker.launchImageLibraryAsync(pickerOpts);

  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const shrunk = await shrinkTo(a.uri, opts.maxEdgePx ?? DEFAULT_MAX_EDGE_PX, a.width, a.height);
  if (shrunk) {
    return { uri: shrunk, name: `photo-${Date.now()}.jpg`, mimeType: 'image/jpeg' };
  }
  return {
    uri: a.uri,
    name: a.fileName ?? `photo-${Date.now()}.jpg`,
    mimeType: a.mimeType ?? 'image/jpeg',
  };
}

/**
 * The plain "Camera / Choose from Library / Cancel" source picker — the
 * two-option case. ProfilePhoto.tsx keeps its own three-option version
 * (it also offers "Remove photo"); this covers every caller that does not
 * need a third action.
 */
export function chooseImageSource(
  title: string,
  cameraLabel: string,
  libraryLabel: string,
  cancelLabel: string,
  onPick: (from: 'camera' | 'library') => void
): void {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: [cameraLabel, libraryLabel, cancelLabel], cancelButtonIndex: 2 },
      (i) => { if (i === 0) onPick('camera'); else if (i === 1) onPick('library'); }
    );
    return;
  }
  // Android has no action sheet primitive; Alert's button list is the
  // closest native equivalent and avoids pulling in a library for one menu.
  Alert.alert(title, undefined, [
    { text: cameraLabel, onPress: () => onPick('camera') },
    { text: libraryLabel, onPress: () => onPick('library') },
    { text: cancelLabel, style: 'cancel' },
  ]);
}
