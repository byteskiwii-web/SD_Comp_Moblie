#!/usr/bin/env node
/*
 * Publishes an EAS Update stamped with the runtime version the native builds
 * actually carry.
 *
 * app.config.js chooses the runtimeVersion policy from EXPO_UPDATES_TARGET:
 * 'build' gives `appVersion` (1.0.0), anything else gives `sdkVersion`
 * (exposdk:57.0.0). eas.json sets that variable on every BUILD profile, so the
 * APKs are stamped 1.0.0 -- but `eas update` was run without it, so every
 * update was stamped exposdk:57.0.0 instead.
 *
 * A client only accepts an update whose runtime version equals its own, and a
 * mismatch is not an error: the server simply has nothing to offer, so the app
 * keeps running its embedded bundle forever and the publish looks like it
 * worked. Two weeks of updates reached nobody that way.
 *
 * Setting it here rather than inline in package.json because `VAR=x cmd` is not
 * valid on Windows, where this team runs.
 */
const { spawnSync } = require('node:child_process');

const branch = process.argv[2];
if (!branch) {
  console.error('Usage: node scripts/publish-update.js <branch> [extra eas args]');
  process.exit(1);
}

const result = spawnSync(
  'npx',
  ['eas', 'update', '--branch', branch, '--environment', branch, ...process.argv.slice(3)],
  {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, EXPO_UPDATES_TARGET: 'build' },
  }
);

process.exit(result.status ?? 1);
