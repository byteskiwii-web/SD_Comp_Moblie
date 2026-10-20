/**
 * The liveness challenges and how each one is recognised. Pure (no React Native
 * imports) so scripts/liveness-check.mjs can run it under plain Node.
 *
 * A different random sequence every attempt is the point: a video recorded in
 * advance can show a blink, but not a blink-then-smile-then-turn-left it was
 * never told to expect.
 */
export type ChallengeKind = 'blink' | 'smile' | 'turn-left' | 'turn-right';

export type FaceSignals = {
  yaw: number;
  pitch?: number;
  roll?: number;
  leftEye?: number;
  rightEye?: number;
  smile?: number;
};

export const MIN_CHALLENGES = 2;
/** Hard cap on how many tasks one attempt can ask for. */
export const MAX_CHALLENGES = 3;

export const BLINKS_NEEDED = 2;
const EYES_CLOSED = 0.3;
const EYES_OPEN = 0.6;
// A turned-away eye reads as closed, so a blink only counts while the face is
// roughly toward the camera. Deliberately loose: it only has to rule out a
// head that is clearly turned, not demand a straight one.
const BLINK_MAX_YAW_DEG = 25;

const SMILE_THRESHOLD = 0.7;
const SMILE_HOLD_MS = 300;

const TURN_THRESHOLD_DEG = 20;
// Back near the camera: a turn only counts after the face has been here first,
// so a head that is already turned from the previous task cannot pass the next.
const FACING_DEG = 12;
// ML Kit reports a positive yaw when the face turns toward the right of the
// image. The front camera can mirror that, so which sign is the user's left is
// settled on a real phone, not here: if "turn left" is being asked and the
// opposite turn passes, flip this one constant.
export const TURN_LEFT_YAW_SIGN = 1;

// "Straight enough for the photo": after the last task the picture is only
// taken while the face is within these limits, so a head still turned from a
// task, or tipped well forward, is never what gets recognised. Moderate on
// purpose -- yaw matters most for matching, and nobody holds a phone dead level.
const STRAIGHT_YAW_DEG = 15;
const STRAIGHT_PITCH_DEG = 20;
const STRAIGHT_ROLL_DEG = 20;
export function isStraight({ yaw, pitch, roll }: FaceSignals): boolean {
  return (
    Math.abs(yaw) <= STRAIGHT_YAW_DEG &&
    Math.abs(pitch ?? 0) <= STRAIGHT_PITCH_DEG &&
    Math.abs(roll ?? 0) <= STRAIGHT_ROLL_DEG
  );
}

const POOL: ChallengeKind[] = ['blink', 'smile', 'turn-left', 'turn-right'];

/**
 * 2 or 3 distinct tasks in random order, never more than MAX_CHALLENGES. Any
 * task can come last, including a head turn: what keeps a turned face out of
 * the picture is isStraight, checked before the photo (a side-on enrolment
 * photo once became the face on file, and every straight-on clock-in after it
 * failed to match).
 */
export function pickChallenges(random: () => number = Math.random): ChallengeKind[] {
  const count = MIN_CHALLENGES + Math.floor(random() * (MAX_CHALLENGES - MIN_CHALLENGES + 1));
  const shuffled = [...POOL];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

/** Fed one frame at a time; returns true on the frame that completes the task. */
export type ChallengeTracker = (signals: FaceSignals, now: number) => boolean;

export function createTracker(kind: ChallengeKind): ChallengeTracker {
  if (kind === 'blink') {
    let shut = false;
    let blinks = 0;
    return ({ yaw, leftEye, rightEye }) => {
      if (Math.abs(yaw) > BLINK_MAX_YAW_DEG) {
        shut = false;
        return false;
      }
      if ((leftEye ?? 1) < EYES_CLOSED && (rightEye ?? 1) < EYES_CLOSED) shut = true;
      const open = (leftEye ?? 0) > EYES_OPEN && (rightEye ?? 0) > EYES_OPEN;
      if (shut && open) {
        shut = false;
        blinks += 1;
      }
      return blinks >= BLINKS_NEEDED;
    };
  }

  if (kind === 'smile') {
    let since: number | null = null;
    return ({ smile }, now) => {
      if ((smile ?? 0) < SMILE_THRESHOLD) {
        since = null;
        return false;
      }
      if (since === null) since = now;
      return now - since >= SMILE_HOLD_MS;
    };
  }

  // Turn left / right.
  const sign = kind === 'turn-left' ? TURN_LEFT_YAW_SIGN : -TURN_LEFT_YAW_SIGN;
  let sawFacing = false;
  return ({ yaw }) => {
    if (Math.abs(yaw) < FACING_DEG) sawFacing = true;
    return sawFacing && yaw * sign > TURN_THRESHOLD_DEG;
  };
}
