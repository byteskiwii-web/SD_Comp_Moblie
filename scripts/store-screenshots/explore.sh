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
# iOS asks for notifications once, after sign-in. While that alert is up argent
# cannot read the app at all (its RPCs time out) and every screenshot has the
# alert over it, so it is answered from outside the flows, by position: the
# accessibility service still sees the alert, it is just not tappable by text.
allow_alert() {
  if argent run describe --udid "$UDID" 2>/dev/null | grep -q "Would Like to Send You Notifications"; then
    # "Allow" button centre on the 6.9" simulator: (0.509 + 0.318/2, 0.560 + 0.050/2)
    argent run gesture-tap --udid "$UDID" --x 0.668 --y 0.585 >> "$OUT/setup.txt" 2>&1
    sleep 2
    echo "answered the notification prompt" >> "$OUT/setup.txt"
  fi
}
flow() {
  allow_alert
  argent flow run ".argent/flows/explore/$1.yaml" --device "$UDID" > "$OUT/$1.flow.txt" 2>&1
  local rc=$?
  # One re-run for anything transient: a cold start racing argent's devtools
  # handshake, an RPC timeout, the prompt appearing mid-flow.
  if [ $rc -ne 0 ]; then
    allow_alert
    argent flow run ".argent/flows/explore/$1.yaml" --device "$UDID" > "$OUT/$1.flow.txt" 2>&1
    rc=$?
  fi
  allow_alert
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
# ONLY narrows the run to some flows (a glob on the name, e.g. "0[1348]").
for f in .argent/flows/explore/${ONLY:-[0-9]}*.yaml; do
  name=$(basename "$f" .yaml)
  flow "$name"
  snap "$name"
done

# Anything that killed the app: its crash reports (the simulator writes them
# to the host's DiagnosticReports) and the app's own log lines.
EXE=$(/usr/libexec/PlistBuddy -c "Print CFBundleExecutable" "$APP/Info.plist")
mkdir -p "$OUT/crashes"
grep -l "$BUNDLE_ID" ~/Library/Logs/DiagnosticReports/*.ips 2>/dev/null | while read -r f; do cp "$f" "$OUT/crashes/"; done
xcrun simctl spawn "$UDID" log show --last 60m --style compact \
  --predicate "process == \"$EXE\"" > "$OUT/app.log" 2>&1 || true
