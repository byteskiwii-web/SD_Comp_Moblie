import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { IOS_SHIFT_LOCATION_TASK, LOCATION_POLL_INTERVAL_MS } from '../constants/config';
import { hasIosShiftChecks } from '../native/runtime';
import { runShiftTimerTick } from './shiftTimerTask';

/**
 * iOS counterpart of the Android shift timer: the same check
 * (runShiftTimerTick -> POST /attendance/location-check) about every
 * LOCATION_POLL_INTERVAL_MS while clocked in and not on a break.
 *
 * iOS cannot wake an app on a timer the way AlarmManager does. What it does
 * is keep an app running while background location updates are active (the
 * blue status-bar indicator is on for as long), so two things drive the check
 * and both go through runIosCheckIfDue, which makes sure it happens once per
 * interval however often it is called:
 *   - the location task, whenever iOS delivers a fix (the phone is moving);
 *   - a JS interval, for a phone that is standing still and gets no fixes.
 * If iOS suspends the app anyway (low-power mode, force-quit by the user) no
 * check runs and the server reads the gap as it does for Android.
 */

const LAST_CHECK_KEY = 'ios-shift-last-check-at';
// Fixes arrive a little off the interval; do not skip one for being early.
const DUE_SLACK_MS = 30 * 1000;
const INTERVAL_POLL_MS = 60 * 1000;

let running = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

async function lastCheckAt(): Promise<number> {
  try {
    return Number(await AsyncStorage.getItem(LAST_CHECK_KEY)) || 0;
  } catch {
    return 0;
  }
}

async function markChecked(at: number): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_CHECK_KEY, String(at));
  } catch {
    // Worst case the next call checks early; never fail the tick over it.
  }
}

/** Runs the shift check if a full interval has passed since the last one. Never rejects. */
export async function runIosCheckIfDue(): Promise<void> {
  if (running) return;
  running = true;
  try {
    if (Date.now() - (await lastCheckAt()) < LOCATION_POLL_INTERVAL_MS - DUE_SLACK_MS) return;
    // Stamped first: a check that hangs on a slow fix must not be re-entered by the next call.
    await markChecked(Date.now());
    await runShiftTimerTick();
  } catch (err) {
    console.warn('[iosShiftTask] check failed', err);
  } finally {
    running = false;
  }
}

// defineTask must run at module scope, in the entry bundle (imported from
// index.ts), or a task started before the first render finds no handler.
// Required lazily and only where it can run: this file is in the eager graph.
if (hasIosShiftChecks) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const TaskManager = require('expo-task-manager') as typeof import('expo-task-manager');
  TaskManager.defineTask(IOS_SHIFT_LOCATION_TASK, async ({ error }) => {
    if (error) {
      console.warn('[iosShiftTask] location task error', error);
      return;
    }
    await runIosCheckIfDue();
  });
}

/** Starts background updates and the standing-still fallback. Safe to call when already started. */
export async function startIosShiftChecks(): Promise<void> {
  if (!hasIosShiftChecks) return;
  if (!(await Location.hasStartedLocationUpdatesAsync(IOS_SHIFT_LOCATION_TASK))) {
    // The employee has just clocked in with a fix of their own, so the first
    // check is one interval away, as on Android.
    await markChecked(Date.now());
    await Location.startLocationUpdatesAsync(IOS_SHIFT_LOCATION_TASK, {
      // The check takes its own high-accuracy fix (locationProbe); these only
      // keep the app alive, so the cheap setting saves battery.
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 50,
      activityType: Location.ActivityType.Other,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });
  }
  if (!intervalId) {
    intervalId = setInterval(() => void runIosCheckIfDue(), INTERVAL_POLL_MS);
  }
}

/** Stops everything started above. Safe to call when nothing is running. */
export async function stopIosShiftChecks(): Promise<void> {
  if (!hasIosShiftChecks) return;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  try {
    if (await Location.hasStartedLocationUpdatesAsync(IOS_SHIFT_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(IOS_SHIFT_LOCATION_TASK);
    }
  } catch (err) {
    console.warn('[stopIosShiftChecks]', err);
  }
}
