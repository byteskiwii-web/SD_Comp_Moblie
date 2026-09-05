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
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return; // e.g. restricted by device battery settings
  await BackgroundTask.registerTaskAsync(BACKGROUND_INTEGRITY_TASK, {
    minimumInterval: INTEGRITY_BACKGROUND_MIN_INTERVAL_MINUTES,
  });
}

export async function stopBackgroundIntegrityChecks(): Promise<void> {
  await BackgroundTask.unregisterTaskAsync(BACKGROUND_INTEGRITY_TASK).catch(() => {});
}
