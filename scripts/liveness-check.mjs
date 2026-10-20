// Run: node scripts/liveness-check.mjs
import assert from 'node:assert/strict';
import {
  MAX_CHALLENGES, MIN_CHALLENGES, TURN_LEFT_YAW_SIGN, createTracker, isStraight, pickChallenges,
} from '../src/hooks/livenessChallenges.ts';

// Deterministic randomness so a failure is reproducible.
let seed = 12345;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

const kinds = new Set();
const lengths = new Set();
const sequences = new Set();
const lastKinds = new Set();
for (let i = 0; i < 3000; i++) {
  const seq = pickChallenges(rand);
  assert.ok(seq.length >= MIN_CHALLENGES && seq.length <= MAX_CHALLENGES, 'never more than the cap');
  assert.equal(new Set(seq).size, seq.length, 'no repeats');
  lastKinds.add(seq.at(-1));
  seq.forEach((k) => kinds.add(k));
  lengths.add(seq.length);
  sequences.add(seq.join('>'));
}
assert.deepEqual([...lengths].sort(), [2, 3], 'both 2 and 3 tasks occur');
assert.equal(kinds.size, 4, 'every task type gets used');
// 12 two-task + 24 three-task ordered sequences of distinct tasks.
assert.equal(sequences.size, 36, `every possible sequence is reachable (${sequences.size})`);
assert.equal(lastKinds.size, 4, 'any task can come last, a turn included');

// Straight enough for the photo: moderate limits, decided on all three angles.
assert.ok(isStraight({ yaw: 0, pitch: 0, roll: 0 }) && isStraight({ yaw: -12, pitch: 15, roll: -15 }), 'a roughly straight face passes');
assert.ok(isStraight({ yaw: 5 }), 'angles the detector did not report do not block');
assert.ok(!isStraight({ yaw: 30, pitch: 0, roll: 0 }) && !isStraight({ yaw: -30 }), 'still turned from a task: no photo');
assert.ok(!isStraight({ yaw: 0, pitch: 35, roll: 0 }) && !isStraight({ yaw: 0, pitch: 0, roll: 35 }), 'tipped too far: no photo');

const open = { yaw: 0, leftEye: 0.9, rightEye: 0.9 };
const shut = { yaw: 0, leftEye: 0.05, rightEye: 0.05 };

// Blink: two full close/open cycles, and not while the head is turned away.
let blink = createTracker('blink');
assert.ok(!blink(open, 0) && !blink(shut, 1) && !blink(open, 2), 'one blink is not enough');
assert.ok(blink(shut, 3) === false && blink(open, 4) === true, 'the second blink completes it');
blink = createTracker('blink');
const turnedShut = { yaw: 40, leftEye: 0.05, rightEye: 0.05 };
for (let i = 0; i < 6; i++) assert.ok(!blink(turnedShut, i) && !blink({ ...open, yaw: 40 }, i), 'turned-away blinks do not count');

// Smile: has to be held, a flicker does not count.
let smile = createTracker('smile');
assert.ok(!smile({ yaw: 0, smile: 0.9 }, 0) && !smile({ yaw: 0, smile: 0.1 }, 100) && !smile({ yaw: 0, smile: 0.9 }, 200), 'a flicker does not count');
smile = createTracker('smile');
assert.ok(!smile({ yaw: 0, smile: 0.9 }, 1000) && smile({ yaw: 0, smile: 0.9 }, 1350), 'a held smile counts');

// Turns: need the right direction, and a head already turned must not pass instantly.
const left = TURN_LEFT_YAW_SIGN * 30;
let t = createTracker('turn-left');
assert.ok(!t({ yaw: 0 }, 0) && t({ yaw: left }, 1), 'turning the requested way passes');
t = createTracker('turn-left');
assert.ok(!t({ yaw: -left }, 0) && !t({ yaw: 0 }, 1), 'the opposite way does not');
t = createTracker('turn-left');
assert.ok(!t({ yaw: left }, 0), 'already turned at the start does not pass until the face has been facing first');
t = createTracker('turn-right');
assert.ok(!t({ yaw: 0 }, 0) && !t({ yaw: left }, 1) && t({ yaw: -left }, 2), 'right is the mirror of left');

console.log('liveness rules ok');
