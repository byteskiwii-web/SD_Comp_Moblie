// Layered over app.json: Expo reads this file when it exists and hands us the
// static config as `config`, so app.json stays the single place for everything
// that doesn't depend on how we're building.
//
// The one thing that DOES depend on that is `runtimeVersion`, and getting it
// wrong fails silently -- `eas update` publishes happily and no client ever
// picks the update up, because a client only accepts an update whose runtime
// version matches its own.
//
//   * Expo Go can only run an update stamped with the SDK it ships
//     (exposdk:57.0.0), which is exactly what the `sdkVersion` policy emits.
//     That is the tester-facing channel, so it is the default here.
//   * A real native build has its own binary, unrelated to any Expo Go SDK, so
//     it needs `appVersion` instead. eas.json sets EXPO_UPDATES_TARGET=build on
//     every build profile so builds can never silently inherit the Expo Go
//     policy.
module.exports = ({ config }) => {
  const projectId = config.extra?.eas?.projectId;
  if (!projectId) {
    throw new Error('app.json is missing expo.extra.eas.projectId; cannot build the updates URL.');
  }

  const isNativeBuild = process.env.EXPO_UPDATES_TARGET === 'build';

  return {
    ...config,
    updates: {
      ...config.updates,
      url: `https://u.expo.dev/${projectId}`,
      // Never block the splash screen waiting on the update server: show the
      // bundle already on the device and fetch the new one in the background.
      fallbackToCacheTimeout: 0,
    },
    runtimeVersion: isNativeBuild ? { policy: 'appVersion' } : { policy: 'sdkVersion' },
  };
};
