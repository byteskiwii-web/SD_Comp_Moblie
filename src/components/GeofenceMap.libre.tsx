import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ColorScheme, radii } from '../theme/tokens';
import { useThemeStore } from '../stores/themeStore';
import { useConnectivityStore } from '../stores/connectivityStore';
import { useT } from '../i18n';
import { frameFence } from './geofenceFrame';
import {
  buildLibreMapPage,
  OPENFREEMAP_ATTRIBUTION,
  OPENFREEMAP_DARK,
  OPENFREEMAP_LIGHT,
  type LibreFenceState,
} from './libreMapPage';

/**
 * The fence over a real map -- Android.
 *
 * OpenFreeMap tiles drawn by MapLibre inside a WebView; libreMapPage.ts has
 * why this and not Google Maps. Same framing, pins, dashed ring and chips as
 * the iOS map, so the two platforms describe a fix the same way.
 *
 * THE DRAWN FENCE IS SHOWN UNTIL THE MAP IS. A cold first load pulls a
 * megabyte of script, a style and a screen of tiles -- about ten seconds on a
 * desktop connection, longer on a phone -- and a blank card for that long reads
 * as broken. The SVG fence already knows the distance and the bearing, so it
 * sits on top from the first frame and is removed once the page reports its
 * first complete render. If the map never arrives -- no WebGL, no network, the
 * CDN or the tile host down -- the drawn fence simply stays, which is the same
 * answer the screen gave before there was a map at all.
 *
 * Layered by z-order, not by opacity. An Android view at alpha 0 can be
 * skipped at draw time, and a WebView that is never drawn never produces the
 * frame this is waiting for. Underneath an opaque card it is drawn normally.
 *
 * TOUCHES NEVER REACH IT. The card sits inside the Clock in/out ScrollView,
 * and a WebView takes the gesture it is touched on -- the employee trying to
 * scroll to Clock Out would be dragging a map instead. The page is also
 * non-interactive, but the scroll has to be protected before the touch gets
 * that far.
 */
const GIVE_UP_MS = 45_000;

export function LibreGeofenceMap({
  siteLat,
  siteLng,
  userLat,
  userLng,
  radiusMetres,
  inside,
  siteName,
  height = 190,
  fallback,
}: {
  siteLat: number;
  siteLng: number;
  userLat: number | null;
  userLng: number | null;
  radiusMetres: number;
  inside: boolean;
  siteName: string;
  height?: number;
  /** The drawn fence: shown while loading, and for good if the map fails. */
  fallback: React.ReactElement;
}) {
  const colors = useThemeStore((s) => s.colors);
  const isDark = useThemeStore((s) => s.mode) === 'dark';
  const online = useConnectivityStore((s) => s.status) === 'online';
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  const web = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [shown, setShown] = useState(false);
  const [failed, setFailed] = useState(false);
  // Bumped to remount the WebView for a retry once the server is reachable.
  const [attempt, setAttempt] = useState(0);

  const html = useMemo(
    () => buildLibreMapPage(isDark ? OPENFREEMAP_DARK : OPENFREEMAP_LIGHT),
    [isDark]
  );

  // A new page starts from nothing: it has to say ready again before it is sent
  // anything, and the drawn fence covers it again until it has drawn.
  useEffect(() => {
    setReady(false);
    setShown(false);
  }, [html, attempt]);

  /*
   * A map that failed while the phone was offline gets another go when the
   * server is next reached. Without this, one tunnel through a dead zone on the
   * way in would leave the drawn fence up for the rest of the session.
   *
   * ON THE WAY BACK ONLINE, NOT WHILE ONLINE. Retrying whenever failed and
   * online are both true retries at once for any failure that has nothing to
   * do with the network -- a phone with no WebGL would reload a megabyte of
   * script into a fresh WebView every twenty seconds, for good.
   */
  const wasOnline = useRef(online);
  useEffect(() => {
    const cameBack = online && !wasOnline.current;
    wasOnline.current = online;
    if (cameBack && failed) {
      setFailed(false);
      setAttempt((a) => a + 1);
    }
  }, [online, failed]);

  const tint = inside ? colors.success : colors.warning;
  const payload = useMemo(() => {
    const state: LibreFenceState = {
      siteLat,
      siteLng,
      userLat,
      userLng,
      radius: radiusMetres,
      tint,
      brand: colors.brand[700],
      frame: frameFence(siteLat, siteLng, userLat, userLng, radiusMetres),
    };
    return JSON.stringify(state);
  }, [siteLat, siteLng, userLat, userLng, radiusMetres, tint, colors.brand]);

  // Sent in rather than baked into the page: a new fix must move the dot, not
  // reload the page and refetch every tile. The string is compared by value,
  // so the panel's frequent re-renders send nothing.
  useEffect(() => {
    if (!ready || failed) return;
    web.current?.injectJavaScript('window.__fence && window.__fence(' + payload + '); true;');
  }, [ready, failed, payload]);

  // Covers the one wait the page cannot time for itself: its own script
  // never arriving. From 'ready' on, the page times the style download and
  // deliberately nothing after it (see libreMapPage.ts).
  useEffect(() => {
    if (ready || failed) return;
    const id = setTimeout(() => setFailed(true), GIVE_UP_MS);
    return () => clearTimeout(id);
  }, [ready, failed, html, attempt]);

  const onMessage = (e: WebViewMessageEvent) => {
    const msg = e.nativeEvent.data;
    if (msg === 'ready') setReady(true);
    else if (msg === 'shown') setShown(true);
    else if (msg === 'failed') setFailed(true);
  };

  if (failed) return fallback;

  return (
    <View
      style={[styles.card, { height }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('map.label', { site: siteName })}
    >
      <View style={[StyleSheet.absoluteFill, styles.ground]} pointerEvents="none">
        <WebView
          key={(isDark ? 'dark-' : 'light-') + attempt}
          ref={web}
          source={{ html }}
          originWhitelist={['*']}
          onMessage={onMessage}
          onError={() => setFailed(true)}
          // Android kills a WebView's renderer under memory pressure; the
          // drawn fence is a better answer than a dead grey rectangle.
          onRenderProcessGone={() => setFailed(true)}
          javaScriptEnabled
          scrollEnabled={false}
          overScrollMode="never"
          setSupportMultipleWindows={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          style={styles.web}
        />
      </View>

      {shown ? (
        <>
          {/* Same two chips as the iOS and drawn maps, so switching between
              them is not a change of language. */}
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

          {/* Required by the tile licence wherever the tiles are shown. */}
          <View style={styles.attribution} pointerEvents="none">
            <Text style={styles.attributionText} numberOfLines={1}>
              {OPENFREEMAP_ATTRIBUTION}
            </Text>
          </View>

          <View style={styles.border} pointerEvents="none" />
        </>
      ) : (
        <View style={StyleSheet.absoluteFill}>{fallback}</View>
      )}
    </View>
  );
}

const lift = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  android: { elevation: 2 },
  default: {},
});

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    // No border here: the drawn fence brings its own while it is on top, and
    // the overlay below draws one once the map is. Never two at once.
    card: { borderRadius: radii.lg, overflow: 'hidden' },
    ground: { backgroundColor: colors.slate50 },
    web: { flex: 1, backgroundColor: 'transparent' },
    border: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.slate100,
    },
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
      ...lift,
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
      ...lift,
    },
    radiusChipText: { fontSize: 10, fontWeight: '800', color: colors.slate500 },
    attribution: {
      position: 'absolute',
      top: 6,
      right: 6,
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: colors.surface,
      opacity: 0.85,
    },
    attributionText: { fontSize: 8.5, fontWeight: '600', color: colors.slate500 },
  });
