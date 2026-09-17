import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { profilePhotoUrl } from '../api/photo.api';
import { useProfilePhotoFile } from './profilePhotoFile';

/**
 * The employee's face, or their initials.
 *
 * The inside of an avatar circle, not the circle itself -- Home and the
 * attendance header each draw their own, at their own size and with their own
 * type, and this fills whichever it is put in. Both containers need
 * `overflow: 'hidden'` for the picture to be clipped to the circle.
 *
 * Until now only the Profile screen showed the photo; everywhere else fell
 * back to initials, so somebody who had just set a picture saw it in exactly
 * one place and nowhere they actually look.
 *
 * The picture is a small local copy (see profilePhotoFile.ts for why). A
 * failure falls back to initials rather than leaving a hole -- this is
 * decoration, and the Profile screen is where a broken photo is explained.
 */
export function AvatarContent({ initialsStyle }: { initialsStyle: StyleProp<TextStyle> }) {
  const employee = useAuthStore((s) => s.employee);
  const profile = useAuthStore((s) => s.profile);
  const token = useAuthStore((s) => s.token);
  const [failed, setFailed] = useState(false);
  const photo = useProfilePhotoFile(
    employee?.id,
    profile?.photoUpdatedAt ?? null,
    Boolean(employee && profile?.hasPhoto)
  );

  // A new picture deserves a fresh attempt, whatever the last one did.
  useEffect(() => setFailed(false), [photo.uri, profile?.photoUpdatedAt]);

  const initials =
    `${employee?.first_name?.[0] ?? ''}${employee?.last_name?.[0] ?? ''}`.toUpperCase() || '?';

  if (!employee || !profile?.hasPhoto || failed) {
    return <Text style={initialsStyle}>{initials}</Text>;
  }

  if (photo.uri) {
    return (
      <Image
        source={{ uri: photo.uri }}
        style={StyleSheet.absoluteFill}
        onError={() => setFailed(true)}
        accessibilityIgnoresInvertColors
      />
    );
  }

  // The local pipeline itself broke: the old remote load is still better
  // than initials.
  if (photo.useRemote && token) {
    return (
      <Image
        source={{
          uri: profilePhotoUrl(employee.id, profile.photoUpdatedAt ?? null),
          headers: { Authorization: `Bearer ${token}` },
        }}
        style={StyleSheet.absoluteFill}
        // Android decodes a remote image at full size unless told otherwise,
        // and refuses to draw a bitmap that large. "resize" samples it down
        // to this view first. Android-only; iOS ignores it.
        resizeMethod="resize"
        onError={() => setFailed(true)}
        accessibilityIgnoresInvertColors
      />
    );
  }

  // Loading, or refused: initials until there is something to show.
  return <Text style={initialsStyle}>{initials}</Text>;
}
