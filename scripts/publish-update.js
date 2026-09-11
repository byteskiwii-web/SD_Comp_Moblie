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
const spawn = require('cross-spawn');

const branch = process.argv[2];
if (!branch) {
  console.error('Usage: node scripts/publish-update.js <branch> [extra eas args]');
  process.exit(1);
}

/*
 * Run in-process, not as a separate `&&`-chained npm script: npm's Windows
 * script runner re-quotes a *compound* (`a && b`) command line before handing
 * it to cmd.exe, and that re-quoting mangled a `--message "several words"`
 * forwarded through `--` (every space came back prefixed with a caret in the
 * published message). Requiring it here keeps package.json's scripts
 * single-command, which npm forwards args to untouched. check-api-url.js
 * calls process.exit(1) itself on failure, so requiring it doubles as the
 * check.
 */
require('./check-api-url');

/*
 * npx is itself a .cmd shim on Windows, and it re-quotes its own argv before
 * handing off to eas's .cmd shim underneath -- two batch-file hops, each
 * re-parsing the command line. A hand-built single quoted string (the usual
 * workaround for spawn's shell:true + argv-array bug, nodejs/node#29202)
 * still comes out corrupted here because it is the *npx* hop doing the
 * damage, not Node's own quoting. cross-spawn talks to the eas.cmd shim
 * directly (eas-cli is installed globally, resolved off PATH) and quotes
 * correctly for it, so going through npx at all is skipped.
 */
const result = spawn.sync(
  'eas',
  ['update', '--branch', branch, '--environment', branch, ...process.argv.slice(3)],
  {
    stdio: 'inherit',
    env: { ...process.env, EXPO_UPDATES_TARGET: 'build' },
  }
);

if (result.error) {
  if (result.error.code === 'ENOENT') {
    console.error('eas-cli is not on PATH. Install it once with: npm install -g eas-cli');
  } else {
    console.error(result.error.message);
  }
  process.exit(1);
}

process.exit(result.status ?? 1);
