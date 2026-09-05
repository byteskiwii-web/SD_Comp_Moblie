import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import { BACKGROUND_INTEGRITY_TASK, INTEGRITY_BACKGROUND_MIN_INTERVAL_MINUTES } from '../constants/config';
import { checkShiftIntegrity } from './shiftIntegrityCheck';
import { useAuthStore } from '../stores/authStore';
import { useShiftStore } from '../stores/shiftStore';

/**
 * Loads the state this check depends on BEFORE reading any of it.
 *
 * When the OS runs this task after the app process was killed, none of the
 * app's normal startup has happened: App.tsx never rendered, so
 * authStore.hydrate() was never called and the JWT is still sitting in
 * SecureStore unread -- every API call would go out with no Authorization
 * header and come back 401. The shift store has the same problem from the
 * other direction: its persist middleware hydrates from AsyncStorage
 * asynchronously, so reading it synchronously in a cold context returns
 * DEFAULTS (isClockedIn: false), and the check would bail before doing
 * anything.
 *
 * Both were silently swallowed -- a failed report just leaves the edge flag
 * unset -- which is exactly why closing the app and disabling location
 * produced nothing until the app was reopened.
 *
 * Deliberately lives here and not inside checkShiftIntegrity(): the
 * foreground path calls that every 60s and is already hydrated, and
 * re-reading storage on every tick would be pointless work (and could
 * clobber a just-written in-memory value with a slightly stale one).
 */
async function hydrateForBackgroundRun(): Promise<void> {
  await Promise.all([useAuthStore.getState().hydrate(), useShiftStore.persist.rehydrate()]);
}

/**
 * Closes the gap the foreground-only watcher (useShiftIntegrityWatcher.ts)
 * openly documented as a known limitation: a plain setInterval + AppState
 * listener stops running the moment the app process is actually killed, not
 * just backgrounded -- confirmed by a real report (location disabled while
 * the app was closed produced no alert until the app was reopened).
 *
 * expo-background-task wraps Android's WorkManager (and iOS's BGTaskScheduler,
 * unused here -- this app has no iOS build). Android enforces
 * minimumInterval as a FLOOR, not a promise: the OS decides the actual
 * cadence based on battery/Doze state, and 15 minutes is the shortest floor
 * it accepts. This cannot be made to check every 60 seconds like the
 * foreground path does -- that would need a persistent native foreground
 * service specifically for this check, which is a much larger addition than
 * this task, deliberately not built here.
 *
 * Must be registered at module scope, imported once from App.tsx, so the OS
 * can find this handler again even after the app process was killed --
 * exactly the same reason backgroundLocationTask.ts's task definition lives
 * at module scope.
 */
TaskManager.defineTask(BACKGROUND_INTEGRITY_TASK, async () => {
  // Visible in the Metro log regardless of whether the app is foregrounded --
  // the one way to tell from outside the device whether the OS is actually
  // invoking this at all (vs. silently dropping/deferring it, which several
  // Android OEMs -- OnePlus/OxygenOS included -- are known to do to
  // registered WorkManager tasks despite an app requesting otherwise).
  console.log(`[backgroundIntegrityTask] invoked at ${new Date().toISOString()}`);
  try {
    await hydrateForBackgroundRun();
    await checkShiftIntegrity();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (err) {
    console.warn('[backgroundIntegrityTask]', err);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function startBackgroundIntegrityChecks(): Promise<void> {
  const status = await BackgroundTask.getStatusAsync();
  console.log('[backgroundIntegrityTask] getStatusAsync ->', BackgroundTask.BackgroundTaskStatus[status]);
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return; // e.g. restricted by device battery settings
  await BackgroundTask.registerTaskAsync(BACKGROUND_INTEGRITY_TASK, {
    minimumInterval: INTEGRITY_BACKGROUND_MIN_INTERVAL_MINUTES,
  });
  console.log('[backgroundIntegrityTask] registered, minimumInterval =', INTEGRITY_BACKGROUND_MIN_INTERVAL_MINUTES);
}

export async function stopBackgroundIntegrityChecks(): Promise<void> {
  await BackgroundTask.unregisterTaskAsync(BACKGROUND_INTEGRITY_TASK).catch(() => {});
}

/**
 * Forces the OS to run the task right now instead of waiting for its own
 * schedule -- expo-background-task ships this specifically for testing.
 * Only works in a debug/dev-client build (this app has no production build
 * yet, so that's not a practical restriction here) -- silently returns
 * false in a release build rather than throwing.
 *
 * Exists to answer one question fast: does the task DO the right thing once
 * invoked? If triggering this produces a report/notification immediately,
 * the check logic is fine and the earlier absence of alerts was Android (or
 * OnePlus specifically) not invoking the task on its own schedule -- a
 * device/OS problem, not an app bug. If triggering this ALSO produces
 * nothing, the bug is in the task itself.
 */
export async function triggerBackgroundIntegrityCheckForTesting(): Promise<boolean> {
  return BackgroundTask.triggerTaskWorkerForTestingAsync();
}
