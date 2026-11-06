const { withInfoPlist } = require('expo/config-plugins');

/**
 * Removes the `fetch` background mode from the iOS Info.plist.
 *
 * WHERE IT COMES FROM. expo-task-manager's config plugin adds
 * UIBackgroundModes `fetch` just by being installed. The app uses
 * expo-task-manager for ONE thing: the background location task that runs the
 * mid-shift presence check (src/tasks/iosShiftLocationTask.ts), which needs
 * the `location` mode and nothing else. It never registers a background-fetch
 * task, so `fetch` would be a declared capability the app does not use.
 *
 * WHY IT MATTERS. App Review checks that every declared background mode is
 * used (Guideline 2.5.4). With `location` the app already has to justify one
 * mode; an unused second one only invites the question.
 *
 * Must be registered LAST in the plugins array, so it runs after the
 * autolinked plugin that adds the mode (same reason as withoutDevLauncher).
 */
module.exports = function withoutBackgroundFetch(config) {
  return withInfoPlist(config, (cfg) => {
    const modes = cfg.modResults.UIBackgroundModes;
    if (Array.isArray(modes)) {
      cfg.modResults.UIBackgroundModes = modes.filter((m) => m !== 'fetch');
    }
    return cfg;
  });
};
