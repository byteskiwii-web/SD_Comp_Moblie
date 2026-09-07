#!/usr/bin/env node
/*
 * Refuses to publish an EAS Update built against an unreachable API URL.
 *
 * EXPO_PUBLIC_API_URL is inlined into the JS bundle at publish time, not read
 * on the device. Publish with a LAN address and every tester gets an app whose
 * requests hang forever against an IP that means something different on their
 * network -- with no error on screen, because the request never resolves. iOS
 * App Transport Security separately blocks plain http, so an http:// origin
 * fails on device even when the host is public.
 *
 * Both failures look identical to a tester: a blank screen. Cheaper to catch
 * here than in a support thread.
 */
const fs = require('fs');
const path = require('path');

const VAR = 'EXPO_PUBLIC_API_URL';

// Falls back to .env because `eas update` reads it, but plain `node` does not.
function readFromDotEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  let raw;
  try {
    raw = fs.readFileSync(envPath, 'utf8');
  } catch {
    return undefined;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    if (trimmed.slice(0, eq).trim() !== VAR) continue;
    return trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  }
  return undefined;
}

function hostnameOf(value) {
  try {
    return new URL(value).hostname;
  } catch {
    // Not a parseable URL; strip any scheme and take what looks like the host
    // so the checks below still catch an obviously-local value.
    return value.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split(/[/:?#]/)[0];
  }
}

const HOST_RULES = [
  [(h) => h === 'localhost' || h.endsWith('.localhost'), 'points at localhost'],
  [(h) => h.startsWith('127.'), 'points at the loopback address (127.x)'],
  [(h) => h.startsWith('10.'), 'is a private LAN address (10.x)'],
  [(h) => h.startsWith('192.168.'), 'is a private LAN address (192.168.x)'],
  [(h) => /^172\.(1[6-9]|2\d|3[01])\./.test(h), 'is a private LAN address (172.16-31.x)'],
];

function fail(reason, value) {
  console.error(`\n✖ ${VAR} ${reason}.`);
  if (value !== undefined) console.error(`  Current value: ${value}`);
  console.error(
    '\n  Testers run this bundle on their own phones, off your network, so the\n' +
      '  URL has to be a public https origin. For a local backend, expose it:\n' +
      '    cloudflared tunnel --url http://localhost:3000\n' +
      `  then put the https URL it prints into .env as ${VAR}.\n`
  );
  process.exit(1);
}

const value = process.env[VAR] || readFromDotEnv();

if (!value) fail('is not set (checked the environment and .env)', undefined);
if (value.includes('YOUR_LAN_IP')) fail('is still the .env.example placeholder', value);
// Host first: an unreachable address is the more fundamental problem, and
// LAN URLs are almost always http:// too -- reporting the scheme would bury it.
const hostname = hostnameOf(value);
for (const [test, reason] of HOST_RULES) {
  if (test(hostname)) fail(reason + ', which testers cannot reach', value);
}

if (value.startsWith('http://')) {
  fail('uses plain http, which iOS App Transport Security blocks on device', value);
}

console.log(`✔ ${VAR} = ${value}`);
