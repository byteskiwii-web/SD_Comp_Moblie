import React from 'react';
import { isWeb } from '../native/runtime';
import { DrawnGeofenceMap } from './GeofenceMap.drawn';

/**
 * Where you are, relative to the fence you have to be inside.
 *
 * Two renderings of the same fact, picked by what is actually available:
 *
 *   real map  -- react-native-maps, when we know where the site IS. Apple Maps
 *                on iOS and Google Maps on Android, both inside the Expo Go
 *                binary, so it needs no key to run there.
 *   drawn     -- the SVG fence, when we do not. See GeofenceMap.drawn.
 *
 * THE DRAWN ONE IS NOT DEAD CODE. A store row with no lat/lng is ordinary --
 * sites are created by HR before anyone stands in them -- and on web there is
 * no react-native-maps at all. In both cases the distance and the bearing are
 * still known, which is everything the drawn fence needs and enough to answer
 * the only two questions being asked: am I inside, and how far off. Falling
 * back to it beats a grey rectangle.
 *
 * The require() is lazy for the same reason the camera screens' is: a static
 * import is evaluated when THIS module is, which would pull react-native-maps
 * into the web bundle where it does not exist.
 */
type MapModule = typeof import('./GeofenceMap.map');
let mapModule: MapModule | null = null;

function loadNativeMap(): MapModule['NativeGeofenceMap'] {
  // Module-level cache: cheap after the first call, and a stable component
  // identity stops React remounting the map -- and refetching its tiles -- on
  // every re-render of the parent, which on this screen is once a second while
  // the shift timer ticks.
  if (!mapModule) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mapModule = require('./GeofenceMap.map') as MapModule;
  }
  return mapModule.NativeGeofenceMap;
}

export function GeofenceMap({
  distanceMetres,
  radiusMetres,
  inside,
  siteName,
  siteLat,
  siteLng,
  userLat,
  userLng,
  height = 190,
}: {
  /** Metres from the site. Null while no fix has arrived. */
  distanceMetres: number | null;
  radiusMetres: number;
  inside: boolean;
  siteName: string;
  /** Null when HR has not placed the site on the map yet. */
  siteLat: number | null;
  siteLng: number | null;
  /** Null until a location fix arrives. */
  userLat: number | null;
  userLng: number | null;
  height?: number;
}) {
  const canUseRealMap = !isWeb && siteLat != null && siteLng != null;

  if (canUseRealMap) {
    const NativeGeofenceMap = loadNativeMap();
    return (
      <NativeGeofenceMap
        siteLat={siteLat}
        siteLng={siteLng}
        userLat={userLat}
        userLng={userLng}
        radiusMetres={radiusMetres}
        inside={inside}
        siteName={siteName}
        height={height}
      />
    );
  }

  return (
    <DrawnGeofenceMap
      distanceMetres={distanceMetres}
      radiusMetres={radiusMetres}
      bearingDegrees={
        siteLat != null && siteLng != null && userLat != null && userLng != null
          ? bearingBetween(siteLat, siteLng, userLat, userLng)
          : null
      }
      inside={inside}
      siteName={siteName}
      height={height}
    />
  );
}

/**
 * Initial bearing from the site to the employee, degrees clockwise from north.
 *
 * The great-circle formula rather than a flat-earth atan2 of the deltas: at
 * Indian latitudes a degree of longitude is about 10% shorter than a degree of
 * latitude, so treating them as equal would swing the dot noticeably off true
 * for exactly the east-west offsets a high street produces.
 */
export function bearingBetween(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLon = toRad(toLng - fromLng);
  const y = Math.sin(dLon) * Math.cos(toRad(toLat));
  const x =
    Math.cos(toRad(fromLat)) * Math.sin(toRad(toLat)) -
    Math.sin(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.cos(dLon);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}
