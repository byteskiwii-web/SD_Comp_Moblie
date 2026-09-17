import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useThemeStore } from '../stores/themeStore';
import { useAuthStore } from '../stores/authStore';
import { profilePhotoUrl } from '../api/photo.api';
import type { ColorScheme } from '../theme/tokens';
import { useProfilePhotoFile } from './profilePhotoFile';

/**
 * Somebody else's face, in a list.
 *
 * Distinct from AvatarContent, which is always the signed-in employee and
 * fills a circle its parent drew. This one draws its own circle for an
 * arbitrary employee id, because the caller is rendering a row, not a header.
 *
 * The server decides whether the face comes back: a photo read is scoped, so
 * a lead gets their own store and a field employee gets only themselves. A
 * refusal is a 404 and lands here as no picture, which falls back to
 * initials -- the same thing it shows while there is no photo at all, which is
 * the honest outcome either way.
 *
 * NO VERSION. photoUpdatedAt is part of the signed-in profile and is not
 * known for a colleague, so their local copy is refreshed on age (an hour)
 * instead, and a replaced picture can lag by that much. Worth it: the
 * alternative is a request per row to learn a timestamp that changes once a
 * year.
 */
const TINTS = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'];

/** Stable per person, so a face keeps its colour between screens. */
function tintFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

export function EmployeeAvatar({
  employeeId,
  name,
  size = 34,
}: {
  employeeId: string;
  name?: string | null;
  size?: number;
}) {
  const colors = useThemeStore((s) => s.colors);
  const token = useAuthStore((s) => s.token);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [failed, setFailed] = useState(false);
  // A small local copy; see profilePhotoFile.ts. No version is known for a
  // colleague, so the copy is refreshed on age.
  const photo = useProfilePhotoFile(employeeId, null, Boolean(token));

  const initials =
    (name ?? employeeId)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?';

  const tint = tintFor(employeeId);

  return (
    <View
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: tint },
      ]}
    >
      {failed || !token ? (
        <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initials}</Text>
      ) : photo.uri ? (
        <Image
          source={{ uri: photo.uri }}
          style={StyleSheet.absoluteFill}
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      ) : !photo.useRemote ? (
        // Loading, or no photo on file (a 404 is the common case here).
        <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initials}</Text>
      ) : (
        // The local pipeline broke: fall back to the old remote load.
        <Image
          source={{
            uri: profilePhotoUrl(employeeId),
            headers: { Authorization: `Bearer ${token}` },
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
      )}
    </View>
  );
}

const makeStyles = (_colors: ColorScheme) =>
  StyleSheet.create({
    wrap: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    initials: { color: '#FFFFFF', fontWeight: '800' },
  });
