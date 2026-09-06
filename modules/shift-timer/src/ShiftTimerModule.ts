import { NativeModule, requireNativeModule } from 'expo';

import { ShiftTimerModuleEvents } from './ShiftTimer.types';

declare class ShiftTimerModule extends NativeModule<ShiftTimerModuleEvents> {
  // Starts the foreground service + alarm-driven timer, ticking roughly
  // every intervalMs regardless of location availability or app state.
  // Idempotent: calling start() while already running just re-arms with the
  // new interval.
  start(intervalMs: number): void;

  // Stops the service and cancels the pending alarm. Idempotent.
  stop(): void;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<ShiftTimerModule>('ShiftTimer');
