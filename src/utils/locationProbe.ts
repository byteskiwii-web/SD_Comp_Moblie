import * as Location from 'expo-location';

export type LocationProbeResult =
  | { status: 'ok'; coords: { latitude: number; longitude: number } }
  | { status: 'disabled' } // Location services are off -- known directly, not inferred.
  | { status: 'timeout' }; // Services are on but no fix arrived in time -- a bad signal, not evidence of anything.

const FIX_TIMEOUT_MS = 20000;
const CACHED_FIX_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * Distinguishes "location is off" from "location is on but the fix is slow
 * or unavailable" -- these must be reported differently (see
 * shiftIntegrityCheck.ts): only the former is direct evidence worth an
 * instant report, the latter is left to the server's gap inference so a
 * patch of bad GPS doesn't get counted against the employee.
 *
 * hasServicesEnabledAsync() is checked fresh every call (cheap, no radio
 * involved) rather than cached, since detecting the OFF state precisely is
 * the entire point. Once confirmed on, getLastKnownPositionAsync's maxAge
 * short-circuit is safe to use for the actual coordinates -- it can only
 * ever skip a live GPS fix, never mask an off state, because that state was
 * already ruled out above.
 */
export async function probeLocation(): Promise<LocationProbeResult> {
  let servicesEnabled: boolean;
  try {
    servicesEnabled = await Location.hasServicesEnabledAsync();
  } catch {
    servicesEnabled = true; // can't tell -- don't punish the employee for our own check failing
  }
  if (!servicesEnabled) return { status: 'disabled' };

  try {
    const cached = await Location.getLastKnownPositionAsync({ maxAge: CACHED_FIX_MAX_AGE_MS });
    if (cached) {
      return { status: 'ok', coords: { latitude: cached.coords.latitude, longitude: cached.coords.longitude } };
    }
  } catch {
    // Fall through to a live fix.
  }

  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('probe timeout')), FIX_TIMEOUT_MS)),
    ]);
    return { status: 'ok', coords: { latitude: position.coords.latitude, longitude: position.coords.longitude } };
  } catch {
    return { status: 'timeout' };
  }
}
