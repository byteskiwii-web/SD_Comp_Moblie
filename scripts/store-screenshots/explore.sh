#!/usr/bin/env bash
# Walks the main screens once, as the review account, and saves for each a
# screenshot and argent's accessibility tree. The output is what the goldie
# flows in .argent/flows are written from. Keeps going past a failed step, so
# one run shows as much of the app as it can reach.
#
# Usage: explore.sh <simulator-udid> <output-dir>
set -u
UDID="$1"; OUT="$2"
mkdir -p "$OUT"

snap() {
  xcrun simctl io "$UDID" screenshot "$OUT/$1.png" >/dev/null 2>&1
  argent run describe --udid "$UDID" > "$OUT/$1.describe.txt" 2>&1
}
flow() {
  argent flow run ".argent/flows/explore/$1.yaml" --device "$UDID" > "$OUT/$1.flow.txt" 2>&1
  echo "$1: exit $?" | tee -a "$OUT/summary.txt"
}

# Location and photos are granted up front, as a person would on first use;
# the notification prompt cannot be pre-granted on iOS and is seen in 02/03.
for p in location photos camera; do
  argent run settings-permissions --udid "$UDID" --action grant --permission "$p" \
    --bundleId "$BUNDLE_ID" >> "$OUT/permissions.txt" 2>&1
done

flow 01-launch;          snap 01-login
flow 02-sign-in;         snap 02-after-sign-in
flow 03-dismiss;         snap 03-home
flow 04-attendance;      snap 04-attendance
flow 05-history-day;     snap 05-history-day
flow 06-leave;           snap 06-leave
flow 07-profile;         snap 07-profile
flow 08-profile-account; snap 08-privacy-account
