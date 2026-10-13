/**
 * What a geofence map should frame.
 *
 * Shared by both real maps -- Apple Maps on iOS, OpenFreeMap on Android -- so
 * the two platforms show the same stretch of street for the same fix. They
 * used to be one implementation; once there were two, the framing was the part
 * that most needed to stay identical, because it is what decides whether the
 * employee's dot is on the card at all.
 *
 * Centre on the SITE, not on the employee: the fence is the fixed thing being
 * judged against, and a map that recentres on every GPS jitter is unreadable.
 * The span is whichever is larger -- the fence with room around it, or far
 * enough to keep the employee's dot on screen when they are outside it.
 * Someone half a kilometre away then sees both ends of the problem instead of
 * a fence with nothing near it.
 *
 * 111,320 m is one degree of latitude. Longitude shrinks by cos(latitude),
 * which at Ahmedabad is about 0.93 -- ignoring it would squash the fence into
 * an oval on exactly the east-west offsets a high street produces.
 *
 * THE SPAN IS CAPPED (MAX_SPAN_METRES). Following the dot works for someone a
 * street or a suburb away; for someone in another city or country it asked for
 * a span of tens or hundreds of degrees, and MKMapView throws on a region past
 * 180 degrees -- an uncaught native exception, so the app quit as the
 * Attendance tab opened. App Review is the case that found it: a geofence-
 * exempt review account on a Mumbai store, opened in California. Past the cap
 * the dot is simply off the card; the distance printed above it still says
 * how far away they are, which is the only thing a map that wide could add.
 */
export type FenceFrame = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export const METRES_PER_DEG_LAT = 111_320;

/** 20 km: a whole city around the site, and a fraction of a degree. */
export const MAX_SPAN_METRES = 20_000;

export function frameFence(
  siteLat: number,
  siteLng: number,
  userLat: number | null,
  userLng: number | null,
  radiusMetres: number
): FenceFrame {
  const cosLat = Math.max(Math.cos((siteLat * Math.PI) / 180), 0.01);

  // 2.6x the radius leaves the fence filling most of the card with a margin
  // that keeps the site chip from sitting on the boundary line.
  let spanMetres = Math.max(radiusMetres, 50) * 2.6;

  if (userLat != null && userLng != null) {
    const dLat = Math.abs(userLat - siteLat) * METRES_PER_DEG_LAT;
    const dLng = Math.abs(userLng - siteLng) * METRES_PER_DEG_LAT * cosLat;
    // 2.4x the offset, so the dot lands inside the card rather than on its edge.
    const followDot = Math.max(dLat, dLng) * 2.4;
    // Non-finite only from a malformed fix; the fence frame is the safe answer.
    if (Number.isFinite(followDot)) spanMetres = Math.max(spanMetres, followDot);
  }
  // Never wider than a city, whatever the fence or the fix: see the header.
  spanMetres = Math.min(spanMetres, Math.max(MAX_SPAN_METRES, Math.max(radiusMetres, 50) * 2.6));

  const latitudeDelta = spanMetres / METRES_PER_DEG_LAT;
  return {
    latitude: siteLat,
    longitude: siteLng,
    latitudeDelta,
    longitudeDelta: latitudeDelta / cosLat,
  };
}
