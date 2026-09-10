export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export const API_V1 = `${API_BASE_URL}/api/v1`;

export const OTP_LENGTH = 6;

// How often the shift-timer pings /attendance/location-check while clocked in.
export const LOCATION_POLL_INTERVAL_MS = 12 * 60 * 1000; // 12 min (within the agreed 10-15 min window)

// The old expo-location + TaskManager task name, kept only so
// legacyTaskCleanup.ts can find and unregister it on devices upgrading from
// the pre-shift-timer APK. Not used anywhere else -- remove alongside that
// file after one release cycle.
export const LEGACY_BACKGROUND_LOCATION_TASK = 'zip-hrms-location-check-task';

// Fixed identifier for the local "still on shift?" reminder, so scheduling a
// new one always replaces any prior one instead of stacking duplicates --
// see src/utils/notifications.ts.
export const CLOCK_OUT_REMINDER_ID = 'zip-hrms-clock-out-reminder';
/** One pending break reminder at a time; cancel-then-schedule reuses this. */
export const BREAK_REMINDER_ID = 'break-return-reminder';

// Foreground cadence (app open) -- see useShiftIntegrityWatcher.ts.
export const INTEGRITY_FOREGROUND_CHECK_INTERVAL_MS = 60 * 1000;

// Must match ShiftTimerConstants.TASK_KEY in
// modules/shift-timer/android/.../ShiftTimerConstants.kt exactly -- no
// shared source of truth between Kotlin and TS. A mismatch fails silently
// (RN logs "No task registered for key ..." and the tick never runs).
export const SHIFT_TIMER_TASK = 'ZipHrmsShiftTimerTick';

