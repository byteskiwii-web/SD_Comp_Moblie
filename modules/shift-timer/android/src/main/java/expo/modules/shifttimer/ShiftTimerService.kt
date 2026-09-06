package expo.modules.shifttimer

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import android.util.Log
import com.facebook.react.HeadlessJsTaskService
import expo.modules.shifttimer.ShiftTimerConstants.TAG
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Foreground service that keeps the process alive and network-reachable for
 * the whole shift. It does NOT do the actual waking itself -- see
 * scheduleNextAlarm below for why an in-service timer (coroutine or Handler)
 * is not sufficient on its own and AlarmManager is the real scheduler. This
 * service's job is: show the required persistent notification, own the
 * alarm's lifecycle (schedule on start, cancel on stop, re-arm defensively if
 * the OS seems to have dropped it), and run a free backstop loop that fires a
 * tick if the alarm is ever overdue.
 *
 * startForeground() is called synchronously inside onStartCommand, not from
 * an async bind callback -- expo-location's LocationTaskService does the
 * latter (stashes extras in onStartCommand, calls startForeground() later via
 * a Binder), which is exactly the gap that produces
 * ForegroundServiceDidNotStartInTimeException on Android 14+
 * (https://github.com/expo/expo/issues/47595). We must not repeat that.
 */
class ShiftTimerService : Service() {
  companion object {
    private const val NOTIFICATION_ID = 481901
    private const val CHANNEL_ID = "zip-hrms-shift-timer"
    private const val ALARM_REQUEST_CODE = 481902
    private const val PREFS_NAME = "zip_hrms_shift_timer"
    private const val PREF_INTERVAL_MS = "intervalMs"
    private const val PREF_LAST_TICK_ELAPSED = "lastTickElapsedMs"
    private const val DEFAULT_INTERVAL_MS = 12L * 60_000L

    // Cross-checked against the SharedPreferences copy in fireTick so a
    // dedupe decision is correct even for the very first call in a fresh
    // process (the in-memory value alone would read 0 and wrongly treat that
    // as "never ticked", double-firing right after a process restart).
    @Volatile private var lastTickElapsedMemory: Long = 0L

    /**
     * The one real scheduler. Handler.postDelayed and kotlinx.coroutines.delay
     * are both backed by clocks that stop advancing while the AP is suspended
     * (uptimeMillis / nanoTime) -- a running foreground service keeps the
     * PROCESS alive, it does not keep the CPU awake. ELAPSED_REALTIME_WAKEUP
     * is backed by CLOCK_BOOTTIME (advances during suspend) and the _WAKEUP
     * suffix physically wakes the AP via the kernel RTC -- the only timer
     * category that survives deep sleep.
     *
     * setAndAllowWhileIdle, not setExactAndAllowWhileIdle: the exact variants
     * need SCHEDULE_EXACT_ALARM (user-revocable) or USE_EXACT_ALARM
     * (Play-policy-restricted to alarm/calendar apps). Exactness isn't needed
     * here -- in Doze this is throttled to roughly once per 9 minutes, well
     * under our 12-minute interval, and the server's 20-minute gap threshold
     * absorbs further drift.
     */
    fun scheduleNextAlarm(context: Context, intervalMs: Long) {
      val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val target = SystemClock.elapsedRealtime() + intervalMs
      am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, target, alarmPendingIntent(context))
      Log.i(TAG, "scheduleNextAlarm intervalMs=$intervalMs targetElapsedRealtime=$target")
    }

    fun cancelAlarm(context: Context) {
      val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      am.cancel(alarmPendingIntent(context))
      Log.i(TAG, "cancelAlarm")
    }

    private fun alarmPendingIntent(context: Context): PendingIntent {
      val intent = Intent(context, ShiftTimerAlarmReceiver::class.java)
      return PendingIntent.getBroadcast(
        context, ALARM_REQUEST_CODE, intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    }

    fun persistInterval(context: Context, intervalMs: Long) {
      context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .edit().putLong(PREF_INTERVAL_MS, intervalMs).apply()
    }

    fun readPersistedInterval(context: Context): Long =
      context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .getLong(PREF_INTERVAL_MS, DEFAULT_INTERVAL_MS)

    private fun readLastTickElapsed(context: Context): Long =
      maxOf(
        lastTickElapsedMemory,
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getLong(PREF_LAST_TICK_ELAPSED, 0L)
      )

    /**
     * The single entry point both the alarm receiver and the backstop loop
     * use to dispatch a tick -- centralised here so there is exactly one
     * place deciding "is this a duplicate". A dispatch counts as a duplicate
     * if one already happened within 60% of the interval; that threshold is
     * comfortably wider than any expected alarm jitter but tight enough that
     * a genuinely overdue backstop fire (the loop only checks every 60s and
     * only fires when already overdue) is never mistaken for a duplicate.
     *
     * Records the dispatch instant BEFORE starting the tick service, not
     * after the tick completes -- this is "did we already try", not "did the
     * last attempt succeed", so a slow or failing tick can't cause a second
     * dispatch to pile on top of it.
     */
    fun fireTick(context: Context, source: String) {
      val now = SystemClock.elapsedRealtime()
      val last = readLastTickElapsed(context)
      val intervalMs = readPersistedInterval(context)
      val dedupeWindowMs = (intervalMs * 0.6).toLong()

      if (last > 0 && now - last < dedupeWindowMs) {
        Log.i(TAG, "fireTick source=$source skipped -- deduped, ${now - last}ms since last dispatch")
        return
      }

      lastTickElapsedMemory = now
      context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .edit().putLong(PREF_LAST_TICK_ELAPSED, now).apply()

      Log.i(TAG, "fireTick source=$source msSinceLastTick=${if (last > 0) now - last else -1}")
      // Bridges the gap between this call returning and the tick service's
      // own onStartCommand actually running -- see
      // ShiftTimerAlarmReceiver.kt's doc comment for why this matters when
      // called from a BroadcastReceiver specifically. Harmless (non-ref-
      // counted, just re-acquires) when called from the backstop loop, which
      // has no such gap since the process is already executing this code.
      HeadlessJsTaskService.acquireWakeLockNow(context)
      context.startService(Intent(context, ShiftTimerTickService::class.java))
    }
  }

  private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
  private var backstopJob: Job? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    Log.i(TAG, "ShiftTimerService onCreate")
    startBackstopLoop()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val intervalMs = intent?.getLongExtra("intervalMs", -1L)?.takeIf { it > 0 }
      ?: readPersistedInterval(this)
    persistInterval(this, intervalMs)

    Log.i(TAG, "ShiftTimerService onStartCommand intervalMs=$intervalMs")
    startForegroundCompat()
    scheduleNextAlarm(this, intervalMs)

    return START_REDELIVER_INTENT
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    // stopWithTask=false means this service (and the process) are meant to
    // survive a swipe from recents -- but some OEM skins cancel a process's
    // pending alarms as a side effect of task removal even when the service
    // itself is left running. Re-arming defensively here costs nothing if
    // the alarm was untouched (setAndAllowWhileIdle with the same request
    // code just replaces it) and recovers the schedule if it wasn't.
    Log.i(TAG, "ShiftTimerService onTaskRemoved -- re-arming defensively")
    scheduleNextAlarm(this, readPersistedInterval(this))
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    Log.i(TAG, "ShiftTimerService onDestroy")
    backstopJob?.cancel()
    cancelAlarm(this)
    super.onDestroy()
  }

  /**
   * Free while suspended: delay() on Dispatchers.Default doesn't advance
   * (see the class doc on why that clock stops during deep sleep), so this
   * loop simply doesn't run then and burns nothing. When the device IS awake
   * for any other reason (screen on, another app's wakeup, or the AlarmManager
   * alarm itself waking it), this notices an overdue tick within 60s and
   * fires one via the same fireTick dedupe path the alarm uses -- a backstop
   * for whatever OEM throttling or a dropped alarm might have caused, never
   * the primary path.
   */
  private fun startBackstopLoop() {
    if (backstopJob?.isActive == true) return
    backstopJob = serviceScope.launch {
      while (isActive) {
        delay(60_000)
        fireTick(this@ShiftTimerService, "loop")
      }
    }
  }

  private fun startForegroundCompat() {
    val notification = buildNotification()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun buildNotification(): Notification {
    ensureChannel()

    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
    }
    val mutableFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
    val contentIntent = launchIntent?.let {
      PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_UPDATE_CURRENT or mutableFlag)
    }

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }

    return builder
      .setContentTitle("Clocked in")
      .setContentText("Checking your shift status periodically")
      .setSmallIcon(applicationInfo.icon)
      .setCategory(Notification.CATEGORY_SERVICE)
      .setOngoing(true)
      .also { contentIntent?.let(it::setContentIntent) }
      .build()
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Shift status",
      NotificationManager.IMPORTANCE_LOW
    ).apply {
      description = "Ongoing notification shown while clocked in"
    }
    manager.createNotificationChannel(channel)
  }
}
