import React, { useMemo, useState } from 'react';
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
  return {
    uri: a.uri,
    name: a.fileName ?? `profile-${Date.now()}.jpg`,
    mimeType: a.mimeType ?? 'image/jpeg',
  };
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

  const initials =
    `${employee?.first_name?.[0] ?? ''}${employee?.last_name?.[0] ?? ''}`.toUpperCase() || '?';

  const upload = useMutation({
    mutationFn: (file: PickedFile) => uploadProfilePhoto(employee!.id, file),
    onSuccess: async () => {
      setFailed(false);
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ['employee'] });
    },
    onError: (err) => Alert.alert(t('profile.photoFailed'), getApiErrorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: () => removeProfilePhoto(employee!.id),
    onSuccess: async () => {
      setFailed(false);
      await refreshProfile();
    },
    onError: (err) => Alert.alert(t('profile.photoFailed'), getApiErrorMessage(err)),
  });

  const run = async (from: 'camera' | 'library') => {
    const file = await pickImage(from);
    if (file) upload.mutate(file);
  };

  const hasPhoto = Boolean(profile?.hasPhoto) && !failed;
  const busy = upload.isPending || remove.isPending;

  const choose = () => {
    if (busy || !employee) return;
    const options = [t('profile.photoCamera'), t('profile.photoLibrary')];
    if (hasPhoto) options.push(t('profile.photoRemove'));
    options.push(t('common.cancel'));

    const cancelIndex = options.length - 1;
    const destructiveIndex = hasPhoto ? 2 : undefined;

    const act = (i: number) => {
      if (i === 0) void run('camera');
      else if (i === 1) void run('library');
      else if (hasPhoto && i === 2) remove.mutate();
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
      ...(hasPhoto ? [{ text: options[2], style: 'destructive' as const, onPress: () => remove.mutate() }] : []),
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
      <View style={styles.avatar}>
        {hasPhoto && employee ? (
          <Image
            source={{
              uri: profilePhotoUrl(employee.id, profile?.photoUpdatedAt ?? null),
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            }}
            style={styles.image}
            onError={() => setFailed(true)}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Text style={styles.initial}>{initials}</Text>
        )}
      </View>

      {/* The camera badge is what tells somebody the avatar is tappable at
          all. Without it this reads as decoration. */}
      <View style={styles.badge}>
        <Ionicons name={busy ? 'hourglass-outline' : 'camera'} size={13} color={colors.white} />
      </View>
    </Pressable>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    wrap: { marginBottom: 14 },
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
