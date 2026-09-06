package expo.modules.shifttimer

import android.content.Intent
import android.util.Log
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import expo.modules.shifttimer.ShiftTimerConstants.TAG
import expo.modules.shifttimer.ShiftTimerConstants.TASK_KEY

/**
 * Short-lived (seconds) headless task runner -- NOT the long-lived foreground
 * service. Deliberately a separate class from ShiftTimerService: extending
 * HeadlessJsTaskService directly on the long-lived service would mean its
 * partial wakelock (released only in onDestroy, per the base class) gets held
 * for the entire shift once onHeadlessJsTaskFinish's stopSelf() is suppressed
 * -- exactly the battery cost the whole native-timer approach exists to
 * avoid. Here, the task finishing calls the base class's stopSelf(), this
 * service is destroyed, and the wakelock acquired in
 * ShiftTimerAlarmReceiver.onReceive is released -- normally within seconds.
 *
 * isAllowedInForeground=true because this can fire while the app is open
 * (the alarm doesn't know or care); timeout=60_000 is the safety net -- if
 * the JS task body ever rejects instead of resolving (it must not, per
 * shiftTimerTask.ts's total try/catch), RN's own timeout still forces
 * onHeadlessJsTaskFinish so this service always stops and the wakelock is
 * never held indefinitely.
 */
class ShiftTimerTickService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig {
    Log.i(TAG, "ShiftTimerTickService getTaskConfig")
    return HeadlessJsTaskConfig(
      TASK_KEY,
      Arguments.createMap(),
      60_000L,
      true
    )
  }
}
