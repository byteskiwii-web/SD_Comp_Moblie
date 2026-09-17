import { useEffect, useState } from 'react';
import { Directory, File, Paths } from 'expo-file-system';
import { useAuthStore } from '../stores/authStore';
import { profilePhotoUrl } from '../api/photo.api';

/**
 * A profile picture as a small local JPEG.
 *
 * WHY NOT <Image source={{ uri, headers }}> ANY MORE.
 *
 * On Android that pointed the image view at the API with the session in a
 * header, and left everything after that to it: the download, the format, the
 * size. Shadab's photo failed there -- "Saved, but it could not be displayed"
 * -- while the very same request made through the API client succeeded. So the
 * server was fine and the image view was not, and from outside the view there
 * is no way to ask it why. A 50 MP original it would not draw, a HEIF file it
 * cannot decode (iOS can, which is why the iPhone never showed the fault), or
 * a request it made differently: three causes, one symptom.
 *
 * This takes all three off the table. The app's own downloader fetches the
 * bytes with the session attached, the file is checked for what it actually
 * is, and expo-image-manipulator re-encodes it as a 384 px JPEG -- which both
 * platforms draw without argument, and which a team list can show twenty of
 * without downloading twenty camera originals. The image view is only ever
 * handed a local file.
 *
 * WHEN IT CANNOT DO THAT -- an APK built before expo-image-manipulator was
 * added has no native half for it -- the downloaded original is used as is,
 * except HEIF, which is reported instead. Anything unexpected in the pipeline
 * itself (not an HTTP refusal) sets `useRemote`, and the caller falls back to
 * the old remote image rather than showing nothing.
 */

/** Largest avatar is ~96 dp; at 3.5x density that is ~336 px. */
const SIZE_PX = 384;

/**
 * A colleague's picture has no version the app can see (photoUpdatedAt is
 * only on your own profile), so their copy is refreshed on age instead.
 */
const UNVERSIONED_TTL_MS = 60 * 60 * 1000;

/** "No photo" answers are remembered this long, so a team list does not re-ask per mount. */
const MISSING_TTL_MS = 10 * 60 * 1000;

export type PhotoFileState = {
  /** A local file to hand the image view, once there is one. */
  uri: string | null;
  /** Why there is not one, in words. Null while loading or on success. */
  error: string | null;
  /** The HTTP status, when the server refused. */
  status: number | null;
  /** The pipeline itself broke: show the remote image the old way. */
  useRemote: boolean;
};

const EMPTY: PhotoFileState = { uri: null, error: null, status: null, useRemote: false };

/** Latest local file per employee+version, so a remount does not touch the disk. */
const known = new Map<string, string>();
const missing = new Map<string, { at: number; state: PhotoFileState }>();
const inflight = new Map<string, Promise<string>>();
/** With the timestamp, keeps two downloads in the same millisecond apart. */
let downloadSeq = 0;

function prefixFor(employeeId: string, version: string | null | undefined): string {
  const id = employeeId.replace(/[^\w-]/g, '_');
  const v = version ? String(version).replace(/[^0-9A-Za-z]/g, '') : 'latest';
  return `${id}-${v}-`;
}

function cacheDir(): Directory {
  const dir = new Directory(Paths.cache, 'avatars');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function filesStartingWith(dir: Directory, prefix: string): File[] {
  return dir
    .list()
    .filter((e): e is File => e instanceof File && e.name.startsWith(prefix) && !e.name.endsWith('.part'));
}

/** What the bytes are, whatever the server called them. */
function sniff(file: File): 'jpeg' | 'png' | 'webp' | 'heif' | 'unknown' {
  const handle = file.open();
  try {
    const b = handle.readBytes(12);
    if (b[0] === 0xff && b[1] === 0xd8) return 'jpeg';
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
    const ascii = (from: number, to: number) => String.fromCharCode(...Array.from(b.slice(from, to)));
    if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
    if (ascii(4, 8) === 'ftyp') return 'heif';
    return 'unknown';
  } finally {
    handle.close();
  }
}

class PhotoHttpError extends Error {
  constructor(message: string, readonly status: number | null) {
    super(message);
  }
}

async function fetchPhoto(employeeId: string, version: string | null | undefined, token: string): Promise<string> {
  const dir = cacheDir();
  const prefix = prefixFor(employeeId, version);

  // Newest local copy, if it is still good.
  const existing = filesStartingWith(dir, prefix).sort((a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0))[0];
  if (existing && (version || (existing.lastModified ?? 0) > Date.now() - UNVERSIONED_TTL_MS)) {
    return existing.uri;
  }

  // Into a .part first: on Android a failed download can leave half a file.
  const part = new File(dir, prefix + 'download.part');
  let downloaded: File;
  try {
    downloaded = await File.downloadFileAsync(profilePhotoUrl(employeeId, version), part, {
      headers: { Authorization: `Bearer ${token}` },
      idempotent: true,
    });
  } catch (err) {
    if (part.exists) part.delete();
    const message = err instanceof Error ? err.message : String(err);
    const status = Number((message.match(/status:?\s*(\d{3})/i) ?? [])[1]) || null;
    throw new PhotoHttpError(message, status);
  }

  const kind = sniff(downloaded);
  if (kind === 'unknown') {
    downloaded.delete();
    throw new PhotoHttpError('the server sent something that is not a picture', null);
  }

  // Unique name per download: the image view caches by URI, and reusing a
  // path would keep showing the picture that used to be there.
  const dest = new File(dir, `${prefix}${Date.now()}-${++downloadSeq}.jpg`);
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ImageManipulator, SaveFormat } = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
    const context = ImageManipulator.manipulate(downloaded.uri);
    context.resize({ width: SIZE_PX });
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
    await new File(saved.uri).move(dest, { overwrite: true });
    downloaded.delete();
  } catch (err) {
    if (kind === 'heif') {
      downloaded.delete();
      throw new PhotoHttpError('the photo is HEIF, which this build cannot convert', null);
    }
    console.warn('[photo] could not re-encode; using the original bytes', err);
    await downloaded.move(dest, { overwrite: true });
  }

  // Older copies of this person's picture, whatever version they were.
  const idPrefix = employeeId.replace(/[^\w-]/g, '_') + '-';
  for (const old of filesStartingWith(dir, idPrefix)) {
    if (old.uri !== dest.uri) {
      try { old.delete(); } catch { /* in use or gone; the next pass gets it */ }
    }
  }
  return dest.uri;
}

/**
 * @param enabled false when there is known to be no photo (own profile says
 *   hasPhoto: false), so nothing is fetched.
 */
export function useProfilePhotoFile(
  employeeId: string | null | undefined,
  version: string | null | undefined,
  enabled: boolean
): PhotoFileState {
  const token = useAuthStore((s) => s.token);
  const prefix = employeeId ? prefixFor(employeeId, version) : '';
  const [state, setState] = useState<PhotoFileState>(() => {
    const uri = prefix ? known.get(prefix) : undefined;
    return uri ? { ...EMPTY, uri } : EMPTY;
  });

  useEffect(() => {
    if (!enabled || !employeeId || !token) {
      setState(EMPTY);
      return;
    }
    const hit = known.get(prefix);
    if (hit) {
      setState({ ...EMPTY, uri: hit });
      // A colleague's copy may be stale; a versioned one never is.
      if (version) return;
    }
    const miss = missing.get(prefix);
    if (miss && miss.at > Date.now() - MISSING_TTL_MS) {
      setState(miss.state);
      return;
    }

    let cancelled = false;
    let job = inflight.get(prefix);
    if (!job) {
      job = fetchPhoto(employeeId, version, token).finally(() => inflight.delete(prefix));
      inflight.set(prefix, job);
    }
    job.then(
      (uri) => {
        known.set(prefix, uri);
        missing.delete(prefix);
        if (!cancelled) setState({ ...EMPTY, uri });
      },
      (err) => {
        const failed: PhotoFileState =
          err instanceof PhotoHttpError
            ? { uri: null, error: err.message, status: err.status, useRemote: false }
            : { uri: null, error: String(err), status: null, useRemote: true };
        // Only "there is no photo" is worth remembering. A network blip is
        // not, or one bad moment would hide the face for ten minutes.
        if (failed.status === 404) missing.set(prefix, { at: Date.now(), state: failed });
        if (!cancelled) setState(failed);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, employeeId, version, token, prefix]);

  return state;
}

/**
 * After an upload or removal: forget what we had for this person.
 *
 * On disk too. Your own header and profile ask by version and would move on
 * by themselves, but a team list shows the same face unversioned, and would
 * otherwise keep the old picture for up to an hour.
 */
export function forgetProfilePhoto(employeeId: string): void {
  const idPrefix = employeeId.replace(/[^\w-]/g, '_') + '-';
  for (const key of [...known.keys()]) if (key.startsWith(idPrefix)) known.delete(key);
  for (const key of [...missing.keys()]) if (key.startsWith(idPrefix)) missing.delete(key);
  try {
    for (const old of filesStartingWith(cacheDir(), idPrefix)) old.delete();
  } catch (err) {
    console.warn('[photo] could not clear cached copies', err);
  }
}
