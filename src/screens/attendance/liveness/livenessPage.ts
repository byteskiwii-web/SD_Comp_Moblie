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
// THE CHALLENGE: blink a few times, then turn left and right. It replaces a
// "trace a circle with your head" ring, which asked for a movement nobody makes
// naturally, took most of a minute, and failed constantly on the older phones --
// a tick missed at one bearing meant starting the circle again.
//
// The two gestures here are ones a person can do on the first try, and each is a
// separate signal: a blink is the classic photo-defeating cue, and a head turn
// exposes the profile a flat print cannot show. The ORDER OF THE TURNS IS
// RANDOM, which is the part that matters against a replayed video -- a recording
// cannot know which side will be asked for first.
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
  /* iOS draws a play/pause control over an inline video. It lands squarely on
     the face and can pause the stream if tapped. */
  video::-webkit-media-controls,
  video::-webkit-media-controls-panel,
  video::-webkit-media-controls-play-button,
  video::-webkit-media-controls-start-playback-button {
    display:none !important; -webkit-appearance:none; opacity:0; }
  canvas#overlay { position:absolute; inset:0; width:100%; height:100%; }

  /* The three steps, as a rail across the top. It is the only thing standing in
     for the ring's progress, and it answers the question the ring answered
     badly: how much of this is left. */
  #steps { position:absolute; top:calc(14px + env(safe-area-inset-top)); left:0; right:0;
    display:flex; justify-content:center; gap:7px; }
  #steps i { display:block; width:34px; height:4px; border-radius:2px;
    background:rgba(255,255,255,.28); transition:background .2s ease; }
  #steps i.on   { background:#fff; }
  #steps i.done { background:var(--ok); }

  /* Which way to turn, said with an arrow as well as words. The arrow sits on
     the side of the SCREEN the head should move towards, and the preview is
     mirrored, so it lands on the same side the person feels. */
  .arrow { position:absolute; top:46%; transform:translateY(-50%) scale(.8); opacity:0;
    font-size:74px; line-height:1; color:#fff; font-weight:300;
    text-shadow:0 4px 22px rgba(0,0,0,.6); transition:opacity .18s ease;
    pointer-events:none; }
  .arrow.left  { left:16px; }
  .arrow.right { right:16px; }
  .arrow.show  { opacity:1; animation:nudge 1.05s ease-in-out infinite; }
  @keyframes nudge {
    0%,100% { transform:translateY(-50%) translateX(0)     scale(1); opacity:.55; }
    50%     { transform:translateY(-50%) translateX(var(--dx)) scale(1.1); opacity:1; }
  }
  .arrow.left  { --dx:-12px; }
  .arrow.right { --dx: 12px; }
  @media (prefers-reduced-motion: reduce) { .arrow.show { animation:none; opacity:1; } }

  /* Blinks counted, as dots that fill. A bare number tells somebody they are
     being counted; a dot that fills tells them the blink registered. */
  #blinks { display:flex; justify-content:center; gap:9px; margin-top:12px; height:11px; }
  #blinks.hide { display:none; }
  #blinks span { width:11px; height:11px; border-radius:50%; background:rgba(255,255,255,.26);
    border:1.5px solid rgba(255,255,255,.5); transition:background .16s ease, transform .16s ease; }
  #blinks span.on { background:var(--ok); border-color:var(--ok); transform:scale(1.18); }

  #hud { position:absolute; left:0; right:0; bottom:0; padding:18px 20px calc(20px + env(safe-area-inset-bottom));
    background:linear-gradient(transparent,rgba(0,0,0,.78) 45%); text-align:center; }
  #prompt { color:#fff; font-size:16px; font-weight:700; line-height:1.35; }
  #sub { color:rgba(255,255,255,.72); font-size:12.5px; margin-top:6px; min-height:16px; }
  #badge { position:absolute; top:calc(48px + env(safe-area-inset-top)); left:50%;
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
  <video id="video" playsinline webkit-playsinline autoplay muted disablepictureinpicture controls="false"></video>
  <canvas id="overlay"></canvas>

  <div id="steps"><i id="s0"></i><i id="s1"></i><i id="s2"></i></div>
  <div class="arrow left"  id="arrowL">&#8249;</div>
  <div class="arrow right" id="arrowR">&#8250;</div>

  <div id="badge"><div class="tick">&#10003;</div><div class="txt">Liveness Verified</div></div>
  <div id="hud">
    <div id="prompt">Starting camera&hellip;</div>
    <div id="sub"></div>
    <div id="blinks" class="hide"><span></span><span></span><span></span></div>
    <button class="btn ghost" id="hudFallback" hidden>Continue without liveness</button>
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
var BLINKS_NEEDED = 3;     // "blink two or three times" -- three, counted
var TURN_DEG      = 16;    // head rotation from baseline that counts as a turn
var TURN_RATIO    = 0.11;  // ...corroborated by how far the nose has swung
var RECENTRE_DEG  = 8;     // must come back to roughly facing forward between turns
var CENTRE_TOL    = 0.18;  // how far off-centre the face may sit while aligning
var MIN_FACE      = 0.20;  // face height as a fraction of the frame, min
var MAX_FACE      = 0.78;  // ...and max
var HOLD_MS       = 500;   // how long alignment must hold before the challenge starts
var BLINK_SHUT    = 0.55;  // blendshape score meaning "eye closed"
var BLINK_OPEN    = 0.25;  // ...and "open again"
var TIMEOUT_MS    = 45000;

var RN = window.ReactNativeWebView;
function send(o) { try { if (RN) RN.postMessage(JSON.stringify(o)); } catch (e) {} }

var video    = document.getElementById("video");
var overlay  = document.getElementById("overlay");
var ctx      = overlay.getContext("2d");
var promptEl = document.getElementById("prompt");
var subEl    = document.getElementById("sub");
var badge    = document.getElementById("badge");
var errBox   = document.getElementById("err");
var blinksEl = document.getElementById("blinks");
var arrowL   = document.getElementById("arrowL");
var arrowR   = document.getElementById("arrowR");
var stepEls  = [document.getElementById("s0"), document.getElementById("s1"), document.getElementById("s2")];

var landmarker = null, stream = null, lastRes = null;
var baseYaw = null, basePitch = null;
var phase = "boot", finished = false, startedAt = 0, alignedAt = 0;
var lastVideoTime = -1, blinkShut = false, blinks = 0;
// Which way to turn, and in which order. Randomised per attempt: a replayed
// video of somebody turning left then right passes a fixed order every time.
var turnOrder = [], turnIndex = 0, recentred = true;
// Detection health. A CPU-delegate graph on old hardware can throw on every
// frame, and the empty catch this replaces made that look identical to "no
// face yet" -- forever, with nothing said.
var detectFails = 0, everSawFace = false;

function reset() {
  baseYaw = null; basePitch = null; alignedAt = 0;
  blinkShut = false; blinks = 0;
  turnOrder = Math.random() < 0.5 ? ["left", "right"] : ["right", "left"];
  turnIndex = 0; recentred = true;
  finished = false; phase = "align"; startedAt = performance.now();
  paintBlinks(); setStep(0); showArrow(null);
}

function paintBlinks() {
  var dots = blinksEl.children;
  for (var i = 0; i < dots.length; i++) {
    if (i < blinks) dots[i].classList.add("on"); else dots[i].classList.remove("on");
  }
}

// Step 0 aligning, 1 blinking, 2 turning. Anything before the current step is
// finished, which is the whole reason the rail exists.
function setStep(n) {
  for (var i = 0; i < stepEls.length; i++) {
    stepEls[i].className = i < n ? "done" : (i === n ? "on" : "");
  }
}

function showArrow(side) {
  if (side === "left")  { arrowL.classList.add("show");    arrowR.classList.remove("show"); }
  else if (side === "right") { arrowR.classList.add("show"); arrowL.classList.remove("show"); }
  else { arrowL.classList.remove("show"); arrowR.classList.remove("show"); }
}

function fail(title, body, kind, detail) {
  phase = "error";
  showArrow(null);
  document.getElementById("errTitle").textContent = title;
  document.getElementById("errBody").textContent = body;
  errBox.classList.add("show");
  send({ type: "error", kind: kind, message: String(detail || body) });
}

document.getElementById("cancel").onclick   = function () { send({ type: "cancel" }); };
document.getElementById("cancel2").onclick  = function () { send({ type: "cancel" }); };
document.getElementById("fallback").onclick = function () { send({ type: "fallback" }); };
document.getElementById("hudFallback").onclick = function () { send({ type: "fallback" }); };
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

/**
 * How far the nose has swung across the face, as a fraction of face width.
 *
 * This is what decides WHICH WAY the head turned, and it is deliberately not
 * the sign of the yaw angle: the sign of an Euler extraction depends on
 * conventions that are easy to assume wrongly and produce a check that asks for
 * left and only accepts right. The nose position is unambiguous in image space.
 *
 * Landmark 1 is the nose tip. Frames arrive UNMIRRORED, so the subject's own
 * left side is at the larger x -- turning their head to their left swings the
 * nose towards larger x, giving a positive ratio.
 */
function noseRatio(landmarks) {
  var minX = 1e9, maxX = -1e9;
  for (var i = 0; i < landmarks.length; i++) {
    if (landmarks[i].x < minX) minX = landmarks[i].x;
    if (landmarks[i].x > maxX) maxX = landmarks[i].x;
  }
  var w = maxX - minX;
  if (w <= 0) return 0;
  return (landmarks[1].x - (minX + maxX) / 2) / w;
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

// The only overlay left. A rectangular viewfinder, not a ring: the ring was
// progress dressed as a target, and with the challenge moved into the steps
// rail there is nothing for it to show.
function drawBrackets(colour) {
  var cw = window.innerWidth, ch = window.innerHeight;
  var m = Math.min(cw, ch) * 0.10, len = Math.min(cw, ch) * 0.10;
  var l = m, r = cw - m, t = ch * 0.16, b = ch * 0.76;
  ctx.save();
  ctx.lineCap = "round";

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

function pass() {
  phase = "verified"; finished = true;
  showArrow(null);
  setStep(3);
  // Repaint once in green: the loop stops here, so without this the last frame
  // on screen still shows the in-progress colour under a badge that says it
  // passed.
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  drawBrackets("#10B981");
  promptEl.textContent = "Liveness verified";
  subEl.textContent = "";
  blinksEl.classList.add("hide");
  badge.classList.add("show");
  send({ type: "status", phase: "verified" });
  setTimeout(capture, 550);   // let the badge land before the screen tears down
}

function loop() {
  if (finished || phase === "error") return;
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    try {
      lastRes = landmarker.detectForVideo(video, performance.now());
      detectFails = 0;
    } catch (e) {
      detectFails++;
      // Report the first, then allow for a transient. A graph that cannot run
      // at all fails every frame, so this trips in about a second rather than
      // silently burning the full timeout.
      if (detectFails === 1) send({ type: "error", kind: "detect", message: String(e && e.message ? e.message : e) });
      if (detectFails > 30) {
        fail("Face check will not run on this phone",
             "The camera works, but this device cannot run the face model. Continue without the liveness check, or use a newer phone.",
             "detect", String(e && e.message ? e.message : e));
        return;
      }
    }
  }

  var hasFace = lastRes && lastRes.faceLandmarks && lastRes.faceLandmarks.length > 0;
  drawBrackets("#4F63E6");

  if (!hasFace) {
    // Losing the face mid-challenge must not leave an arrow pointing at
    // nothing, or a half-lit dot suggesting a blink was just counted.
    showArrow(null);
    var waiting = performance.now() - startedAt;
    promptEl.textContent = "Position your face in the frame";
    // Say something more useful the longer nothing is found, and after ten
    // seconds stop pretending that waiting is the answer.
    subEl.textContent =
      waiting < 4000 ? ""
      : waiting < 10000 ? (everSawFace ? "Move back into the frame" : "Hold the phone at arm's length, face towards the light")
      : "Still looking. This phone runs the check slowly - give it a moment, or continue without it.";
    if (waiting > 10000) document.getElementById("hudFallback").hidden = false;
  } else {
    if (!everSawFace) { everSawFace = true; send({ type: "status", phase: "face-detected" }); }
    var project = projector();
    var box = faceBox(lastRes.faceLandmarks[0], project);
    var frac = box.h / window.innerHeight;
    var offX = Math.abs(box.cx - window.innerWidth / 2) / window.innerWidth;
    var offY = Math.abs(box.cy - window.innerHeight * 0.45) / window.innerHeight;

    if (phase === "align") {
      blinksEl.classList.add("hide");
      var ok = frac > MIN_FACE && frac < MAX_FACE && offX < CENTRE_TOL && offY < CENTRE_TOL;
      if (!ok) {
        alignedAt = 0;
        promptEl.textContent = frac <= MIN_FACE ? "Move a little closer"
                             : frac >= MAX_FACE ? "Move a little further away"
                             : "Centre your face in the frame";
        subEl.textContent = "";
      } else {
        if (!alignedAt) alignedAt = performance.now();
        promptEl.textContent = "Hold still";
        subEl.textContent = "";
        var mtx = lastRes.facialTransformationMatrixes && lastRes.facialTransformationMatrixes[0];
        if (performance.now() - alignedAt > HOLD_MS && mtx) {
          // Baseline taken while facing forward, so a turn is measured from
          // where this person's head actually rests rather than from zero.
          var base = yawPitchDeg(mtx.data);
          baseYaw = base.yaw; basePitch = base.pitch;
          phase = "blink";
          setStep(1);
          blinksEl.classList.remove("hide");
          send({ type: "status", phase: "blink" });
        }
      }

    } else if (phase === "blink") {
      // Counted on the OPENING edge, not on the closing one: a shut eye is a
      // state that persists for many frames, and counting frames would let
      // somebody pass by closing their eyes once and waiting.
      var lb = blendshape(lastRes, "eyeBlinkLeft"), rb = blendshape(lastRes, "eyeBlinkRight");
      if (lb > BLINK_SHUT && rb > BLINK_SHUT) {
        blinkShut = true;
      } else if (blinkShut && lb < BLINK_OPEN && rb < BLINK_OPEN) {
        blinkShut = false;
        blinks++;
        paintBlinks();
        if (blinks >= BLINKS_NEEDED) {
          phase = "turn";
          setStep(2);
          blinksEl.classList.add("hide");
          send({ type: "status", phase: "turn" });
        }
      }
      promptEl.textContent = "Blink " + BLINKS_NEEDED + " times";
      subEl.textContent = blinks + " of " + BLINKS_NEEDED;

    } else if (phase === "turn") {
      var want = turnOrder[turnIndex];
      showArrow(want);
      promptEl.textContent = want === "left" ? "Turn your head to the left"
                                             : "Turn your head to the right";

      var m2 = lastRes.facialTransformationMatrixes && lastRes.facialTransformationMatrixes[0];
      if (m2) {
        var now = yawPitchDeg(m2.data);
        var turned = Math.abs(now.yaw - baseYaw);
        var ratio = noseRatio(lastRes.faceLandmarks[0]);
        // Positive ratio is the subject's own left; see noseRatio.
        var side = ratio > TURN_RATIO ? "left" : (ratio < -TURN_RATIO ? "right" : null);

        if (!recentred) {
          // Between the two turns the head must come back through the middle.
          // Without this, a single sweep from far left to far right satisfies
          // both directions on the way past.
          subEl.textContent = "Face forward again";
          if (turned < RECENTRE_DEG && !side) recentred = true;
        } else if (turned > TURN_DEG && side === want) {
          turnIndex++;
          recentred = false;
          subEl.textContent = "";
          if (turnIndex >= turnOrder.length) { pass(); return; }
        } else {
          subEl.textContent = turnIndex === 0 ? "1 of 2" : "2 of 2";
        }
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
      video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 540 } }, audio: false
    });
    video.srcObject = stream;
    await video.play();
    send({ type: "status", phase: "camera-ready" });
  } catch (e) {
    fail("Camera blocked", "Allow camera access to verify your identity, then try again.",
         "camera", (e && e.name ? e.name + ": " : "") + (e && e.message ? e.message : e));
    return;
  }
  try {
    send({ type: "status", phase: "loading-model" });
    var fileset = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm");

    // GPU first, CPU when the device will not give WebGL a context.
    //
    // On an A11 iPhone the GPU delegate fails with
    // emscripten_webgl_create_context() returned error 0 -- WKWebView simply
    // does not hand MediaPipe a WebGL context there. CPU inference is slower
    // but works, and a slower check beats no check on the older half of the
    // device estate.
    var buildLandmarker = function (delegate) {
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: delegate
        },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: "VIDEO",
        numFaces: 1
      });
    };

    try {
      landmarker = await buildLandmarker("GPU");
    } catch (gpuErr) {
      send({ type: "status", phase: "gpu-unavailable-using-cpu" });
      landmarker = await buildLandmarker("CPU");
    }
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
