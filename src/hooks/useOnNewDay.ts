import { useEffect, useRef } from 'react';
import { toLocalDateKey } from '../utils/datetime';
import { useTicker } from './useTicker';

/**
 * Runs `onNewDay` when the date changes, and returns the ticking clock.
 *
 * A screen left open past midnight kept yesterday's date and "On shift" while
 * the server had already moved on, so a Punch Out from it was refused. No timer
 * of its own: useTicker lands on five-minute boundaries, which midnight in IST
 * is one of, and ticks at once when the app comes back to the foreground.
 */
export function useOnNewDay(onNewDay: () => void): Date {
  const now = useTicker();
  const day = toLocalDateKey(now);
  const seen = useRef(day);
  useEffect(() => {
    if (seen.current === day) return;
    seen.current = day;
    onNewDay();
  }, [day, onNewDay]);
  return now;
}
