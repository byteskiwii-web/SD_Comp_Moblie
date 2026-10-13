#!/usr/bin/env bash
# The half of the reviewer's path a simulator cannot do: it has no camera, so
# the app cannot take the clock-in selfie. This sends the same requests the
# app sends -- sign in, clock in with a photo, break, clock out -- as the
# review account, from where the reviewer is (Cupertino), and records what the
# server answers. Also checks the URLs in the listing open.
#
# Usage: review-api.sh <output-dir> <any-png>      needs REVIEW_PASSWORD
set -u
OUT="$1"; PHOTO="$2"; mkdir -p "$OUT"
API="${EXPO_PUBLIC_API_URL}/api/v1"
LOG="$OUT/api.txt"; : > "$LOG"
LAT=37.3349; LNG=-122.0090

for u in https://web.zobconnect.com/privacy https://web.zobconnect.com/support https://web.zobconnect.com/terms; do
  echo "GET $u -> $(curl -s -o /dev/null -w '%{http_code}' -L "$u")" >> "$LOG"
done

# Prints the status and the response with the tokens cut out.
call() {
  local label="$1"; shift
  local code
  code=$(curl -s -o "$OUT/resp.json" -w '%{http_code}' "$@")
  echo "== $label -> HTTP $code" >> "$LOG"
  python3 - "$OUT/resp.json" >> "$LOG" <<'PY'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    print(open(sys.argv[1]).read()[:600]); sys.exit()
def scrub(o):
    if isinstance(o, dict):
        return {k: ("<redacted>" if "token" in k.lower() else scrub(v)) for k, v in o.items()}
    if isinstance(o, list):
        return [scrub(v) for v in o[:5]]
    return o
print(json.dumps(scrub(d), indent=1)[:2500])
PY
}

curl -s -o "$OUT/login.json" -H 'Content-Type: application/json' \
  -d "$(python3 -c 'import json,os; print(json.dumps({"employee_id":"EMP-90001","password":os.environ["REVIEW_PASSWORD"]}))')" \
  "$API/auth/login"
TOKEN=$(python3 -c 'import json; print(json.load(open("'"$OUT/login.json"'")).get("data",{}).get("accessToken",""))')
python3 -c 'import json; d=json.load(open("'"$OUT/login.json"'")); print("== login ->", "ok" if d.get("data",{}).get("accessToken") else json.dumps(d)[:600])' >> "$LOG"
rm -f "$OUT/login.json"
[ -n "$TOKEN" ] || { echo "no session; stopping" >> "$LOG"; exit 0; }
AUTH=(-H "Authorization: Bearer $TOKEN")

call "me" "${AUTH[@]}" "$API/auth/me"
call "onboarding" "${AUTH[@]}" "$API/auth/me/onboarding"

# A photo to stand in for the selfie. Test accounts skip the face match, so
# any image is what the server accepts from a reviewer's phone.
sips -s format jpeg -Z 640 "$PHOTO" --out "$OUT/selfie.jpg" >/dev/null
ls -l "$OUT/selfie.jpg" >> "$LOG"

NOW() { date -u +%Y-%m-%dT%H:%M:%SZ; }
call "clock-in" "${AUTH[@]}" -F store_code=A001 -F latitude=$LAT -F longitude=$LNG -F accuracy_m=15 \
  -F client_timestamp="$(NOW)" -F device_id=review-sim -F "selfie=@$OUT/selfie.jpg;type=image/jpeg" "$API/attendance/clock-in"
sleep 3
call "break-start" "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d "{\"store_code\":\"A001\",\"latitude\":$LAT,\"longitude\":$LNG,\"client_timestamp\":\"$(NOW)\",\"device_id\":\"review-sim\"}" "$API/attendance/break-start"
sleep 3
call "break-end" "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d "{\"store_code\":\"A001\",\"latitude\":$LAT,\"longitude\":$LNG,\"client_timestamp\":\"$(NOW)\",\"device_id\":\"review-sim\"}" "$API/attendance/break-end"
sleep 3
call "clock-out" "${AUTH[@]}" -F store_code=A001 -F latitude=$LAT -F longitude=$LNG -F accuracy_m=15 \
  -F client_timestamp="$(NOW)" -F device_id=review-sim -F "selfie=@$OUT/selfie.jpg;type=image/jpeg" "$API/attendance/clock-out"
call "deletion status" "${AUTH[@]}" "$API/auth/me/deletion"
rm -f "$OUT/resp.json"
