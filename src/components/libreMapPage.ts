/**
 * The page the Android geofence map runs in.
 *
 * MapLibre GL JS drawing OpenFreeMap's vector tiles, inside a WebView. Chosen
 * over the two obvious alternatives for reasons that are about this app, not
 * about maps in general:
 *
 *   Google Maps (react-native-maps on Android) -- the map load itself is free,
 *   but Google will not serve a tile until a billing account with a card is
 *   attached to the project, and a key that ever leaks can be pointed at the
 *   APIs that are not free. OpenFreeMap has no key, no account and no usage
 *   limit, and permits commercial use.
 *
 *   @maplibre/maplibre-react-native -- native, so smoother, but it is not in
 *   Expo Go. The Android testers run Expo Go, and would never see the map they
 *   were meant to be testing; it would also need a new APK before anyone saw
 *   it at all. A WebView is in Expo Go and in every build already shipped, so
 *   this reaches everyone as an ordinary update.
 *
 * PINNED TO 5.24.0, the last UMD build. MapLibre 6 ships only as an ES module,
 * which a page loaded from a string cannot import without a bundler. The
 * integrity hashes pin the exact bytes: this page has a message bridge back
 * into the app, and a CDN serving something else should get a refused script,
 * not a running one. jsDelivr serves the pinned file as immutable, so after
 * the first load the WebView's own cache answers and the megabyte is paid once.
 *
 * WRITTEN WITHOUT BACKTICKS OR DOLLAR-BRACE. The whole page is one TypeScript
 * template literal; either would end it or splice into it. The style URL goes
 * in through a placeholder instead.
 *
 * Protocol, page to app, as plain strings:
 *   ready   the script is up; send state with window.__fence(state)
 *   shown   the first complete frame is on screen
 *   failed  no map is coming (no WebGL, CDN or style unreachable, timeout) --
 *           the app draws the SVG fence instead. Never sent once shown: a
 *           working map is not swapped out because a tile later went missing.
 */
const MAPLIBRE = 'https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/dist/';
const JS_SRI = 'sha384-5+cfbwT0iiub6VsQAdn6yz16nr6sDiQoHx6tm4O8OVYXHYOxcffFmCJBL0dgdvGp';
const CSS_SRI = 'sha384-uTttxo/aOKbdE5RlD/SPzSDoDmNvGlUYPjONi2MN/b7c9HPSvW07OIuyP7uL6jxK';

/**
 * Positron and Dark are OpenFreeMap's muted styles -- the same call the admin
 * console made for its own basemap: a backdrop for the fence, not a map to
 * read in its own right, so the amber and green ring is the loudest thing on
 * it. "liberty" is the colourful one if that is ever wanted.
 */
export const OPENFREEMAP_LIGHT = 'https://tiles.openfreemap.org/styles/positron';
export const OPENFREEMAP_DARK = 'https://tiles.openfreemap.org/styles/dark';

/** Attribution OpenMapTiles and OpenStreetMap require wherever the tiles show. */
export const OPENFREEMAP_ATTRIBUTION = '© OpenMapTiles © OpenStreetMap';

/** What the app sends in with window.__fence. */
export type LibreFenceState = {
  siteLat: number;
  siteLng: number;
  userLat: number | null;
  userLng: number | null;
  radius: number;
  tint: string;
  brand: string;
  frame: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
};

const PAGE = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="__MAPLIBRE__maplibre-gl.css" integrity="__CSS_SRI__" crossorigin="anonymous">
<style>
  html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: transparent; }
  /* Hidden, not display:none -- the map still needs its size to render the
     first frame, it just should not be seen half-drawn. */
  #map { position: absolute; top: 0; right: 0; bottom: 0; left: 0; visibility: hidden; }
  #map.shown { visibility: visible; }
  .pin { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #fff; box-sizing: border-box;
         display: flex; align-items: center; justify-content: center; }
  .dot { width: 18px; height: 18px; border-radius: 50%; border: 2px solid; box-sizing: border-box;
         background: #fff; display: flex; align-items: center; justify-content: center; }
  .core { width: 8px; height: 8px; border-radius: 50%; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  window.__post = function (m) {
    try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(m); } catch (e) {}
  };
</script>
<script src="__MAPLIBRE__maplibre-gl.js" integrity="__JS_SRI__" crossorigin="anonymous"
        onerror="window.__post('failed')"></script>
<script>
(function () {
  var shown = false, failed = false;
  function fail() {
    if (shown || failed) return;
    failed = true;
    window.__post('failed');
  }
  window.onerror = function () { fail(); };
  if (typeof maplibregl === 'undefined') { fail(); return; }

  var STYLE = __STYLE_URL__;
  var map = null, loaded = false, styleLoaded = false, latest = null;
  var siteMarker = null, siteEl = null;
  var userMarker = null, userEl = null, coreEl = null, userOn = false;

  // The fence as a 64-point ring. MapLibre has no circle-in-metres primitive;
  // a circle layer is sized in pixels and would not scale with the zoom.
  function ring(lat, lng, r) {
    var dLat = r / 111320;
    var dLng = r / (111320 * Math.max(Math.cos(lat * Math.PI / 180), 0.01));
    var pts = [];
    for (var i = 0; i <= 64; i++) {
      var a = (i / 64) * 2 * Math.PI;
      pts.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
    }
    return pts;
  }

  function bounds(f) {
    return [
      [f.longitude - f.longitudeDelta / 2, f.latitude - f.latitudeDelta / 2],
      [f.longitude + f.longitudeDelta / 2, f.latitude + f.latitudeDelta / 2]
    ];
  }

  // A building glyph, drawn rather than fetched, in the brand-coloured pin.
  var BUILDING =
    '<svg width="11" height="11" viewBox="0 0 24 24"><path fill="#fff" fill-rule="evenodd" d="' +
    'M5 3h10v6h4v12H5z' +
    'M8 6h2v2H8zM12 6h2v2h-2zM8 10h2v2H8zM12 10h2v2h-2zM8 14h2v2H8zM12 14h2v2h-2z' +
    'M16 12h1.5v2H16zM16 16h1.5v2H16zM10 18h2v3h-2z"/></svg>';

  function apply(s) {
    map.fitBounds(bounds(s.frame), { animate: false, padding: 0 });

    map.getSource('fence').setData({
      type: 'FeatureCollection',
      features: s.radius > 0
        ? [{ type: 'Feature', properties: {},
             geometry: { type: 'LineString', coordinates: ring(s.siteLat, s.siteLng, s.radius) } }]
        : []
    });
    map.setPaintProperty('fence', 'line-color', s.tint);

    siteEl.style.background = s.brand;
    siteMarker.setLngLat([s.siteLng, s.siteLat]);

    if (s.userLat != null && s.userLng != null) {
      userEl.style.borderColor = s.tint;
      coreEl.style.background = s.tint;
      userMarker.setLngLat([s.userLng, s.userLat]);
      if (!userOn) { userMarker.addTo(map); userOn = true; }
    } else if (userOn) {
      userMarker.remove();
      userOn = false;
    }
  }

  function create(s) {
    try {
      map = new maplibregl.Map({
        container: 'map',
        style: STYLE,
        bounds: bounds(s.frame),
        // A picture of where you are. The card sits in a scrolling page, and
        // the app also blocks touches before they reach this view.
        interactive: false,
        // Drawn by the app over the card instead, where it can be themed.
        attributionControl: false,
        fadeDuration: 0
      });
    } catch (e) {
      // No WebGL on this device.
      fail();
      return;
    }

    // Only the network is timed, never the drawing. A WebView behind another
    // tab or a locked screen does not render, so 'load' can legitimately wait
    // for as long as nobody is looking -- and a map waiting to be seen has not
    // failed. Once the style is in, everything left is rendering.
    var timer = setTimeout(fail, 20000);
    map.on('style.load', function () { styleLoaded = true; clearTimeout(timer); });
    // Only a failure to get the STYLE is fatal. A missing tile or glyph later
    // raises the same event and leaves a perfectly usable map.
    map.on('error', function () { if (!styleLoaded) { clearTimeout(timer); fail(); } });

    map.on('load', function () {
      if (failed) return;
      loaded = true;

      map.addSource('fence', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'fence',
        type: 'line',
        source: 'fence',
        // Dash lengths are in line widths: 3 x 2px = the 6/6 dash iOS draws.
        paint: { 'line-color': s.tint, 'line-width': 2, 'line-dasharray': [3, 3] }
      });

      siteEl = document.createElement('div');
      siteEl.className = 'pin';
      siteEl.innerHTML = BUILDING;
      siteMarker = new maplibregl.Marker({ element: siteEl, anchor: 'center' })
        .setLngLat([s.siteLng, s.siteLat])
        .addTo(map);

      userEl = document.createElement('div');
      userEl.className = 'dot';
      coreEl = document.createElement('div');
      coreEl.className = 'core';
      userEl.appendChild(coreEl);
      userMarker = new maplibregl.Marker({ element: userEl, anchor: 'center' });

      apply(latest);

      map.once('idle', function () {
        // Added, not assigned: MapLibre keeps its own classes on this element
        // and the map's layout depends on them.
        document.getElementById('map').classList.add('shown');
        shown = true;
        window.__post('shown');
      });
    });
  }

  window.__fence = function (s) {
    latest = s;
    if (failed) return;
    if (!map) { create(s); return; }
    if (loaded) apply(s);
  };

  window.__post('ready');
})();
</script>
</body>
</html>`;

export function buildLibreMapPage(styleUrl: string): string {
  // Replacement functions, not strings: a "$" in a replacement string is a
  // pattern, and none of these should ever be interpreted.
  return PAGE.replace(/__MAPLIBRE__/g, () => MAPLIBRE)
    .replace('__JS_SRI__', () => JS_SRI)
    .replace('__CSS_SRI__', () => CSS_SRI)
    .replace('__STYLE_URL__', () => JSON.stringify(styleUrl));
}
