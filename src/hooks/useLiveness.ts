import { useCallback, useEffect, useRef, useState } from 'react';
import type { Face } from 'react-native-vision-camera-face-detector';

// Anti-spoof-photo gating (deters holding up a printed/static photo), NOT
// biometric identity verification against a stored reference photo.
//
// TWO BLINKS, NO HEAD TURN. This used to also require two head turns before
// the blinks, matching the WebView/Expo Go liveness check
// (CameraCaptureScreen.webview -> livenessPage.ts). Both were simplified to
// blink-only at the same time and must not diverge -- same two-blink rule,
// same passive forward-facing gate, in both places.
//
// THE FORWARD-FACING GATE STAYS, BUT IT IS NO LONGER A STEP. Found on a real
// device (Sep 2026): a blink counted the instant it happened regardless of
// head angle, and a selfie captured mid-turn became the face on file, which
// every later forward-facing clock-in then failed to match. The fix then was
// a turn-then-recentre challenge before blinking; the turn is gone now, but
// the underlying lesson -- a blink while turned away is not evidence of
// anything, because a turned-away eye reads as "closed" too -- still holds.
// So a blink only ever counts while the face is within FORWARD_TOLERANCE_DEG
// of where it was first detected. This is reactive, not a challenge: nothing
// is asked of the user beyond looking at the camera and blinking twice; the
// 'not-forward' state only ever appears if they happen to glance away
// mid-blink, and clears itself the instant they look back.
export type LivenessState = 'looking-for-face' | 'not-forward' | 'challenge-blink' | 'timeout';

const CHALLENGE_TIMEOUT_MS = 10000;
const EYES_CLOSED_THRESHOLD = 0.3;
const EYES_OPEN_THRESHOLD = 0.6;
// How far off the angle the face was first detected at still counts as
// "forward" -- generous enough for natural head wobble, tight enough that a
// genuine turn-away does not count a blink. Same tolerance the old
// turn-challenge used between its two turns.
const FORWARD_TOLERANCE_DEG = 8;
const BLINKS_NEEDED = 2;

export function useLiveness(onPassed: () => void) {
  const [state, setState] = useState<LivenessState>('looking-for-face');
  const baselineYaw = useRef<number | null>(null);
  // Whether the eyes are CURRENTLY shut, reset after each counted blink so the
  // next shut/open cycle can count again -- a single persistent flag (as this
  // hook used to have) only ever detects one blink total.
  const eyesShut = useRef(false);
  const blinksDone = useRef(0);
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
        setState('challenge-blink');
        armTimeout();
        return;
      }

      const facingForward = Math.abs(face.yawAngle - (baselineYaw.current ?? face.yawAngle)) < FORWARD_TOLERANCE_DEG;

      if (!facingForward) {
        // A turned-away eye reads as closed, which is how false blinks used
        // to be counted in an instant -- so a glance away resets the
        // in-progress blink rather than letting it count, and the state
        // reflects it so the screen can say "face forward" without this ever
        // having been a step the user had to deliberately complete.
        eyesShut.current = false;
        if (state !== 'not-forward') setState('not-forward');
        return;
      }
      if (state === 'not-forward') setState('challenge-blink');

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
    },
    [state, onPassed, armTimeout, clearTimer, reset]
  );

  return { state, onFacesDetected, reset };
}
