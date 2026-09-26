import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { profilePhotoUrl } from '../api/photo.api';
import { directLoadMayHelp, useProfilePhotoFile } from './profilePhotoFile';

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
  // The local copy failed to draw: use the direct load instead (see ProfilePhoto).
  const [localFailed, setLocalFailed] = useState(false);
  const photo = useProfilePhotoFile(
    employee?.id,
    profile?.photoUpdatedAt ?? null,
    Boolean(employee && profile?.hasPhoto)
  );

  // A new picture deserves a fresh attempt, whatever the last one did.
  useEffect(() => {
    setFailed(false);
    setLocalFailed(false);
  }, [photo.uri, profile?.photoUpdatedAt]);

  const initials =
    `${employee?.first_name?.[0] ?? ''}${employee?.last_name?.[0] ?? ''}`.toUpperCase() || '?';

  if (!employee || !profile?.hasPhoto || failed) {
    return <Text style={initialsStyle}>{initials}</Text>;
  }

  if (photo.uri && !localFailed) {
    return (
      <Image
        key="local"
        source={{ uri: photo.uri }}
        style={StyleSheet.absoluteFill}
        onError={() => setLocalFailed(true)}
        accessibilityIgnoresInvertColors
      />
    );
  }

  // The local copy could not be made or drawn: the direct load is still
  // better than initials. Not after a 404 (no picture at all) or a 5xx (the
  // server would refuse the direct load the same way).
  const tryRemote = localFailed || directLoadMayHelp(photo);
  if (tryRemote && token) {
    return (
      <Image
        key="remote"
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
