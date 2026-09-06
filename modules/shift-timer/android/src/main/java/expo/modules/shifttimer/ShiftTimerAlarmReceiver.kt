package expo.modules.shifttimer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import expo.modules.shifttimer.ShiftTimerConstants.TAG

/**
 * Fired by AlarmManager roughly every intervalMs, including while the device
 * is dozing (see ShiftTimerService.scheduleNextAlarm for why this, and not an
 * in-service coroutine timer, is the primary scheduler).
 *
 * Re-arms the NEXT alarm before dispatching this tick, so a crash inside one
 * tick can never break the chain for subsequent ticks. Dispatch itself (the
 * wakelock handoff and dedupe check) is centralised in
 * ShiftTimerService.fireTick, shared with the backstop loop's own dispatch
 * path.
 */
class ShiftTimerAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    Log.i(TAG, "ShiftTimerAlarmReceiver onReceive")
    val intervalMs = ShiftTimerService.readPersistedInterval(context)
    ShiftTimerService.scheduleNextAlarm(context, intervalMs)
    ShiftTimerService.fireTick(context, "alarm")
  }
}
