import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * This phone's attendance key (backend: modules/devices/phone.service.js).
 *
 * The server mints it -- this app has no crypto library, and adding one would
 * need a new store build -- and the phone keeps it here, in the secure store,
 * under its OWN entry: sign-out clears the sign-in entry (secureStorage.ts)
 * and never this one, which is what lets the server tell "same phone, next
 * person" from "same person, new phone". On iOS it is THIS_DEVICE_ONLY, so a
 * backup restored onto another iPhone does not bring it along. Android never
 * backs SecureStore up.
 *
 * NEVER OVERWRITTEN. A key is written only when a read has definitely found
 * none. A read that FAILED (a keystore hiccup) is not "none": treating it as
 * none would replace a registered phone's key with a fresh one and lock its
 * owner out until HR stepped in. So a failed read sends no key, saves nothing,
 * and is simply tried again next time.
 */
const ENTRY = 'zob_phone_key';
const KEY_SHAPE = /^[A-Za-z0-9_-]{43}$/;

let known: { key: string | null } | null = null;
let writing: Promise<void> = Promise.resolve();

const supported = Platform.OS === 'android' || Platform.OS === 'ios';

async function read(): Promise<{ key: string | null; ok: boolean }> {
  if (!supported) return { key: null, ok: false };
  if (known) return { key: known.key, ok: true };
  try {
    const raw = await SecureStore.getItemAsync(ENTRY);
    known = { key: raw && KEY_SHAPE.test(raw) ? raw : null };
    return { key: known.key, ok: true };
  } catch (err) {
    console.warn('[phoneKey] could not read the key; will try again', err);
    return { key: null, ok: false };
  }
}

/** The stored key, or null (none yet, or it could not be read just now). */
export async function getPhoneKey(): Promise<string | null> {
  return (await read()).key;
}

/**
 * Keep the key the server just minted -- only if this phone definitely has
 * none. Serialised, so two answers arriving together cannot both be written.
 */
export function adoptPhoneKey(key: string): Promise<void> {
  writing = writing.then(async () => {
    if (!KEY_SHAPE.test(key)) return;
    const current = await read();
    if (!current.ok || current.key) return;
    try {
      await SecureStore.setItemAsync(ENTRY, key, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      known = { key };
    } catch (err) {
      console.warn('[phoneKey] could not save the key; the next status call will mint another', err);
    }
  });
  return writing;
}

/** What HR is shown to recognise the phone. A hint, never evidence. */
function model(): string {
  try {
    if (Platform.OS === 'android') {
      const c = Platform.constants as { Brand?: string; Model?: string };
      return [c.Brand, c.Model].filter(Boolean).join(' ').slice(0, 80);
    }
    if (Platform.OS === 'ios') {
      const c = Platform.constants as { interfaceIdiom?: string };
      return `${c.interfaceIdiom === 'pad' ? 'iPad' : 'iPhone'} (iOS ${String(Platform.Version)})`;
    }
  } catch {
    // Unknown is fine: the model is only a label.
  }
  return '';
}

/** Headers for the punch routes and the status call. Never throws. */
export async function phoneHeaders(): Promise<Record<string, string>> {
  if (!supported) return {};
  const headers: Record<string, string> = { 'X-Device-Platform': Platform.OS };
  const m = model();
  if (m) headers['X-Device-Model'] = m;
  const key = await getPhoneKey();
  if (key) headers['X-Device-Key'] = key;
  return headers;
}
