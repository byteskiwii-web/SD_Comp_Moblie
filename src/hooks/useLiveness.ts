import { useCallback, useEffect, useRef, useState } from 'react';
import type { Face } from 'react-native-vision-camera-face-detector';
import { createTracker, isStraight, pickChallenges, type ChallengeKind, type ChallengeTracker } from './livenessChallenges';

// Anti-spoof gating, NOT biometric identity verification against a stored
// reference photo -- the server does that with the picture this ends up taking.
//
// A DIFFERENT RANDOM SEQUENCE EVERY ATTEMPT (2 or 3 tasks, see
// livenessChallenges.ts). It used to be "blink twice" every time, which a video
// recorded in advance of the owner blinking passed in full. The detector cannot
// tell a screen from a face, so the defence is asking for something the
// recording could not have known to include.
//
// THE PHOTO COMES AFTER A PAUSE, NOT THE INSTANT THE LAST TASK ENDS. It was
// taken on the final blink, as the eyes were still reopening, and a picture
// taken mid-movement is the one the server then has to recognise. After the
// last task the person is asked to look at the camera and the photo is taken
// SETTLE_MS later, provided the face stays straight enough (isStraight) for that
// whole time; a face that leaves the view or turns away restarts the pause. That
// is what keeps a head still turned from a task out of the picture, whichever
// task came last.
export type LivenessState = 'looking-for-face' | 'challenge' | 'settling' | 'timeout';

// Each task gets its own fresh allowance; the pause after the last one too.
const TASK_TIMEOUT_MS = 10000;
const SETTLE_MS = 1500;

export function useLiveness(onPassed: () => void) {
  const [state, setState] = useState<LivenessState>('looking-for-face');
  const [plan, setPlan] = useState<ChallengeKind[]>([]);
  const [step, setStep] = useState(0);
  const planRef = useRef<ChallengeKind[]>([]);
  const stepRef = useRef(0);
  const tracker = useRef<ChallengeTracker | null>(null);
  // When the current uninterrupted run of "a straight face is in view" began, during the pause.
  const settleSince = useRef<number | null>(null);
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
    planRef.current = [];
    stepRef.current = 0;
    tracker.current = null;
    settleSince.current = null;
    hasPassed.current = false;
    setPlan([]);
    setStep(0);
    setState('looking-for-face');
  }, [clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const armTimeout = useCallback(() => {
    clearTimer();
    timeoutRef.current = setTimeout(() => setState('timeout'), TASK_TIMEOUT_MS);
  }, [clearTimer]);

  const onFacesDetected = useCallback(
    (faces: Face[]) => {
      if (hasPassed.current || state === 'timeout') return;
      const face = faces[0];
      const now = Date.now();
      const signals = face && {
        yaw: face.yawAngle,
        pitch: face.pitchAngle,
        roll: face.rollAngle,
        leftEye: face.leftEyeOpenProbability,
        rightEye: face.rightEyeOpenProbability,
        smile: face.smilingProbability,
      };

      if (!face || !signals) {
        // During the pause a face leaving the view only restarts the pause.
        if (state === 'settling') settleSince.current = null;
        else if (state !== 'looking-for-face') reset();
        return;
      }

      if (state === 'looking-for-face') {
        const next = pickChallenges();
        planRef.current = next;
        stepRef.current = 0;
        tracker.current = createTracker(next[0]);
        setPlan(next);
        setStep(0);
        setState('challenge');
        armTimeout();
        return;
      }

      if (state === 'settling') {
        if (!isStraight(signals)) {
          settleSince.current = null;
          return;
        }
        if (settleSince.current === null) settleSince.current = now;
        if (now - settleSince.current >= SETTLE_MS) {
          clearTimer();
          hasPassed.current = true;
          onPassed();
        }
        return;
      }

      const completed = tracker.current?.(signals, now);
      if (!completed) return;

      const next = stepRef.current + 1;
      if (next < planRef.current.length) {
        stepRef.current = next;
        tracker.current = createTracker(planRef.current[next]);
        setStep(next);
      } else {
        tracker.current = null;
        settleSince.current = null;
        setState('settling');
      }
      armTimeout();
    },
    [state, onPassed, armTimeout, clearTimer, reset]
  );

  return { state, challenge: plan[step] ?? null, step, total: plan.length, onFacesDetected, reset };
}
