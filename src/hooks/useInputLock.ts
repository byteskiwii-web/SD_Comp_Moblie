import { useState } from 'react';

/**
 * Locks a form after the server rejected what was typed, until that input changes.
 *
 * Compares values rather than tracking an "edited" flag: changing a field and
 * changing it straight back is still the same rejected input, so it stays
 * locked, and any real edit unlocks without a reset step.
 *
 * `fieldsKey` is every field that can fix the rejection, joined into one
 * string. Pass the key the request was SENT with to `lock`, not the live one,
 * so an edit made while the request was in flight is not mistaken for the
 * rejected input.
 */
export function useInputLock(fieldsKey: string) {
  const [lockedKey, setLockedKey] = useState<string | null>(null);
  return { locked: lockedKey !== null && lockedKey === fieldsKey, lock: setLockedKey };
}
