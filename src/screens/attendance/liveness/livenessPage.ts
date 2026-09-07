// The liveness check that runs inside a WebView, as one self-contained HTML
// document.
//
// WHY A WEBVIEW AT ALL: Expo Go's binary has no face detector -- expo-face-detector
// was removed in SDK 51, and VisionCamera's Nitro detector is third-party native
// code that Expo Go cannot load. A browser engine, however, IS in that binary, and
// it can reach getUserMedia and run MediaPipe's face landmarker in WASM. So the
// detection Expo Go cannot do natively happens in a web page instead, still
// entirely on-device -- no frames leave the phone.
//
// WHY INLINE HTML: getUserMedia only works in a secure context. WKWebView derives
// the document origin from the WebView's baseUrl, so this string is injected with
// an https baseUrl and the page is treated as that origin. Serving the same markup
// from https://<api>/liveness works identically -- see LIVENESS_URL in
// CameraCaptureScreen.webview.tsx, which prefers a real URL whenever one is set.
//
// NOTE: this document must contain no backticks and no dollar-brace, because it
// lives in a template literal. Hence string concatenation throughout the script.
export const LIVENESS_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
<title>Liveness</title>
<style>
  :root { --brand:#4F63E6; --ok:#10B981; --ink:#0F172A; }
  * { box-sizing:border-box; -webkit-user-select:none; user-select:none; -webkit-tap-highlight-color:transparent; }
  html,body { margin:0; height:100%; background:#000; overflow:hidden;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  #stage { position:fixed; inset:0; }
  video { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transform:scaleX(-1); }
  canvas#overlay { position:absolute; inset:0; width:100%; height:100%; }
  #hud { position:absolute; left:0; right:0; bottom:0; padding:18px 20px calc(20px + env(safe-area-inset-bottom));
    background:linear-gradient(transparent,rgba(0,0,0,.78) 45%); text-align:center; }
  #prompt { color:#fff; font-size:16px; font-weight:700; line-height:1.35; }
  #sub { color:rgba(255,255,255,.72); font-size:12.5px; margin-top:6px; min-height:16px; }
  #badge { position:absolute; top:calc(18px + env(safe-area-inset-top)); left:50%;
    transform:translateX(-50%) scale(.88); opacity:0; transition:opacity .22s ease, transform .22s ease;
    background:#fff; border-radius:16px; padding:11px 16px; display:flex; align-items:center; gap:10px;
    box-shadow:0 10px 30px rgba(0,0,0,.35); pointer-events:none; }
  #badge.show { opacity:1; transform:translateX(-50%) scale(1); }
  #badge .tick { width:26px; height:26px; border-radius:50%; background:var(--ok); color:#fff;
    display:grid; place-items:center; font-size:15px; font-weight:900; line-height:1; }
  #badge .txt { font-size:14px; font-weight:800; color:var(--ink); letter-spacing:.1px; }
  #err { position:absolute; inset:0; display:none; place-items:center; padding:26px; background:#0B0F1A; }
  #err.show { display:grid; }
  #err h2 { color:#fff; font-size:17px; margin:0 0 10px; }
  #err p { color:rgba(255,255,255,.75); font-size:13.5px; line-height:1.5; margin:0 0 16px; }
  .btn { appearance:none; border:0; border-radius:12px; padding:14px 18px; font-size:15px;
    font-weight:700; width:100%; margin-top:10px; }
  .btn.primary { background:var(--brand); color:#fff; }
  .btn.ghost { background:rgba(255,255,255,.14); color:#fff; }
</style>
</head>
<body>
<div id="stage">
  <video id="video" playsinline autoplay muted></video>
  <canvas id="overlay"></canvas>
  <div id="badge"><div class="tick">&#10003;</div><div class="txt">Liveness Verified</div></div>
  <div id="hud">
    <div id="prompt">Starting camera&hellip;</div>
    <div id="sub"></div>
    <button class="btn ghost" id="cancel">Cancel</button>
  </div>
  <div id="err">
    <div>
      <h2 id="errTitle">Camera unavailable</h2>
      <p id="errBody"></p>
      <button class="btn primary" id="retry">Try again</button>
      <button class="btn ghost" id="fallback">Continue without liveness</button>
      <button class="btn ghost" id="cancel2">Cancel</button>
    </div>
  </div>
</div>
<script type="module">
import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs";

// ---- tunables: every threshold lives here so this is cheap to calibrate ----
var SECTORS    = 16;    // head-direction buckets the ring is divided into
var DASHES     = 60;    // drawn ticks; there are DASHES/SECTORS per sector
var NEEDED     = 11;    // sectors that must be covered to pass
var MOVE_DEG   = 7;     // rotation from baseline that counts as "moved"
var CENTRE_TOL = 0.18;  // how far off-centre the face may sit while aligning
var MIN_FACE   = 0.20;  // face height as a fraction of the frame, min
var MAX_FACE   = 0.78;  // ...and max
var HOLD_MS    = 500;   // how long alignment must hold before the ring arms
var BLINK_SHUT = 0.55;  // blendshape score meaning "eye closed"
var BLINK_OPEN = 0.25;  // ...and "open again"
var TIMEOUT_MS = 45000;

var RN = window.ReactNativeWebView;
function send(o) { try { if (RN) RN.postMessage(JSON.stringify(o)); } catch (e) {} }

var video    = document.getElementById("video");
var overlay  = document.getElementById("overlay");
var ctx      = overlay.getContext("2d");
var promptEl = document.getElementById("prompt");
var subEl    = document.getElementById("sub");
var badge    = document.getElementById("badge");
var errBox   = document.getElementById("err");

var landmarker = null, stream = null, lastRes = null;
var covered = [], baseYaw = null, basePitch = null;
var phase = "boot", finished = false, startedAt = 0, alignedAt = 0;
var lastVideoTime = -1, blinkShut = false;

function reset() {
  covered = []; for (var i = 0; i < SECTORS; i++) covered.push(false);
  baseYaw = null; basePitch = null; alignedAt = 0; blinkShut = false;
  finished = false; phase = "align"; startedAt = performance.now();
}

function fail(title, body, kind, detail) {
  phase = "error";
  document.getElementById("errTitle").textContent = title;
  document.getElementById("errBody").textContent = body;
  errBox.classList.add("show");
  send({ type: "error", kind: kind, message: String(detail || body) });
}

document.getElementById("cancel").onclick   = function () { send({ type: "cancel" }); };
document.getElementById("cancel2").onclick  = function () { send({ type: "cancel" }); };
document.getElementById("fallback").onclick = function () { send({ type: "fallback" }); };
document.getElementById("retry").onclick    = function () {
  errBox.classList.remove("show");
  if (!landmarker || !stream) { boot(); } else { reset(); requestAnimationFrame(loop); }
};

function resize() {
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  overlay.width  = Math.round(window.innerWidth  * dpr);
  overlay.height = Math.round(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);

// MediaPipe hands back a column-major 4x4, so r[row][col] === d[col*4 + row].
function yawPitchDeg(d) {
  var r20 = d[2], r21 = d[6], r22 = d[10];
  var pitch = Math.atan2(r21, r22);
  var yaw   = Math.atan2(-r20, Math.sqrt(r21 * r21 + r22 * r22));
  return { yaw: yaw * 180 / Math.PI, pitch: pitch * 180 / Math.PI };
}

function blendshape(res, name) {
  var bs = res.faceBlendshapes;
  if (!bs || !bs[0]) return 0;
  var cats = bs[0].categories;
  for (var i = 0; i < cats.length; i++) if (cats[i].categoryName === name) return cats[i].score;
  return 0;
}

// Normalised landmark -> on-screen CSS pixels, accounting for object-fit:cover
// and the mirrored preview.
function projector() {
  var cw = window.innerWidth, ch = window.innerHeight;
  var vw = video.videoWidth || cw, vh = video.videoHeight || ch;
  var s = Math.max(cw / vw, ch / vh);
  var dw = vw * s, dh = vh * s;
  var ox = (cw - dw) / 2, oy = (ch - dh) / 2;
  return function (nx, ny) { return { x: ox + (1 - nx) * dw, y: oy + ny * dh }; };
}

function faceBox(landmarks, project) {
  var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (var i = 0; i < landmarks.length; i++) {
    var p = project(landmarks[i].x, landmarks[i].y);
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY,
           cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

function drawBrackets(colour) {
  var cw = window.innerWidth, ch = window.innerHeight;
  var m = Math.min(cw, ch) * 0.10, len = Math.min(cw, ch) * 0.10;
  var l = m, r = cw - m, t = ch * 0.16, b = ch * 0.76;
  ctx.save();
  ctx.lineCap = "round";

  // The run between the corners, dashed and dimmer: it reads as a frame
  // without competing with the ring that is actually showing progress.
  ctx.strokeStyle = colour;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 9]);
  ctx.strokeRect(l, t, r - l, b - t);
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Solid corners on top, which is what makes it read as a viewfinder.
  ctx.lineWidth = 5;
  var corners = [[l, t, 1, 1], [r, t, -1, 1], [l, b, 1, -1], [r, b, -1, -1]];
  for (var i = 0; i < corners.length; i++) {
    var c = corners[i];
    ctx.beginPath();
    ctx.moveTo(c[0] + c[2] * len, c[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.lineTo(c[0], c[1] + c[3] * len);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRing(box, idleColour, activeColour) {
  var rx = box.w * 0.74, ry = box.h * 0.62;
  var per = DASHES / SECTORS;
  ctx.save();
  ctx.lineCap = "round";
  for (var i = 0; i < DASHES; i++) {
    var a = -Math.PI / 2 + (i / DASHES) * Math.PI * 2;
    var lit = covered[Math.floor(i / per)];
    var outer = lit ? 1.14 : 1.06;
    ctx.beginPath();
    ctx.moveTo(box.cx + rx * Math.cos(a), box.cy + ry * Math.sin(a));
    ctx.lineTo(box.cx + rx * outer * Math.cos(a), box.cy + ry * outer * Math.sin(a));
    ctx.strokeStyle = lit ? activeColour : idleColour;
    ctx.lineWidth = lit ? 4.5 : 2.5;
    // A covered direction glows. Growth alone is hard to see against a face.
    ctx.shadowBlur = lit ? 10 : 0;
    ctx.shadowColor = lit ? activeColour : "transparent";
    ctx.stroke();
  }
  ctx.restore();
}

function capture() {
  var c = document.createElement("canvas");
  c.width = video.videoWidth; c.height = video.videoHeight;
  // Deliberately NOT mirrored: the preview is flipped for the user's benefit,
  // but the stored selfie should match how the person actually looks.
  c.getContext("2d").drawImage(video, 0, 0, c.width, c.height);
  var url = c.toDataURL("image/jpeg", 0.8);
  send({ type: "captured", base64: url.slice(url.indexOf(",") + 1),
         width: c.width, height: c.height });
}

function loop() {
  if (finished || phase === "error") return;
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    try { lastRes = landmarker.detectForVideo(video, performance.now()); } catch (e) {}
  }

  var hasFace = lastRes && lastRes.faceLandmarks && lastRes.faceLandmarks.length > 0;
  var accent = "#4F63E6", idle = "rgba(255,255,255,.35)";
  drawBrackets(accent);

  if (!hasFace) {
    promptEl.textContent = "Position your face in the frame";
    subEl.textContent = "";
  } else {
    var project = projector();
    var box = faceBox(lastRes.faceLandmarks[0], project);
    var frac = box.h / window.innerHeight;
    var offX = Math.abs(box.cx - window.innerWidth / 2) / window.innerWidth;
    var offY = Math.abs(box.cy - window.innerHeight * 0.45) / window.innerHeight;

    drawRing(box, idle, accent);

    if (phase === "align") {
      var ok = frac > MIN_FACE && frac < MAX_FACE && offX < CENTRE_TOL && offY < CENTRE_TOL;
      if (!ok) {
        alignedAt = 0;
        promptEl.textContent = frac <= MIN_FACE ? "Move a little closer"
                             : frac >= MAX_FACE ? "Move a little further away"
                             : "Centre your face in the oval";
        subEl.textContent = "";
      } else {
        if (!alignedAt) alignedAt = performance.now();
        promptEl.textContent = "Hold still";
        subEl.textContent = "";
        var mtx = lastRes.facialTransformationMatrixes && lastRes.facialTransformationMatrixes[0];
        if (performance.now() - alignedAt > HOLD_MS && mtx) {
          var base = yawPitchDeg(mtx.data);
          baseYaw = base.yaw; basePitch = base.pitch;
          phase = "move";
          send({ type: "status", phase: "move" });
        }
      }
    } else if (phase === "move") {
      var m2 = lastRes.facialTransformationMatrixes && lastRes.facialTransformationMatrixes[0];
      if (m2) {
        var now = yawPitchDeg(m2.data);
        var dy = now.yaw - baseYaw, dp = now.pitch - basePitch;
        if (Math.sqrt(dy * dy + dp * dp) > MOVE_DEG) {
          var ang = Math.atan2(dy, -dp);                    // 0 = up, +90 = right
          var norm = (ang + Math.PI * 2) % (Math.PI * 2);
          covered[Math.floor(norm / (Math.PI * 2) * SECTORS)] = true;
        }
      }
      var n = 0;
      for (var k = 0; k < SECTORS; k++) if (covered[k]) n++;
      promptEl.textContent = "Slowly move your head in a circle";
      subEl.textContent = n + " of " + NEEDED;
      if (n >= NEEDED) { phase = "blink"; send({ type: "status", phase: "blink" }); }
    } else if (phase === "blink") {
      var lb = blendshape(lastRes, "eyeBlinkLeft"), rb = blendshape(lastRes, "eyeBlinkRight");
      if (lb > BLINK_SHUT && rb > BLINK_SHUT) blinkShut = true;
      promptEl.textContent = "Now blink";
      subEl.textContent = "";
      if (blinkShut && lb < BLINK_OPEN && rb < BLINK_OPEN) {
        phase = "verified"; finished = true;
        // Repaint once in green: the loop stops here, so without this the last
        // frame on screen still shows the in-progress colour under a badge
        // that says it passed.
        for (var v = 0; v < SECTORS; v++) covered[v] = true;
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        drawBrackets("#10B981");
        drawRing(box, idle, "#10B981");
        promptEl.textContent = "Liveness verified";
        badge.classList.add("show");
        send({ type: "status", phase: "verified" });
        setTimeout(capture, 550);   // let the badge land before the screen tears down
        return;
      }
    }
  }

  if (performance.now() - startedAt > TIMEOUT_MS) {
    fail("Couldn't verify",
         "The check timed out. Make sure your face is well lit and fully visible, then try again.",
         "timeout", "timeout");
    return;
  }
  requestAnimationFrame(loop);
}

async function boot() {
  reset();
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false
    });
    video.srcObject = stream;
    await video.play();
  } catch (e) {
    fail("Camera blocked", "Allow camera access to verify your identity, then try again.",
         "camera", (e && e.name ? e.name + ": " : "") + (e && e.message ? e.message : e));
    return;
  }
  try {
    var fileset = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm");
    landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU"
      },
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      runningMode: "VIDEO",
      numFaces: 1
    });
  } catch (e) {
    fail("Face check unavailable",
         "The liveness model could not be loaded. Check your connection and try again.",
         "model", e && e.message ? e.message : e);
    return;
  }
  resize();
  send({ type: "ready" });
  requestAnimationFrame(loop);
}

window.addEventListener("error", function (e) { send({ type: "error", kind: "js", message: String(e.message) }); });
boot();
</script>
</body>
</html>
`;
