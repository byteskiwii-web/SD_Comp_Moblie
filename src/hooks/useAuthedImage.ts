import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { useAuthStore } from '../stores/authStore';

/**
 * An image that lives behind the session, as a URI <Image> can draw.
 *
 * Uploaded documents are proxied through the API and need the bearer on
 * the request. <Image source={{ uri, headers }}> is the documented way to
 * send it, and on iOS it works; on Android the native loader does not
 * reliably attach the header, so the request is refused and the picture
 * silently fails — while a plain fetch of the same URL with the same token
 * succeeds. That is the exact symptom profile photos had before they got
 * their own pipeline (profilePhotoFile.ts, which also converts HEIF and
 * shrinks); this is the lighter version of the same idea for images that
 * only ever need to be shown as they are.
 *
 * The bytes are fetched here, with the header, straight to the cache
 * directory — the way document PDFs already are — and the local file URI is
 * what gets drawn. Either platform can draw a file. The cache name carries
 * the version, so a re-upload is a new file; the OS reclaims the cache
 * directory on its own.
 *
 * @param url        the API URL, or null for nothing to load
 * @param cacheName  a name unique to this image AND its version
 * @returns `uri` to hand to <Image> once ready; `failed` when the download
 *          itself was refused, so the caller can fall back or explain
 */
export function useAuthedImage(url: string | null, cacheName: string | null): { uri: string | null; failed: boolean } {
  const token = useAuthStore((s) => s.token);
  const [state, setState] = useState<{ key: string | null; uri: string | null; failed: boolean }>({ key: null, uri: null, failed: false });

  const key = url && cacheName ? `${cacheName}|${url}` : null;

  useEffect(() => {
    if (!url || !cacheName || !token) {
      setState({ key: null, uri: null, failed: false });
      return undefined;
    }
    // A browser can neither add the header nor read the cache directory; it
    // is not a supported client, but it must not crash either.
    if (Platform.OS === 'web') {
      setState({ key, uri: url, failed: false });
      return undefined;
    }

    let cancelled = false;
    (async () => {
      const safe = cacheName.replace(/[^\w.\-]/g, '_');
      const file = new File(Paths.cache, safe);
      try {
        if (!file.exists) {
          await File.downloadFileAsync(url, file, { headers: { Authorization: `Bearer ${token}` }, idempotent: true });
        }
        if (!cancelled) setState({ key, uri: file.uri, failed: false });
      } catch {
        // A partial file must not be served next time as if it were whole.
        try { if (file.exists) file.delete(); } catch { /* best effort */ }
        if (!cancelled) setState({ key, uri: null, failed: true });
      }
    })();
    return () => { cancelled = true; };
    // The token's VALUE is deliberately not a dependency: a refresh rotation
    // must not re-download every avatar on screen. Whether there is one is —
    // the download has to wait for sign-in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, Boolean(token)]);

  // Never hand back a URI that belongs to a previous key.
  if (state.key !== key) return { uri: null, failed: false };
  return { uri: state.uri, failed: state.failed };
}
