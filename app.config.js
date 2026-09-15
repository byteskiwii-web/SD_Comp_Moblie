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

  return {
    ...config,
    plugins,
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
