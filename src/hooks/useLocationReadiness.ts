import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';

/**
 * Whether a punch can be judged on where the employee is, kept current.
 *
 * This used to be one read when the punch panel mounted. Turning Location on
 * afterwards changed nothing on screen until somebody found the small Retry
 * link, and on Home -- where most punches happen -- the reason was not shown
 * at all: Punch In simply refused to respond. So the answer is now re-read:
 *
 *   - when the app comes back to the foreground, which is exactly the moment
 *     somebody returns from Settings having switched it on;
 *   - every POLL_MS while the panel is mounted, for the quick-settings toggle
 *     that never leaves the app;
 *   - on every punch, through ensureFix / probe, so a phone that turned
 *     Location off since the last read is caught before the camera opens
 *     rather than after the selfie has been taken.
 *
 * The periodic read never prompts. Only a deliberate action -- first mount,
 * a tap on Punch In, the Allow button -- may show a system dialog, since a
 * permission prompt that appears on its own every fifteen seconds is how an
 * app gets its permission denied for good.
 */
export type LocationStatus =
  /** Nothing known yet: the first read is in flight. */
  | 'checking'
  /** Location on, permission granted, and a position in hand. */
  | 'ready'
  /** The phone's Location switch is off -- no app can get a fix. */
  | 'services-off'
  /** Permission not granted, and the system dialog can still be shown. */
  | 'denied'
  /** Permission refused for good -- only Settings can change it now. */
  | 'blocked'
  /** Everything is allowed, but no position could be obtained (indoors, no signal). */
  | 'no-fix';

export type Coords = { latitude: number; longitude: number };

/** Re-read interval for the passive check. Two cheap calls, no prompt, no GPS. */
const POLL_MS = 15_000;

/*
 * Tighter than locationProbe.ts's 5 minutes: that is a background integrity
 * check the employee never sees, this feeds a fix they are about to submit on
 * a live punch.
 */
const CACHED_FIX_MAX_AGE_MS = 2 * 60 * 1000;

/**
 * How long a punch waits for a fresh GPS fix before settling for a recent
 * cached one. Indoors a cold fix can take much longer than this, and a
 * punch that hangs is worse than one that uses a position from a minute ago.
 */
const FRESH_FIX_TIMEOUT_MS = 8_000;

export function useLocationReadiness() {
  const [status, setStatus] = useState<LocationStatus>('checking');
  const [coords, setCoords] = useState<Coords | null>(null);
  /*
   * The same position as `coords`, readable immediately. ensureFix returns
   * the fix acquire() just took, before React has re-rendered with it, so
   * state alone would hand back the previous one (or null).
   */
  const coordsRef = useRef<Coords | null>(null);
  // When that position was taken, so a punch can tell a fix from ten seconds
  // ago from one left over since the screen opened an hour back.
  const fixedAt = useRef(0);
  // One acquisition at a time: the poll, the foreground event and a tap can
  // all land within the same second, and three concurrent GPS requests race
  // each other to set state.
  const acquiring = useRef<Promise<LocationStatus> | null>(null);
  const mounted = useRef(true);

  const set = useCallback((next: LocationStatus) => {
    if (mounted.current) setStatus(next);
    return next;
  }, []);

  const keep = useCallback((c: Coords) => {
    coordsRef.current = c;
    fixedAt.current = Date.now();
    if (mounted.current) setCoords(c);
  }, []);

  /* Location went away: forget the position entirely, including when it was
     taken -- otherwise switching Location back on would report "ready" on
     the strength of a fix that no longer exists. */
  const forget = useCallback(() => {
    coordsRef.current = null;
    fixedAt.current = 0;
    if (mounted.current) setCoords(null);
  }, []);

  /**
   * The full read: switch, permission, then a position.
   *
   * `prompt` decides whether a permission dialog may appear. Device-wide
   * Location is checked FIRST: while it is off iOS shows no per-app prompt at
   * all, and an app that has never asked has no row in Settings either, so
   * asking would look like the phone ignoring us.
   */
  const acquire = useCallback(
    (prompt: boolean): Promise<LocationStatus> => {
      if (acquiring.current) return acquiring.current;
      const run = (async (): Promise<LocationStatus> => {
        if (!(await Location.hasServicesEnabledAsync())) {
          forget();
          return set('services-off');
        }

        const perm = prompt
          ? await Location.requestForegroundPermissionsAsync()
          : await Location.getForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          return set(perm.canAskAgain ? 'denied' : 'blocked');
        }

        // A cached fix resolves in milliseconds and unblocks the screen at
        // once; the live read right behind it replaces it the moment it lands,
        // so what a punch submits is never worse than a live-only read.
        let hasFix = false;
        try {
          const cached = await Location.getLastKnownPositionAsync({ maxAge: CACHED_FIX_MAX_AGE_MS });
          if (cached) {
            keep({ latitude: cached.coords.latitude, longitude: cached.coords.longitude });
            hasFix = true;
            set('ready');
          }
        } catch {
          // No cached fix -- the live read below is still tried.
        }

        try {
          const pos = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('timeout')), FRESH_FIX_TIMEOUT_MS)
            ),
          ]);
          keep({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          return set('ready');
        } catch {
          // A screen already unblocked by the cached fix is not knocked back
          // into an error because the refresh behind it was slow.
          return set(hasFix ? 'ready' : 'no-fix');
        }
      })();
      acquiring.current = run;
      run.finally(() => {
        acquiring.current = null;
      });
      return run;
    },
    [forget, keep, set]
  );

  /**
   * The cheap check: is the switch on and the permission granted. No GPS and
   * no dialog. When the answer has just turned good, a position is fetched
   * so Punch In lights up without anybody having to tap Retry.
   */
  const probe = useCallback(async (): Promise<LocationStatus> => {
    try {
      if (!(await Location.hasServicesEnabledAsync())) {
        forget();
        return set('services-off');
      }
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') return set(perm.canAskAgain ? 'denied' : 'blocked');
      return fixedAt.current ? set('ready') : acquire(false);
    } catch {
      return set('no-fix');
    }
  }, [acquire, forget, set]);

  /**
   * For Punch Out: is Location on and allowed -- nothing more. A clock-out is
   * not judged on position, so it must never wait on a GPS fix (probe() may
   * fetch one when none is held yet, which indoors can take seconds). Only a
   * bad answer is written to state; a good one leaves the displayed status
   * alone rather than claiming a fix it did not take.
   */
  const checkAccess = useCallback(async (): Promise<'ok' | LocationStatus> => {
    try {
      if (!(await Location.hasServicesEnabledAsync())) {
        forget();
        return set('services-off');
      }
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') return set(perm.canAskAgain ? 'denied' : 'blocked');
      return 'ok';
    } catch {
      // Cannot tell -- do not stand between somebody and their clock-out.
      return 'ok';
    }
  }, [forget, set]);

  /**
   * For Punch In: a position fresh enough to be judged on, or the reason there
   * is none. Re-reads the switch and the permission every time, and takes a
   * new fix when the one in hand is older than the cache window.
   */
  const ensureFix = useCallback(async (): Promise<{ status: LocationStatus; coords: Coords | null }> => {
    const fresh = !!coordsRef.current && Date.now() - fixedAt.current < CACHED_FIX_MAX_AGE_MS;
    if (fresh) {
      // Still re-check the switch: the position is recent, but a phone that
      // turned Location off since then should be told, not punched.
      const now = await probe();
      return { status: now, coords: now === 'ready' ? coordsRef.current : null };
    }
    const next = await acquire(true);
    return { status: next, coords: next === 'ready' ? coordsRef.current : null };
  }, [acquire, probe]);

  /**
   * The one-tap fix for the current problem.
   *
   * Android can show its own "turn on location" dialog without leaving the
   * app. iOS cannot switch Location Services on for anybody, and cannot link
   * straight to that page, so it opens this app's Settings page instead --
   * the foreground listener re-reads the moment they come back.
   */
  const fix = useCallback(async (): Promise<LocationStatus> => {
    if (status === 'services-off' && Platform.OS === 'android') {
      try {
        await Location.enableNetworkProviderAsync();
      } catch {
        // Declined in the dialog: the read below reports it as still off.
      }
      return acquire(false);
    }
    if (status === 'denied') return acquire(true);
    if (status === 'blocked' || status === 'services-off') {
      await Linking.openSettings();
      return status;
    }
    return acquire(true);
  }, [acquire, status]);

  // First read: may prompt, since the panel exists to take a punch.
  useEffect(() => {
    mounted.current = true;
    void acquire(true);
    return () => {
      mounted.current = false;
    };
  }, [acquire]);

  // Back from Settings, or the quick-settings toggle: re-read without asking.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void probe();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void probe();
    }, POLL_MS);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [probe]);

  return { status, coords, ensureFix, checkAccess, probe, fix };
}
