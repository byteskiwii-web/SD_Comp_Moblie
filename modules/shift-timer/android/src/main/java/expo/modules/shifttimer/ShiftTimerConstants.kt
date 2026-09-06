package expo.modules.shifttimer

object ShiftTimerConstants {
  const val TAG = "ZipShiftTimer"

  // Must match the string AppRegistry.registerHeadlessTask is called with in
  // src/tasks/registerShiftTimerTask.ts. No shared source of truth between
  // Kotlin and TS -- a mismatch fails silently (RN logs "No task registered
  // for key ..." and the tick just never runs), so keep both sides commented
  // with a pointer to each other.
  const val TASK_KEY = "ZipHrmsShiftTimerTick"
}
