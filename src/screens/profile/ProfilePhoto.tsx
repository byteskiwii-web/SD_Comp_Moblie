import React, { useEffect, useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ColorScheme } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import { getApiErrorMessage } from '../../api/client';
import { profilePhotoUrl, removeProfilePhoto, uploadProfilePhoto } from '../../api/photo.api';
import type { PickedFile } from '../../api/documents.api';
import { t as tr, useT } from '../../i18n';
import { forgetProfilePhoto, useProfilePhotoFile } from '../../components/profilePhotoFile';
import { File } from 'expo-file-system';

/**
 * The avatar, and the way to change it.
 *
 * Replaces the initials circle that was there before — initials remain the
 * fallback, so an employee who never sets one sees exactly what they always
 * did rather than an empty grey ring.
 *
 * The picture is fetched through the API rather than from a Drive link,
 * because a link is a credential that outlives the session and cannot be
 * scoped. That means the request needs the Authorization header, which is why
 * the token is passed explicitly below — React Native's <Image> does not share
 * the axios client's interceptors.
 */

async function pickImage(from: 'camera' | 'library'): Promise<PickedFile | null> {
  // Required lazily, matching FilePickerSheet: expo-image-picker registers
  // native handlers at module scope and a static import has broken startup on
  // Android before.
  const ImagePicker = require('expo-image-picker');

  const perm =
    from === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(
      tr(from === 'camera' ? 'file.cameraNeeded' : 'file.photosNeeded'),
      tr(from === 'camera' ? 'file.cameraNeededBody' : 'file.photosNeededBody')
    );
    return null;
  }

  const opts = {
    quality: 0.6,
    allowsEditing: true,
    // Square, because every place this is shown is a circle. Cropping here
    // beats cropping in CSS, which would silently discard the sides of a
    // portrait photo without the employee ever seeing what was cut.
    aspect: [1, 1] as [number, number],
  };
  const res =
    from === 'camera'
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);

  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const shrunk = await shrinkForAvatar(a.uri, a.width, a.height);
  if (shrunk) {
    return { uri: shrunk, name: `profile-${Date.now()}.jpg`, mimeType: 'image/jpeg' };
  }
  return {
    uri: a.uri,
    name: a.fileName ?? `profile-${Date.now()}.jpg`,
    mimeType: a.mimeType ?? 'image/jpeg',
  };
}

/**
 * THE LARGEST PICTURE ANY SCREEN NEEDS.
 *
 * The picker hands back the camera's full resolution, and a square crop from
 * a 50 MP Android camera is roughly 6000 x 6000. Android would not draw that
 * at all -- "Saved, but it could not be displayed" -- and every team list
 * that shows the face downloaded all of it to paint a 34 px circle.
 *
 * 1024 px is several times the largest avatar on the densest screen.
 *
 * Loaded lazily and allowed to fail: expo-image-manipulator is in Expo Go,
 * but an APK built before it was added does not have the native half, and
 * requiring it there throws. Such a build uploads the original, as before;
 * the display side copes with that on its own (resizeMethod on the Image).
 */
const AVATAR_MAX_PX = 1024;

async function shrinkForAvatar(uri: string, width?: number, height?: number): Promise<string | null> {
  // The picker reports 0 when the system did not say; only skip when it did.
  if (width && height && Math.max(width, height) <= AVATAR_MAX_PX) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ImageManipulator, SaveFormat } = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
    const context = ImageManipulator.manipulate(uri);
    context.resize((width ?? 0) >= (height ?? 0) ? { width: AVATAR_MAX_PX } : { height: AVATAR_MAX_PX });
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.82 });
    return saved.uri;
  } catch (err) {
    console.warn('[profile photo] could not shrink the picture; uploading the original', err);
    return null;
  }
}

export function ProfilePhoto() {
  const employee = useAuthStore((s) => s.employee);
  const profile = useAuthStore((s) => s.profile);
  const token = useAuthStore((s) => s.token);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const t = useT();

  // Set when the remote image fails, so one bad load falls back to initials
  // instead of leaving a broken frame on the screen.
  const [failed, setFailed] = useState(false);
  /*
   * WHY IT IS NOT SHOWING, IN WORDS.
   *
   * Every way this can fail was silent. A refused image reverted to initials
   * with no message; a profile read that failed left the old record in place
   * and said nothing; an upload the server accepted but never recorded looked
   * identical to one that worked. Three different faults, one appearance --
   * "I pressed it and nothing happened" -- which is exactly how long it took
   * to find the real one.
   *
   * None of these should be common. All of them should be legible when they
   * do happen.
   */
  const [photoError, setPhotoError] = useState<string | null>(null);

  const initials =
    `${employee?.first_name?.[0] ?? ''}${employee?.last_name?.[0] ?? ''}`.toUpperCase() || '?';

  const upload = useMutation({
    mutationFn: (file: PickedFile) => uploadProfilePhoto(employee!.id, file),
    onSuccess: async () => {
      setFailed(false);
      setPhotoError(null);
      forgetProfilePhoto(employee!.id);
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ['employee'] });
      // The server took the file. If the record still says there is no photo,
      // something between the upload and the profile read dropped it -- and
      // that gap is precisely what looked like "nothing happened".
      if (!useAuthStore.getState().profile?.hasPhoto) {
        setPhotoError(tr('profile.photoNotStored'));
      }
    },
    onError: (err) => Alert.alert(t('profile.photoFailed'), getApiErrorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: () => removeProfilePhoto(employee!.id),
    onSuccess: async () => {
      setFailed(false);
      setPhotoError(null);
      forgetProfilePhoto(employee!.id);
      await refreshProfile();
    },
    onError: (err) => Alert.alert(t('profile.photoFailed'), getApiErrorMessage(err)),
  });

  const run = async (from: 'camera' | 'library') => {
    const file = await pickImage(from);
    if (file) upload.mutate(file);
  };

  /*
   * On file vs. drawable. "Remove photo" follows the first: a picture that
   * will not display is exactly the one somebody wants to take down, and
   * hiding the option because it failed left no way to do that.
   */
  const photoOnFile = Boolean(profile?.hasPhoto);
  const photo = useProfilePhotoFile(employee?.id, profile?.photoUpdatedAt ?? null, photoOnFile);
  const hasPhoto = photoOnFile && !failed;

  /*
   * THE LOCAL COPY IS AN IMPROVEMENT, NOT A REQUIREMENT.
   *
   * It was introduced for Android, and on an iPhone that had shown the picture
   * perfectly well it then reported "the local copy could not be drawn". So a
   * local copy that fails -- to download, to convert, or to draw -- no longer
   * ends the attempt: the picture is loaded straight from the server, the way
   * that already worked there. Only when that fails too is anything said, and
   * then it says both.
   *
   * Except a 404: the server has no picture, and asking it again the other
   * way will not find one.
   */
  const [localProblem, setLocalProblem] = useState<string | null>(null);
  const localFailedToDownload = photo.error !== null && photo.status !== 404;
  const showLocal = Boolean(photo.uri) && localProblem === null;
  const showRemote = !showLocal && (photo.useRemote || localFailedToDownload || localProblem !== null);

  // A new version is a fresh start.
  useEffect(() => {
    setFailed(false);
    setLocalProblem(null);
  }, [profile?.photoUpdatedAt]);

  // Only a 404 is reported straight away; see above for everything else.
  useEffect(() => {
    if (!photoOnFile || photo.status !== 404) return;
    setPhotoError(tr('profile.photoUnreadable') + ' (HTTP 404)');
  }, [photoOnFile, photo.status]);

  /** What went wrong with the local copy, for the message if the fallback fails too. */
  const localReason = (): string => {
    if (localProblem) return localProblem;
    if (photo.error) return photo.status ? 'HTTP ' + photo.status : photo.error;
    return 'local copy not used';
  };
  const busy = upload.isPending || remove.isPending;

  const choose = () => {
    if (busy || !employee) return;
    const options = [t('profile.photoCamera'), t('profile.photoLibrary')];
    if (photoOnFile) options.push(t('profile.photoRemove'));
    options.push(t('common.cancel'));

    const cancelIndex = options.length - 1;
    const destructiveIndex = photoOnFile ? 2 : undefined;

    const act = (i: number) => {
      if (i === 0) void run('camera');
      else if (i === 1) void run('library');
      else if (photoOnFile && i === 2) remove.mutate();
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex, destructiveButtonIndex: destructiveIndex },
        act
      );
      return;
    }
    // Android has no action sheet primitive; Alert's button list is the
    // closest native equivalent and avoids pulling in a library for one menu.
    Alert.alert(t('profile.photoTitle'), undefined, [
      { text: options[0], onPress: () => void run('camera') },
      { text: options[1], onPress: () => void run('library') },
      ...(photoOnFile ? [{ text: options[2], style: 'destructive' as const, onPress: () => remove.mutate() }] : []),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  };

  return (
    <Pressable
      onPress={choose}
      accessibilityRole="button"
      accessibilityLabel={t('profile.photoTitle')}
      style={({ pressed }) => [styles.wrap, pressed && !busy && { opacity: 0.85 }]}
    >
      <View style={styles.avatarSlot}>
      <View style={styles.avatar}>
        {hasPhoto && employee && (showLocal || showRemote) ? (
          <Image
            // Keyed on the source, so switching to the fallback is a fresh
            // image view rather than the failed one being handed a new uri.
            key={showLocal ? 'local' : 'remote'}
            source={
              showLocal
                ? { uri: photo.uri! }
                : {
                    uri: profilePhotoUrl(employee.id, profile?.photoUpdatedAt ?? null),
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                  }
            }
            style={styles.image}
            // Matters for the direct load: Android would otherwise decode it
            // at full size and refuse to draw it. Android-only.
            resizeMethod="resize"
            onError={() => {
              if (showLocal) {
                // Missing and unreadable are different faults; say which.
                let present: boolean | null = null;
                try {
                  present = new File(photo.uri!).exists;
                } catch {
                  present = null;
                }
                forgetProfilePhoto(employee.id);
                setLocalProblem(
                  present === false ? 'local copy missing' : present ? 'local copy unreadable' : 'local copy not drawn'
                );
                return;
              }
              setFailed(true);
              setPhotoError(tr('profile.photoUnreadable') + ' (' + localReason() + '; direct load failed too)');
            }}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Text style={styles.initial}>{initials}</Text>
        )}
      </View>

      {/* The camera badge is what tells somebody the avatar is tappable at
          all. Without it this reads as decoration. Inside the avatar's own box
          so it stays pinned to the picture rather than to the bottom of
          whatever else this component happens to be showing. */}
      <View style={styles.badge}>
        <Ionicons name={busy ? 'hourglass-outline' : 'camera'} size={13} color={colors.white} />
      </View>
      </View>

      {photoError ? <Text style={styles.photoError}>{photoError}</Text> : null}
    </Pressable>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    photoError: {
      marginTop: 8, paddingHorizontal: 16,
      fontSize: 11, fontWeight: '600', textAlign: 'center', color: colors.dangerText,
    },
    wrap: { marginBottom: 14, alignItems: 'center' },
    // The badge's -2 offsets measure from THIS, not from the whole component.
    avatarSlot: { width: 76, height: 76 },
    avatar: {
      width: 76, height: 76, borderRadius: 38, backgroundColor: colors.brand[700],
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    },
    image: { width: '100%', height: '100%' },
    initial: { color: colors.white, fontSize: 26, fontWeight: '800' },
    badge: {
      position: 'absolute', right: -2, bottom: -2,
      width: 26, height: 26, borderRadius: 13,
      backgroundColor: colors.brand[600],
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: colors.surface,
    },
  });
}
