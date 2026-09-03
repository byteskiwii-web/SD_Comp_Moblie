export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export const API_V1 = `${API_BASE_URL}/api/v1`;

export const OTP_LENGTH = 6;

// How often the app pings /attendance/location-check while clocked in.
export const LOCATION_POLL_INTERVAL_MS = 12 * 60 * 1000; // 12 min (within the agreed 10-15 min window)
export const BACKGROUND_LOCATION_TASK = 'zip-hrms-location-check-task';

// Fixed identifier for the local "still on shift?" reminder, so scheduling a
// new one always replaces any prior one instead of stacking duplicates --
// see src/utils/notifications.ts.
export const CLOCK_OUT_REMINDER_ID = 'zip-hrms-clock-out-reminder';

