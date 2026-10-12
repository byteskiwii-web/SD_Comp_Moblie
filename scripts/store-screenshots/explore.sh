#!/usr/bin/env bash
# Walks every screen once, as the review account, and saves for each a
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
# the notification prompt cannot be pre-granted on iOS and is answered by 04-home.
for p in location photos camera; do
  argent run settings-permissions --udid "$UDID" --action grant --permission "$p" \
    --bundleId "$BUNDLE_ID" >> "$OUT/permissions.txt" 2>&1
done

# Every screen, in order. Each flow relaunches into the signed-in app
# (_home.yaml) or continues from the previous one; a failure only costs that
# screen, and its screenshot shows where it stopped.
for f in .argent/flows/explore/[0-9]*.yaml; do
  name=$(basename "$f" .yaml)
  flow "$name"
  snap "$name"
done
