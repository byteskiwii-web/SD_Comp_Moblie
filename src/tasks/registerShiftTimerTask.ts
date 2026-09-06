import { AppRegistry } from 'react-native';
import { SHIFT_TIMER_TASK } from '../constants/config';
import { runShiftTimerTick } from './shiftTimerTask';

// Must run at module scope, imported from index.ts (not App.tsx). The
// cold-start headless path evaluates the entry bundle and immediately starts
// the task -- there is no Activity and App is never rendered, so a
// registration reachable only via App.tsx's import graph would never run in
// that context. Same reasoning as the old backgroundLocationTask.ts's
// TaskManager.defineTask, one level up (that one lived in App.tsx's imports
// because expo-location's task discovery works differently -- this one is
// RN's own AppRegistry and specifically needs to be evaluated before any
// task can be started).
//
// SHIFT_TIMER_TASK must equal ShiftTimerConstants.TASK_KEY in
// modules/shift-timer/android/.../ShiftTimerConstants.kt exactly.
AppRegistry.registerHeadlessTask(SHIFT_TIMER_TASK, () => runShiftTimerTick);
