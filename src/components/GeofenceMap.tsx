import React from 'react';
import { Platform } from 'react-native';
import { isWeb } from '../native/runtime';
import { DrawnGeofenceMap } from './GeofenceMap.drawn';

/**
 * Where you are, relative to the fence you have to be inside.
 *
 * Two renderings of the same fact, picked by what is actually available:
 *
 *   real map  -- when we know where the site IS. Apple Maps on iOS
 *                (GeofenceMap.map); OpenFreeMap on Android (GeofenceMap.libre).
 *                Neither needs a key or a billing account, in Expo Go or in a
 *                store build. Android used to be Google Maps through the same
 *                react-native-maps component, which Google will not serve
 *                without a card on file.
 *   drawn     -- the SVG fence, when we do not. See GeofenceMap.drawn. Android
 *                also shows it while its map loads, and keeps it if the map
 *                cannot load at all.
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
type LibreModule = typeof import('./GeofenceMap.libre');
let libreModule: LibreModule | null = null;

function loadLibreMap(): LibreModule['LibreGeofenceMap'] {
  // Same caching as below, for the same reason: a stable identity keeps the
  // WebView -- and every tile it has drawn -- across the parent's re-renders.
  if (!libreModule) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    libreModule = require('./GeofenceMap.libre') as LibreModule;
  }
  return libreModule.LibreGeofenceMap;
}

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
  const drawn = (
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

  const canUseRealMap = !isWeb && siteLat != null && siteLng != null;
  if (!canUseRealMap) return drawn;

  const common = {
    siteLat,
    siteLng,
    userLat,
    userLng,
    radiusMetres,
    inside,
    siteName,
    height,
  };

  if (Platform.OS === 'android') {
    const LibreGeofenceMap = loadLibreMap();
    return <LibreGeofenceMap {...common} fallback={drawn} />;
  }

  const NativeGeofenceMap = loadNativeMap();
  return <NativeGeofenceMap {...common} />;
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
