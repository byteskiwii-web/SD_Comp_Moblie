import { useCallback, useEffect, useRef, useState } from 'react';
import type { Face } from 'react-native-vision-camera-face-detector';

// Anti-spoof-photo gating (deters holding up a printed/static photo), NOT
// biometric identity verification against a stored reference photo.
export type LivenessState =
  | 'looking-for-face'
  | 'challenge-blink'
  | 'challenge-turn'
  | 'passed'
  | 'timeout';

const CHALLENGE_TIMEOUT_MS = 10000;
const EYES_CLOSED_THRESHOLD = 0.3;
const EYES_OPEN_THRESHOLD = 0.6;
const YAW_TURN_THRESHOLD_DEG = 15;

export function useLiveness(onPassed: () => void) {
  const [state, setState] = useState<LivenessState>('looking-for-face');
  const [challenge] = useState<'blink' | 'turn'>(() => (Math.random() < 0.5 ? 'blink' : 'turn'));
  const baselineYaw = useRef<number | null>(null);
  const hasBlinked = useRef(false);
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
    hasBlinked.current = false;
    setState('looking-for-face');
  }, [clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const armTimeout = useCallback(() => {
    clearTimer();
    timeoutRef.current = setTimeout(() => setState('timeout'), CHALLENGE_TIMEOUT_MS);
  }, [clearTimer]);

  const onFacesDetected = useCallback(
    (faces: Face[]) => {
      if (state === 'passed' || state === 'timeout') return;
      const face = faces[0];

      if (!face) {
        if (state !== 'looking-for-face') reset();
        return;
      }

      if (state === 'looking-for-face') {
        baselineYaw.current = face.yawAngle;
        hasBlinked.current = false;
        setState(challenge === 'blink' ? 'challenge-blink' : 'challenge-turn');
        armTimeout();
        return;
      }

      if (state === 'challenge-blink') {
        const leftClosed = (face.leftEyeOpenProbability ?? 1) < EYES_CLOSED_THRESHOLD;
        const rightClosed = (face.rightEyeOpenProbability ?? 1) < EYES_CLOSED_THRESHOLD;
        if (leftClosed && rightClosed) hasBlinked.current = true;

        const eyesOpenAgain =
          (face.leftEyeOpenProbability ?? 0) > EYES_OPEN_THRESHOLD &&
          (face.rightEyeOpenProbability ?? 0) > EYES_OPEN_THRESHOLD;

        if (hasBlinked.current && eyesOpenAgain) {
          clearTimer();
          setState('passed');
          onPassed();
        }
        return;
      }

      if (state === 'challenge-turn') {
        const base = baselineYaw.current ?? face.yawAngle;
        if (Math.abs(face.yawAngle - base) > YAW_TURN_THRESHOLD_DEG) {
          clearTimer();
          setState('passed');
          onPassed();
        }
      }
    },
    [state, challenge, onPassed, armTimeout, clearTimer, reset]
  );

  return { state, challenge, onFacesDetected, reset };
}
