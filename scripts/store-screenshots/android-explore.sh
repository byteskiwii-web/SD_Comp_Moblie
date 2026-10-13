#!/usr/bin/env bash
# The Android counterpart of explore.sh, for the Google Play screenshots:
# installs the release APK on the running emulator and plays the explore
# flows behind the goldie scenes (goldie/goldie.config.ts), saving a
# screenshot and argent's accessibility tree after each.
#
# Usage: android-explore.sh <emulator-serial> <output-dir> <path-to-.apk>
set -u
SERIAL="$1"; OUT="$2"; APK="$3"
mkdir -p "$OUT"

snap() {
  adb -s "$SERIAL" exec-out screencap -p > "$OUT/$1.png" 2>/dev/null
  argent run describe --udid "$SERIAL" > "$OUT/$1.describe.txt" 2>&1
}
flow() {
  argent flow run ".argent/flows/explore/$1.yaml" --device "$SERIAL" > "$OUT/$1.flow.txt" 2>&1
  local rc=$?
  if [ $rc -ne 0 ]; then
    argent flow run ".argent/flows/explore/$1.yaml" --device "$SERIAL" > "$OUT/$1.flow.txt" 2>&1
    rc=$?
  fi
  echo "$1: exit $rc" | tee -a "$OUT/summary.txt"
}

argent server start --detach >> "$OUT/setup.txt" 2>&1 || true
adb -s "$SERIAL" install -r -g "$APK" >> "$OUT/setup.txt" 2>&1
# -g grants the manifest's runtime permissions; notifications are not in the
# manifest list on every API level, so grant that one by name.
adb -s "$SERIAL" shell pm grant "$BUNDLE_ID" android.permission.POST_NOTIFICATIONS >> "$OUT/setup.txt" 2>&1 || true

# A clean status bar: Android's demo mode, the same 9:41 Apple uses.
adb -s "$SERIAL" shell settings put global sysui_demo_allowed 1
adb -s "$SERIAL" shell am broadcast -a com.android.systemui.demo -e command enter >/dev/null
adb -s "$SERIAL" shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 0941 >/dev/null
adb -s "$SERIAL" shell am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false >/dev/null
adb -s "$SERIAL" shell am broadcast -a com.android.systemui.demo -e command network -e wifi show -e level 4 >/dev/null
adb -s "$SERIAL" shell am broadcast -a com.android.systemui.demo -e command network -e mobile show -e datatype none -e level 4 >/dev/null
adb -s "$SERIAL" shell am broadcast -a com.android.systemui.demo -e command notifications -e visible false >/dev/null
# Standing at the lead's store (Navi Mumbai-Belapur), so the attendance
# scene shows the dot inside the fence rather than "outside geo-fence".
adb -s "$SERIAL" emu geo fix 73.02808 19.02598 >> "$OUT/setup.txt" 2>&1 || true

# Warm the cold JS bundle before the first flow's launch.
adb -s "$SERIAL" shell monkey -p "$BUNDLE_ID" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 25
snap 00-first-launch

for name in ${FLOWS:-03-sign-in 10-attendance-regularise 11-leave 12-leave-apply 15-profile-identity-verification 20-profile-language 23-sign-out 23b-lead-sign-in 25-lead-attendance}; do
  flow "$name"
  snap "$name"
done

adb -s "$SERIAL" logcat -d -b crash > "$OUT/crash.log" 2>&1 || true
adb -s "$SERIAL" logcat -d ReactNativeJS:V '*:S' > "$OUT/js.log" 2>&1 || true
