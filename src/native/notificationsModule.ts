import { hasNotifications } from './runtime';

/**
 * expo-notifications, or null where importing it would take the app down.
 *
 * Every use of the library goes through here rather than importing it
 * directly, for the same reason CameraCaptureScreen dispatches to a lazy
 * require: a static import is evaluated when the MODULE is loaded, so a
 * capability check inside a function is already too late — the throw has
 * happened before that function exists.
 *
 * Cached after the first attempt, including the failure. Retrying a require
 * that throws on every call would turn one startup crash into a stutter on
 * every notification the app tries to schedule.
 */
type NotificationsModule = typeof import('expo-notifications');

let cached: NotificationsModule | null | undefined;

export function getNotifications(): NotificationsModule | null {
  if (cached !== undefined) return cached;
  if (!hasNotifications) {
    cached = null;
    return cached;
  }
  try {
    cached = require('expo-notifications') as NotificationsModule;
  } catch (err) {
    // A runtime that cannot load it has not loaded it. Never rethrow: every
    // caller here is a reminder or a banner, and none of them is worth the
    // application for.
    console.warn('[notifications] unavailable in this runtime', err);
    cached = null;
  }
  return cached;
}
