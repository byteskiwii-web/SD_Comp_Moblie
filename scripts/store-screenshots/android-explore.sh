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

# A clean status bar: Android's demo mode, the same 9:41 Apple uses. Set
# before every capture, not once: `argent flow run` pins its own status bar
# for the flow and on the way out sends "exit" and sets sysui_demo_allowed
# back to 0, so every shot after the first had the real clock and the app's
# notification icon. Hence the allow first, then a fresh "enter".
demo_mode() {
  local d="adb -s $SERIAL shell am broadcast -a com.android.systemui.demo -e command"
  adb -s "$SERIAL" shell settings put global sysui_demo_allowed 1
  $d enter >/dev/null
  $d clock -e hhmm 0941 >/dev/null
  $d battery -e level 100 -e plugged false >/dev/null
  $d network -e wifi show -e level 4 >/dev/null
  $d network -e mobile hide >/dev/null
  $d notifications -e visible false >/dev/null
  sleep 1
}
snap() {
  demo_mode
  adb -s "$SERIAL" exec-out screencap -p > "$OUT/$1.png" 2>/dev/null
  argent run describe --udid "$SERIAL" > "$OUT/$1.describe.txt" 2>&1
}
# The first-run tour. On Android it is a modal, and while it is up argent's
# tree holds only the modal -- "Home" and the tabs are not in it -- so a
# flow's await for them times out. Answered here, by the frame describe
# reports, before every flow and before a retry.
skip_tour() {
  local n=0 hit x y
  while [ $n -lt 3 ]; do
    hit=$(argent run describe --udid "$SERIAL" 2>/dev/null | python3 -c '
import json, re, sys
raw = sys.stdin.read()
try:
    text = json.loads(raw)["description"]
except Exception:
    text = raw
if "STEP " not in text:
    sys.exit()
m = re.search(r"Button \"Skip\" \[clickable\]\s+\(([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+)\)", text)
if m:
    x, y, w, h = map(float, m.groups())
    print(str(round(x + w / 2, 3)) + "|" + str(round(y + h / 2, 3)))
')
    [ -z "$hit" ] && return 0
    IFS='|' read -r x y <<< "$hit"
    echo "tour skipped at $x,$y" >> "$OUT/setup.txt"
    argent run gesture-tap --udid "$SERIAL" --x "$x" --y "$y" >> "$OUT/setup.txt" 2>&1
    sleep 2
    n=$((n + 1))
  done
}

flow() {
  skip_tour
  argent flow run ".argent/flows/explore/$1.yaml" --device "$SERIAL" > "$OUT/$1.flow.txt" 2>&1
  local rc=$?
  if [ $rc -ne 0 ]; then
    skip_tour
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

adb -s "$SERIAL" shell settings put global sysui_demo_allowed 1
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
