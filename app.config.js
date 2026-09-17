/**
 * Dynamic layer over app.json.
 *
 * app.json stays the static base and is still the file to read for what the
 * app IS. This file only handles the two things a static file cannot express:
 * something that must differ between build profiles, and something long
 * enough that keeping it inline would bury everything else.
 *
 * Expo passes the parsed app.json in as `config`, so nothing here re-declares
 * what is already there.
 */
module.exports = ({ config }) => {
  /**
   * F1 — KEEP THE DEV LAUNCHER OUT OF STORE BUILDS.
   *
   * `expo-dev-client` was listed unconditionally in app.json's plugins, so it
   * was compiled into every build including release. On iOS that is visible
   * in the shipped binary: the generated Info.plist carried
   * NSLocalNetworkUsageDescription reading "Expo Dev Launcher uses the local
   * network to discover and connect to development servers…", plus
   * NSBonjourServices. A store reviewer reading the permission strings sees
   * an app asking for local-network access to find development servers, which
   * is both untrue of the shipped product and an obvious question to ask.
   *
   * It also pulled SYSTEM_ALERT_WINDOW ("draw over other apps") into the
   * Android manifest for the dev menu overlay. That is blocked separately in
   * app.json, but blocking a permission a plugin should not have added is
   * treating the symptom; this removes the cause.
   *
   * EAS sets EAS_BUILD_PROFILE to the profile name. Locally it is unset, and
   * a local `expo run` wants the dev client, so the default when nothing is
   * set is to include it — the restriction binds on CI, which is the only
   * place a store binary is produced.
   */
  /**
   * WHERE UPDATES COME FROM, AND WHO MAY ACCEPT THEM.
   *
   * Restored after f628e12 dropped it while rewriting this file for F1/F3.
   * Without these two keys the config has no updates URL at all, so
   * `eas update` has nowhere to publish and any native build made from it
   * can never fetch one -- a failure that is silent in both directions.
   *
   * Getting runtimeVersion wrong fails silently too: a client only accepts an
   * update whose runtime version equals its own, and a mismatch is not an
   * error -- the server simply has nothing to offer.
   *
   *   * Expo Go can only run an update stamped with the SDK it ships
   *     (exposdk:57.0.0), which is what the `sdkVersion` policy emits. That
   *     is the tester-facing channel, so it is the default here.
   *   * A native build has its own binary, unrelated to any Expo Go SDK, so
   *     it needs `appVersion`. eas.json sets EXPO_UPDATES_TARGET=build on
   *     every build profile, so a build can never inherit the Expo Go policy.
   */
  const projectId = config.extra?.eas?.projectId;
  if (!projectId) {
    throw new Error('app.json is missing expo.extra.eas.projectId; cannot build the updates URL.');
  }
  const isNativeBuild = process.env.EXPO_UPDATES_TARGET === 'build';

  const profile = process.env.EAS_BUILD_PROFILE;
  const wantsDevClient = profile === undefined || profile === 'development';

  const plugins = (config.plugins || []).filter((p) => {
    const name = Array.isArray(p) ? p[0] : p;
    return name !== 'expo-dev-client' || wantsDevClient;
  });

  /**
   * Dropping it from the array above is necessary but NOT sufficient. Expo
   * autolinks the config plugin of any installed package shipping an
   * app.plugin.js, so expo-dev-client keeps applying its iOS mod purely by
   * being in package.json — verified by introspecting with
   * EAS_BUILD_PROFILE=production and finding NSLocalNetworkUsageDescription
   * still present after the array no longer mentioned it.
   *
   * This runs last and removes the keys it added.
   */
  if (!wantsDevClient) plugins.push('./plugins/withoutDevLauncher');

  /**
   * NO GOOGLE MAPS KEY, ON PURPOSE.
   *
   * Android's geofence map used to be Google Maps through react-native-maps,
   * and a store build needed GOOGLE_MAPS_ANDROID_KEY here. Google will not
   * serve a tile to that key until a billing account with a card is attached,
   * and a key that leaks can be pointed at the APIs that do charge. Android
   * now draws OpenFreeMap in a WebView (src/components/GeofenceMap.libre.tsx),
   * which has no key at all, and iOS uses Apple Maps, which never needed one.
   *
   * So there is no key for the react-native-maps plugin to write into the
   * manifest, and the plugin is not added. MapView is never mounted on
   * Android, which is the only place it would have asked for one.
   */

  /**
   * FIREBASE, ONLY WHEN THERE IS A CONFIG FOR IT.
   *
   * Push notifications reach an Android phone through FCM, and FCM needs the
   * app to carry the Firebase project's google-services.json. Two things are
   * required for a push to arrive, and this is only one of them:
   *
   *   1. This file, in the build. Locally: put google-services.json in the
   *      repo root (gitignored). On EAS: `eas env:create --scope project
   *      --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json`
   *      and EAS writes it to a path it hands over in that variable.
   *   2. The FCM V1 service-account key on the EAS project:
   *      `eas credentials` → Android → Push Notifications. This is what lets
   *      Expo's push service call FCM on the project's behalf.
   *
   * Conditional on the file existing: a googleServicesFile path that does
   * not exist fails prebuild outright, and a build without push must still
   * be a build. Without the file the app runs exactly as before — the token
   * request fails, is caught, and the inbox keeps polling.
   */
  const fs = require('fs');
  const path = require('path');
  const googleServices = process.env.GOOGLE_SERVICES_JSON || path.join(__dirname, 'google-services.json');
  const android = fs.existsSync(googleServices)
    ? { ...config.android, googleServicesFile: googleServices }
    : config.android;

  /**
   * WHICH COMMIT THIS IS, for the build stamp at the bottom of Profile.
   *
   * Evaluated wherever the config is: at EAS build (which provides the hash,
   * and may not have a .git), at eas update publish, and when the dev server
   * serves a manifest to Expo Go. Null rather than a throw when there is no
   * git to ask -- a missing stamp must never be a failed build.
   */
  const buildCommit = (() => {
    if (process.env.EAS_BUILD_GIT_COMMIT_HASH) return process.env.EAS_BUILD_GIT_COMMIT_HASH.slice(0, 7);
    try {
      return require('child_process')
        .execSync('git rev-parse --short HEAD', { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim();
    } catch {
      return null;
    }
  })();

  return {
    ...config,
    extra: { ...config.extra, buildCommit },
    plugins,
    android,
    updates: {
      ...config.updates,
      url: `https://u.expo.dev/${projectId}`,
      // Never block the splash screen waiting on the update server: show the
      // bundle already on the device and fetch the new one in the background.
      fallbackToCacheTimeout: 0,
    },
    runtimeVersion: isNativeBuild ? { policy: 'appVersion' } : { policy: 'sdkVersion' },
    ios: {
      ...config.ios,
      /**
       * F3 — PRIVACY MANIFEST FOR THE APP ITSELF.
       *
       * Apple requires a declared reason for each "required reason API" an
       * app uses. Twelve bundled libraries ship their own PrivacyInfo
       * manifests, but Expo's own documentation warns that Apple does not
       * reliably parse the manifests of statically linked CocoaPods
       * dependencies — so the reasons have to be repeated at app level or
       * the upload draws an ITMS-91053 notice.
       *
       * Each entry below is the union of what the bundled libraries declare,
       * with the reason code Apple defines for that use:
       *
       *   C617.1  file timestamps, for files inside the app's own container
       *           (expo-file-system, React Native's caches)
       *   CA92.1  UserDefaults, read and written only by this app
       *           (React Native, AsyncStorage, expo-constants)
       *   35F9.1  system boot time, to measure elapsed time
       *           (React Native's performance timing)
       *   E174.1  available disk space, to check a write can succeed
       *           (expo-file-system, before saving a document or photo)
       *
       * None of these is used for tracking or fingerprinting, and the app
       * declares no tracking domains, which is why NSPrivacyTracking is false
       * and the tracking-domain list is empty rather than absent.
       *
       * NSPrivacyCollectedDataTypes is deliberately left out here: what this
       * app collects is declared in App Store Connect's privacy questionnaire,
       * and duplicating it in the manifest creates two answers that can drift.
       */
      privacyManifests: {
        NSPrivacyTracking: false,
        NSPrivacyTrackingDomains: [],
        NSPrivacyAccessedAPITypes: [
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
            NSPrivacyAccessedAPITypeReasons: ['C617.1'],
          },
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
            NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
          },
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
            NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
          },
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
            NSPrivacyAccessedAPITypeReasons: ['E174.1'],
          },
        ],
      },
    },
  };
};
