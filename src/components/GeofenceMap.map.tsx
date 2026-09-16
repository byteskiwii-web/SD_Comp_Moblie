import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, type Region } from 'react-native-maps';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ColorScheme, radii } from '../theme/tokens';
import { useThemeStore } from '../stores/themeStore';
import { useT } from '../i18n';
import { frameFence } from './geofenceFrame';

/**
 * The fence over a real map -- iOS only.
 *
 * Apple Maps, which needs no key and no billing account, in Expo Go or in a
 * store build. Android no longer comes here: react-native-maps is Google Maps
 * there, and Google requires a billing account on file before it will serve a
 * single tile, key restrictions or not. Android draws OpenFreeMap instead --
 * see GeofenceMap.libre.tsx.
 *
 * GESTURES ARE OFF, deliberately. This card lives inside the Clock in/out
 * ScrollView, and a pannable map inside a scrolling parent steals every
 * vertical drag that begins on it -- the employee tries to scroll to the Clock
 * Out button and the map pans instead. It is a picture of where you are, not
 * somewhere to navigate, so the scroll belongs to the page.
 */
export function NativeGeofenceMap({
  siteLat,
  siteLng,
  userLat,
  userLng,
  radiusMetres,
  inside,
  siteName,
  height = 190,
}: {
  siteLat: number;
  siteLng: number;
  /** Null until a fix arrives; the site alone still frames a useful map. */
  userLat: number | null;
  userLng: number | null;
  radiusMetres: number;
  inside: boolean;
  siteName: string;
  height?: number;
}) {
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const isDark = useThemeStore((s) => s.mode) === 'dark';

  const tint = inside ? colors.success : colors.warning;

  // See geofenceFrame.ts: shared with the Android map so both platforms frame
  // the same stretch of street for the same fix.
  const region = React.useMemo<Region>(
    () => frameFence(siteLat, siteLng, userLat, userLng, radiusMetres),
    [siteLat, siteLng, userLat, userLng, radiusMetres]
  );

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        // `region` rather than `initialRegion`: the first fix usually lands
        // after this mounts, and the frame has to widen to include it.
        region={region}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        // Google's "open in Maps" buttons, on a map you cannot even pan.
        toolbarEnabled={false}
        // Apple Maps follows this; Android keeps Google's own day/night.
        userInterfaceStyle={isDark ? 'dark' : 'light'}
        // The OS blue dot would sit a metre or two from our own marker and
        // contradict the distance printed above the card. One dot, one number.
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        accessibilityLabel={t('map.label', { site: siteName })}
      >
        {radiusMetres > 0 && (
          <Circle
            center={{ latitude: siteLat, longitude: siteLng }}
            radius={radiusMetres}
            strokeColor={tint}
            strokeWidth={2}
            // Dashed, as the design has it -- a boundary you are judged
            // against, not a solid object sitting on the street.
            lineDashPattern={[6, 6]}
            // NO FILL AT ALL. This started as successBg, an opaque surface
            // colour -- right behind text, wrong over map tiles, where it put a
            // lid on the streets the map exists to show. A 14% wash of the tint
            // was the next attempt and still read as a green disc. The dashed
            // ring already says where the boundary is, and the banner above the
            // card already says which side of it you are on, so the fill was
            // carrying no information the screen did not state twice over.
            fillColor="transparent"
          />
        )}

        <Marker
          coordinate={{ latitude: siteLat, longitude: siteLng }}
          title={siteName}
          // Centre the custom pin on the point rather than hanging it below.
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
        >
          <View style={styles.sitePin}>
            <Ionicons name="business" size={11} color={colors.white} />
          </View>
        </Marker>

        {userLat != null && userLng != null && (
          <Marker
            coordinate={{ latitude: userLat, longitude: userLng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            accessibilityLabel={t('map.youAreHere')}
          >
            <View style={[styles.userDot, { borderColor: tint }]}>
              <View style={[styles.userDotCore, { backgroundColor: tint }]} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Same two chips the drawn version carries, so switching between them
          is not a change of language. */}
      <View style={styles.siteChip} pointerEvents="none">
        <Ionicons name="location" size={11} color={colors.brand[700]} />
        <Text style={styles.siteChipText} numberOfLines={1}>
          {siteName}
        </Text>
      </View>

      {radiusMetres > 0 && (
        <View style={styles.radiusChip} pointerEvents="none">
          <Text style={styles.radiusChipText}>
            {t('map.fenceRadius', { metres: Math.round(radiusMetres) })}
          </Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    wrap: {
      borderRadius: radii.lg,
      backgroundColor: colors.slate50,
      borderWidth: 1,
      borderColor: colors.slate100,
      overflow: 'hidden',
    },
    sitePin: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.brand[700],
      borderWidth: 2,
      borderColor: colors.white,
    },
    userDot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      backgroundColor: colors.white,
    },
    userDotCore: { width: 8, height: 8, borderRadius: 4 },
    siteChip: {
      position: 'absolute',
      left: 10,
      bottom: 10,
      maxWidth: '62%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: radii.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.slate200,
      // The chips sit over live tiles rather than flat SVG, so they need a
      // lift of their own to stay legible against a busy street.
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
        android: { elevation: 2 },
        default: {},
      }),
    },
    siteChipText: { flex: 1, fontSize: 11, fontWeight: '800', color: colors.textLight },
    radiusChip: {
      position: 'absolute',
      right: 10,
      bottom: 10,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: radii.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.slate200,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
        android: { elevation: 2 },
        default: {},
      }),
    },
    radiusChipText: { fontSize: 10, fontWeight: '800', color: colors.slate500 },
  });
