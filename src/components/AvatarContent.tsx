import React, { useState } from 'react';
import { Image, StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { profilePhotoUrl } from '../api/photo.api';

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
 * The header goes on the request because this URL is proxied through the API
 * and carries no session of its own. A failed load falls back to initials
 * rather than leaving a hole -- this is decoration, and the Profile screen is
 * where a broken photo is worth explaining.
 */
export function AvatarContent({ initialsStyle }: { initialsStyle: StyleProp<TextStyle> }) {
  const employee = useAuthStore((s) => s.employee);
  const profile = useAuthStore((s) => s.profile);
  const token = useAuthStore((s) => s.token);
  const [failed, setFailed] = useState(false);

  const initials =
    `${employee?.first_name?.[0] ?? ''}${employee?.last_name?.[0] ?? ''}`.toUpperCase() || '?';

  if (!employee || !profile?.hasPhoto || failed) {
    return <Text style={initialsStyle}>{initials}</Text>;
  }

  return (
    <Image
      source={{
        uri: profilePhotoUrl(employee.id, profile.photoUpdatedAt ?? null),
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }}
      style={StyleSheet.absoluteFill}
      // Android decodes a remote image at full size unless told otherwise,
      // and refuses to draw a bitmap that large: a square crop from a 50 MP
      // camera is ~150 MB. "resize" samples it down to this view first.
      // Android-only; iOS ignores it.
      resizeMethod="resize"
      onError={() => setFailed(true)}
      accessibilityIgnoresInvertColors
    />
  );
}
