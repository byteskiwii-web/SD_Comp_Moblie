package expo.modules.shifttimer

import android.content.Context
import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ShiftTimerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ShiftTimer")

    Function("start") { intervalMs: Double ->
      appContext.reactContext?.let { context ->
        val intent = Intent(context, ShiftTimerService::class.java).apply {
          putExtra("intervalMs", intervalMs.toLong())
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(intent)
        } else {
          context.startService(intent)
        }
      }
      Unit
    }

    Function("stop") {
      appContext.reactContext?.let { context ->
        context.stopService(Intent(context, ShiftTimerService::class.java))
      }
      Unit
    }
  }
}
