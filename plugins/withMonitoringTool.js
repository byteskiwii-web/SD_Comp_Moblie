const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Declares the app to Android as an employer monitoring tool.
 *
 * WHY THIS IS REQUIRED, not optional. Google Play's stalkerware policy bans
 * apps that track a person's location and report it to someone else. There is
 * one carve-out, and it is for employee monitoring with the employee's
 * knowledge — but claiming it is not automatic. The app has to say so in the
 * manifest:
 *
 *     android.content.isMonitoringTool = enterprise_management
 *
 * Without this flag, an app that samples location every 12 minutes and sends
 * it to an employer looks exactly like the thing the policy exists to stop,
 * and is rejected on that basis. With it, Play applies the employer-monitoring
 * rules instead, which this app already satisfies in every other respect: a
 * persistent foreground-service notification while tracking, an in-app
 * disclosure before the permission is requested, and tracking that stops when
 * the shift ends.
 *
 * `enterprise_management` is the correct value of the three Google defines. It
 * means the device user is an employee and the monitoring is done by their
 * employer. (`parental_control` and `other` are the others; neither describes
 * this.)
 *
 * WHY A CONFIG PLUGIN. app.json can add permissions but has no way to declare
 * arbitrary manifest meta-data, and the project has no android/ directory to
 * edit by hand — it is a managed Expo app where the manifest is generated at
 * build time. A config plugin is the supported way to reach into that
 * generated manifest, and it re-applies on every prebuild, so the flag cannot
 * be lost the way a hand-edited android/ folder would be.
 *
 * The Play Console listing must ALSO carry a monitoring disclosure. That is a
 * console task, not a code one — it cannot be done from here.
 */
const FLAG = 'android.content.isMonitoringTool';
const VALUE = 'enterprise_management';

module.exports = function withMonitoringTool(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (!app) throw new Error('withMonitoringTool: no <application> in the manifest');

    app['meta-data'] = app['meta-data'] || [];

    // Idempotent: prebuild can run repeatedly against the same manifest, and a
    // duplicated meta-data name is a manifest merge failure, not a warning.
    const existing = app['meta-data'].find((m) => m.$?.['android:name'] === FLAG);
    if (existing) {
      existing.$['android:value'] = VALUE;
      return cfg;
    }

    app['meta-data'].push({ $: { 'android:name': FLAG, 'android:value': VALUE } });
    return cfg;
  });
};
