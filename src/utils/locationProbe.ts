import * as Location from 'expo-location';

export type LocationProbeResult =
  | { status: 'ok'; coords: { latitude: number; longitude: number; accuracy: number | null } }
  | { status: 'disabled' } // Location services are off -- known directly, not inferred.
  | { status: 'timeout' }; // Services are on but no fix arrived in time -- a bad signal, not evidence of anything.

const FIX_TIMEOUT_MS = 20000;
/*
 * Only a recent cached fix may stand in when no live fix arrives. At 5 minutes
 * a fix from before the employee reached the store could be judged against
 * the fence and read "outside" while they stood inside it.
 */
const CACHED_FIX_MAX_AGE_MS = 2 * 60 * 1000;

/**
 * Distinguishes "location is off" from "location is on but the fix is slow
 * or unavailable" -- these must be reported differently (see
 * shiftIntegrityCheck.ts): only the former is direct evidence worth an
 * instant report, the latter is left to the server's gap inference so a
 * patch of bad GPS doesn't get counted against the employee.
 *
 * hasServicesEnabledAsync() is checked fresh every call (cheap, no radio
 * involved) rather than cached, since detecting the OFF state precisely is
 * the entire point.
 *
 * The position is a LIVE high-accuracy fix first: this decides inside/outside
 * the fence, and a cached or Wi-Fi/cell fix is often 100+ m off or minutes
 * old. Only if no live fix arrives within FIX_TIMEOUT_MS does a cached fix of
 * at most CACHED_FIX_MAX_AGE_MS stand in. Either way its accuracy goes with it,
 * so the server can allow for a rough reading (isWithinFence).
 */
/**
 * Whether the phone's location services switch is OFF -- the switch only,
 * never a position, so it needs no permission and never prompts (on every iOS
 * and Android version expo-location supports). `undefined` when it cannot be
 * read: the server then falls back to its own gap inference rather than this
 * device guessing either way.
 */
export async function isLocationServicesOff(): Promise<boolean | undefined> {
  try {
    return !(await Location.hasServicesEnabledAsync());
  } catch {
    return undefined;
  }
}

export async function probeLocation(): Promise<LocationProbeResult> {
  let servicesEnabled: boolean;
  try {
    servicesEnabled = await Location.hasServicesEnabledAsync();
  } catch {
    servicesEnabled = true; // can't tell -- don't punish the employee for our own check failing
  }
  if (!servicesEnabled) return { status: 'disabled' };

  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('probe timeout')), FIX_TIMEOUT_MS)),
    ]);
    return { status: 'ok', coords: toCoords(position.coords) };
  } catch {
    // No live fix in time -- a recent cached one may stand in.
  }

  try {
    const cached = await Location.getLastKnownPositionAsync({ maxAge: CACHED_FIX_MAX_AGE_MS });
    if (cached) return { status: 'ok', coords: toCoords(cached.coords) };
  } catch {
    // Nothing usable either way.
  }
  return { status: 'timeout' };
}

function toCoords(c: { latitude: number; longitude: number; accuracy?: number | null }) {
  return { latitude: c.latitude, longitude: c.longitude, accuracy: c.accuracy ?? null };
}
