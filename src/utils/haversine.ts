// Ported from zip-hrms-backend/src/shared/utils/haversine.js so the app can
// give instant local feedback before the round-trip to the server confirms it.
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c); // whole metres, matches the backend's rounding
}

/**
 * Inside the fence, allowing for how precise the reading was -- the SAME rule
 * as the server (SD_Computer attendance.punch.js#isWithinFence), so the screen
 * never says "outside" for a punch the server will accept. A fix taken indoors
 * or from Wi-Fi/cell towers can be 50-500 m off; the reading counts as inside
 * when the fence is within its margin of error, capped at 100 m. With no
 * accuracy it is plain distance <= radius.
 */
export const FENCE_ACCURACY_ALLOWANCE_M = 100;
export function isWithinFence(distanceMetres: number, radiusMetres: number, accuracyMetres?: number | null): boolean {
  const allowance =
    accuracyMetres == null ? 0 : Math.min(Math.max(0, accuracyMetres), FENCE_ACCURACY_ALLOWANCE_M);
  return distanceMetres - allowance <= radiusMetres;
}
