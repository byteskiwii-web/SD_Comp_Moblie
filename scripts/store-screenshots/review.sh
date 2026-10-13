#!/usr/bin/env bash
# Plays App Review: a fresh install with no permission granted in advance, the
# review account from the review notes, and every step those notes ask the
# reviewer to try, in order. Each step saves a screenshot and argent's
# accessibility tree; every system alert is photographed before it is
# answered, so the permission texts a reviewer reads are in the results.
#
# Usage: review.sh <simulator-udid> <output-dir> <path-to-.app>
#
# SIDE EFFECTS ON PRODUCTION: like the reviewer, it files a regularisation, a
# leave request and an account-deletion request for EMP-90001. Re-run
# scripts/seed-review-accounts.js on the server afterwards.
set -u
UDID="$1"; OUT="$2"; APP="$3"
mkdir -p "$OUT"

snap() {
  xcrun simctl io "$UDID" screenshot "$OUT/$1.png" >/dev/null 2>&1
  argent run describe --udid "$UDID" > "$OUT/$1.describe.txt" 2>&1
}

# System alerts are seen by the accessibility service but cannot be tapped by
# text from a flow, so they are answered here, by the frame describe reports.
# Answered the way a reviewer would: allow, while using the app.
alert_button() {
  argent run describe --udid "$UDID" 2>/dev/null | python3 -c '
import json, re, sys
raw = sys.stdin.read()
try:
    text = json.loads(raw)["description"]
except Exception:
    text = raw
for label in ["Allow While Using App", "Allow", "OK", "Continue"]:
    m = re.search(r"AXButton \"" + re.escape(label) + r"\"\s+\(([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+)\)", text)
    if m:
        x, y, w, h = map(float, m.groups())
        print(label + "|" + str(round(x + w / 2, 3)) + "|" + str(round(y + h / 2, 3)))
        break
'
}
answer_alerts() {
  local step="$1" n=0 hit
  while [ $n -lt 4 ]; do
    hit=$(alert_button)
    [ -z "$hit" ] && return 0
    n=$((n + 1))
    snap "$step-alert-$n"
    IFS='|' read -r label x y <<< "$hit"
    echo "$step: alert $n, tapped \"$label\"" | tee -a "$OUT/summary.txt"
    argent run gesture-tap --udid "$UDID" --x "$x" --y "$y" >> "$OUT/setup.txt" 2>&1
    sleep 2
  done
}

# Steps that file something on the server run once; the rest get one retry
# for anything transient (devtools handshake, an RPC timeout).
ONCE="r11-regularise-submit r12-leave-submit r16-delete-account"
step() {
  local name="$1" rc
  answer_alerts "$name-before"
  argent flow run ".argent/flows/review/$name.yaml" --device "$UDID" > "$OUT/$name.flow.txt" 2>&1
  rc=$?
  if [ $rc -ne 0 ] && [[ " $ONCE " != *" $name "* ]]; then
    answer_alerts "$name-retry"
    argent flow run ".argent/flows/review/$name.yaml" --device "$UDID" > "$OUT/$name.flow.txt" 2>&1
    rc=$?
  fi
  snap "$name"
  answer_alerts "$name"
  echo "$name: exit $rc" | tee -a "$OUT/summary.txt"
}

# What the reviewer's device is told: the permission texts and background
# modes in the built Info.plist.
plutil -convert json -o - "$APP/Info.plist" | python3 -c '
import json, sys
p = json.load(sys.stdin)
for k in sorted(p):
    if k.endswith("UsageDescription") or k in ("UIBackgroundModes", "UIRequiredDeviceCapabilities", "UIDeviceFamily", "NSAppTransportSecurity", "ITSAppUsesNonExemptEncryption", "CFBundleShortVersionString", "CFBundleVersion"):
        print(k + ": " + json.dumps(p[k]))
' > "$OUT/info-plist.txt"

# A clean device, as the reviewer's: nothing granted, nothing remembered.
argent server start --detach >> "$OUT/setup.txt" 2>&1 || true
xcrun simctl shutdown "$UDID" >/dev/null 2>&1 || true
xcrun simctl erase "$UDID" >> "$OUT/setup.txt" 2>&1 || true
argent run boot-device --udid "$UDID" >> "$OUT/setup.txt" 2>&1
argent server stop >> "$OUT/setup.txt" 2>&1 || true
argent server start --detach >> "$OUT/setup.txt" 2>&1 || true
argent run reinstall-app --udid "$UDID" --bundleId "$BUNDLE_ID" --appPath "$APP" >> "$OUT/setup.txt" 2>&1
# The reviewer is in Cupertino, as the simulator is by default; set it anyway.
xcrun simctl location "$UDID" set 37.3349,-122.0090 >> "$OUT/setup.txt" 2>&1 || true

# Cold first launch, timed: a slow first screen is a 2.1 finding on its own.
T0=$(date +%s)
argent run launch-app --udid "$UDID" --bundleId "$BUNDLE_ID" >> "$OUT/setup.txt" 2>&1 || true
argent run await-screen-idle --udid "$UDID" --timeoutMs 60000 >> "$OUT/setup.txt" 2>&1 || true
echo "first launch to idle: $(( $(date +%s) - T0 ))s" | tee -a "$OUT/summary.txt"
snap 00-first-launch
answer_alerts 00-first-launch

for f in .argent/flows/review/r[0-9]*.yaml; do
  step "$(basename "$f" .yaml)"
done

EXE=$(/usr/libexec/PlistBuddy -c "Print CFBundleExecutable" "$APP/Info.plist")
mkdir -p "$OUT/crashes"
grep -l "$BUNDLE_ID" ~/Library/Logs/DiagnosticReports/*.ips 2>/dev/null | while read -r f; do cp "$f" "$OUT/crashes/"; done
xcrun simctl spawn "$UDID" log show --last 90m --style compact \
  --predicate "process == \"$EXE\"" > "$OUT/app.log" 2>&1 || true
