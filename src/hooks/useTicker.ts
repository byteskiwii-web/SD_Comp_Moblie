import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * A clock that re-renders on a fixed interval.
 *
 * Used for figures that are only true "as of now" — the effective hours of a
 * shift still running. Without it those numbers are correct when the screen
 * mounts and quietly wrong for the rest of the session.
 *
 * FIVE MINUTES, not one second. Hours are shown to the minute and nobody
 * watches them tick; a per-second timer would wake the JS thread 300 times to
 * change the display roughly twice, on a device that is already polling
 * location during a shift.
 *
 * It also aligns to the wall clock rather than to mount time: two screens
 * mounted a minute apart would otherwise update a minute apart and briefly
 * disagree about the same shift.
 *
 * The interval is cleared while the app is backgrounded. A timer firing behind
 * a locked screen costs battery to recompute a number nobody can see, and
 * returning to the app ticks immediately anyway.
 */
export function useTicker(intervalMs = 5 * 60 * 1000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      // Time to the next boundary, so every mounted screen lands together.
      const delay = intervalMs - (Date.now() % intervalMs);
      timer = setTimeout(() => {
        setNow(new Date());
        schedule();
      }, delay);
    };

    const stop = () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
    };

    const sub = AppState.addEventListener('change', (state) => {
      stop();
      if (state === 'active') {
        // Catch up on whatever elapsed while backgrounded before resuming.
        setNow(new Date());
        schedule();
      }
    });

    if (AppState.currentState === 'active') schedule();

    return () => {
      stop();
      sub.remove();
    };
  }, [intervalMs]);

  return now;
}
