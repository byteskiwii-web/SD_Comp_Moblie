const { withInfoPlist } = require('expo/config-plugins');

/**
 * Strips the Expo Dev Launcher's Info.plist keys from store builds.
 *
 * WHY THIS IS NEEDED ON TOP OF REMOVING THE PLUGIN. Dropping
 * `expo-dev-client` from app.config.js's plugins array is not enough: Expo
 * autolinks the config plugin of any installed package that ships an
 * app.plugin.js, so expo-dev-client keeps applying its iOS mod purely by
 * being in package.json. Verified by introspecting the config with
 * EAS_BUILD_PROFILE=production — the plugin was gone from the array and
 * NSLocalNetworkUsageDescription was still there.
 *
 * WHAT IT LOOKS LIKE WITHOUT THIS. The shipped Info.plist declares:
 *
 *   NSLocalNetworkUsageDescription =
 *     "Expo Dev Launcher uses the local network to discover and connect to
 *      development servers…"
 *   NSBonjourServices = [_expo-development-server._tcp, …]
 *
 * A reviewer reading the permission strings sees a production app asking to
 * scan the local network for development servers. It is untrue of the
 * shipped product, and on iOS a declared local-network usage also triggers a
 * runtime consent prompt the employee has no reason to be shown.
 *
 * WHY DELETE RATHER THAN REWORD. Rewording would keep a capability the app
 * does not use. The app makes no local-network connections and advertises no
 * Bonjour service outside development, so the correct declaration is none.
 *
 * Must be registered LAST in the plugins array so it runs after the
 * autolinked plugin that adds the keys.
 */
module.exports = function withoutDevLauncher(config) {
  const profile = process.env.EAS_BUILD_PROFILE;
  // No profile means a local machine, where the dev launcher is wanted.
  const isDevBuild = profile === undefined || profile === 'development';
  if (isDevBuild) return config;

  return withInfoPlist(config, (cfg) => {
    delete cfg.modResults.NSLocalNetworkUsageDescription;
    delete cfg.modResults.NSBonjourServices;
    return cfg;
  });
};
