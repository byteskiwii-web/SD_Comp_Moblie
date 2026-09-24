import { useCallback, useEffect, useRef, useState } from 'react';
import type { Face } from 'react-native-vision-camera-face-detector';

// Anti-spoof-photo gating (deters holding up a printed/static photo), NOT
// biometric identity verification against a stored reference photo.
//
// Sequential, not a coin flip: every attempt runs BOTH phases -- two distinct
// head turns, then three distinct blinks -- matching the rigor of the
// WebView/Expo Go liveness check (CameraCaptureScreen.webview -> livenessPage.ts,
// two turns / BLINKS_NEEDED=3). The two implementations must not diverge in
// how hard they are to spoof just because one runs on-device and the other
// in a WASM WebView.
//
// TURN BEFORE BLINK, NOT AFTER. The captured photo is taken the moment the
// last challenge completes, and blinking doesn't move the head while a turn
// does -- so ending on blinks means the capture is never taken mid-turn,
// without needing an extra "face forward and wait" pause tacked onto the end.
// Found on a real device: face checks were failing not on identity, but
// because the previous turn-last order captured every clock-in selfie
// side-on (see livenessPage.ts's identical fix for the full story).
export type LivenessState = 'looking-for-face' | 'challenge-blink' | 'challenge-turn' | 'timeout';

const CHALLENGE_TIMEOUT_MS = 10000;
const EYES_CLOSED_THRESHOLD = 0.3;
const EYES_OPEN_THRESHOLD = 0.6;
const YAW_TURN_THRESHOLD_DEG = 15;
// Must swing back within this of baseline between the two turns, or a single
// continuous turn-and-hold could be read as two -- see livenessPage.ts's own
// RECENTRE_DEG for the same reasoning.
const RECENTRE_DEG = 8;
const BLINKS_NEEDED = 3;
const TURNS_NEEDED = 2;

export function useLiveness(onPassed: () => void) {
  const [state, setState] = useState<LivenessState>('looking-for-face');
  const baselineYaw = useRef<number | null>(null);
  // Whether the eyes are CURRENTLY shut, reset after each counted blink so the
  // next shut/open cycle can count again -- a single persistent flag (as this
  // hook used to have) only ever detects one blink total.
  const eyesShut = useRef(false);
  const blinksDone = useRef(0);
  // Direction-agnostic on purpose: a turn is "did the head swing past the
  // threshold and back", not "did it go left then right". Asserting a
  // specific left/right order would require trusting the face detector's yaw
  // sign convention under front-camera mirroring, which nothing here has
  // verified on a real device.
  const turnsDone = useRef(0);
  const recentred = useRef(true);
  // Deliberately NOT reflected via useState -- setting state here would
  // re-render this screen in the same tick as capturePhotoToFile() starts,
  // which recreates the face-detector's CameraOutput (its own memoization
  // is keyed on an object that's rebuilt every render) and forces VisionCamera
  // to reconfigure/unbind the whole session mid-capture, aborting it. Instead
  // this ref just gates against re-triggering onPassed from a later frame;
  // the caller shows its own local "captured" UI state only *after* the
  // photo has actually been captured, when a re-render is harmless.
  const hasPassed = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    baselineYaw.current = null;
    eyesShut.current = false;
    blinksDone.current = 0;
    turnsDone.current = 0;
    recentred.current = true;
    hasPassed.current = false;
    setState('looking-for-face');
  }, [clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const armTimeout = useCallback(() => {
    clearTimer();
    timeoutRef.current = setTimeout(() => setState('timeout'), CHALLENGE_TIMEOUT_MS);
  }, [clearTimer]);

  const onFacesDetected = useCallback(
    (faces: Face[]) => {
      if (hasPassed.current || state === 'timeout') return;
      const face = faces[0];

      if (!face) {
        if (state !== 'looking-for-face') reset();
        return;
      }

      if (state === 'looking-for-face') {
        baselineYaw.current = face.yawAngle;
        eyesShut.current = false;
        blinksDone.current = 0;
        turnsDone.current = 0;
        recentred.current = true;
        setState('challenge-turn');
        armTimeout();
        return;
      }

      if (state === 'challenge-turn') {
        const base = baselineYaw.current ?? face.yawAngle;
        const turned = Math.abs(face.yawAngle - base);

        if (recentred.current) {
          if (turned > YAW_TURN_THRESHOLD_DEG) {
            recentred.current = false;
            turnsDone.current += 1;
            if (turnsDone.current >= TURNS_NEEDED) {
              eyesShut.current = false;
              blinksDone.current = 0;
              setState('challenge-blink');
              armTimeout();
            }
          }
        } else if (turned < RECENTRE_DEG) {
          // Between the two turns the head must come back through the middle.
          // Without this, a single sweep from far left to far right satisfies
          // both directions on the way past. Also what makes sure blinking
          // (next) always starts from a face that has already recentred.
          recentred.current = true;
        }
        return;
      }

      if (state === 'challenge-blink') {
        const leftClosed = (face.leftEyeOpenProbability ?? 1) < EYES_CLOSED_THRESHOLD;
        const rightClosed = (face.rightEyeOpenProbability ?? 1) < EYES_CLOSED_THRESHOLD;
        if (leftClosed && rightClosed) eyesShut.current = true;

        const eyesOpenAgain =
          (face.leftEyeOpenProbability ?? 0) > EYES_OPEN_THRESHOLD &&
          (face.rightEyeOpenProbability ?? 0) > EYES_OPEN_THRESHOLD;

        if (eyesShut.current && eyesOpenAgain) {
          eyesShut.current = false;
          blinksDone.current += 1;
          if (blinksDone.current >= BLINKS_NEEDED) {
            clearTimer();
            hasPassed.current = true;
            onPassed();
          }
        }
      }
    },
    [state, onPassed, armTimeout, clearTimer, reset]
  );

  return { state, onFacesDetected, reset };
}
