#!/usr/bin/env bash
# Walks every screen once, as the review account, and saves for each a
# screenshot and argent's accessibility tree. The output is what the goldie
# flows in .argent/flows are written from. Keeps going past a failed step, so
# one run shows as much of the app as it can reach.
#
# Usage: explore.sh <simulator-udid> <output-dir> <path-to-.app>
set -u
UDID="$1"; OUT="$2"; APP="$3"
mkdir -p "$OUT"

snap() {
  xcrun simctl io "$UDID" screenshot "$OUT/$1.png" >/dev/null 2>&1
  argent run describe --udid "$UDID" > "$OUT/$1.describe.txt" 2>&1
}
flow() {
  argent flow run ".argent/flows/explore/$1.yaml" --device "$UDID" > "$OUT/$1.flow.txt" 2>&1
  local rc=$?
  # A cold start can outrun argent's devtools handshake on the launch step;
  # argent's own message says a re-run is the fix (goldie retries the same way).
  if [ $rc -ne 0 ] && grep -q "could not connect to native devtools" "$OUT/$1.flow.txt"; then
    argent flow run ".argent/flows/explore/$1.yaml" --device "$UDID" > "$OUT/$1.flow.txt" 2>&1
    rc=$?
  fi
  echo "$1: exit $rc" | tee -a "$OUT/summary.txt"
}

# The same setup goldie does before a capture. Booted through argent, so iOS
# system alerts (the notification prompt) show up in its UI tree; the server
# is restarted after the reboot because it keeps the old simulator transport.
argent server start --detach >> "$OUT/setup.txt" 2>&1 || true
xcrun simctl shutdown "$UDID" >/dev/null 2>&1 || true
argent run boot-device --udid "$UDID" >> "$OUT/setup.txt" 2>&1
argent server stop >> "$OUT/setup.txt" 2>&1 || true
argent server start --detach >> "$OUT/setup.txt" 2>&1 || true
argent run reinstall-app --udid "$UDID" --bundleId "$BUNDLE_ID" --appPath "$APP" >> "$OUT/setup.txt" 2>&1

# Location and photos are granted up front, as a person would on first use;
# the notification prompt cannot be pre-granted on iOS and is answered by 04-home.
for p in location photos camera; do
  argent run settings-permissions --udid "$UDID" --action grant --permission "$p" \
    --bundleId "$BUNDLE_ID" >> "$OUT/setup.txt" 2>&1
done

# The first launch after an install pays for a cold JS bundle; pay it here so
# the first flow's launch step does not time out on it.
argent run launch-app --udid "$UDID" --bundleId "$BUNDLE_ID" >> "$OUT/setup.txt" 2>&1 || true
argent run await-screen-idle --udid "$UDID" --timeoutMs 60000 >> "$OUT/setup.txt" 2>&1 || true
snap 00-first-launch

# Every screen, in order. Each flow relaunches into the signed-in app
# (_home.yaml) or continues from the previous one; a failure only costs that
# screen, and its screenshot shows where it stopped.
for f in .argent/flows/explore/[0-9]*.yaml; do
  name=$(basename "$f" .yaml)
  flow "$name"
  snap "$name"
done
