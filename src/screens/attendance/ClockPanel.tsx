import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card } from '../../components/ui';
import { TourTarget } from '../../components/tour/TourTarget';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { usePreferencesStore } from '../../stores/preferencesStore';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuthStore } from '../../stores/authStore';
import { summariseDay } from '../../utils/attendanceDay';
import { Skeleton } from '../../components/Skeleton';
import { useShiftStore } from '../../stores/shiftStore';
import { haversineDistance } from '../../utils/haversine';
import { clockIn, clockOut, endBreak, getAttendanceHistory, startBreak } from '../../api/attendance.api';
import { CameraCaptureScreen } from './CameraCaptureScreen';
import { runtimeLabel, supportsBackgroundLocation } from '../../native/runtime';
import { getApiErrorMessage } from '../../api/client';
import { getLatestMarkOfTypes, SHIFT_TYPES, BREAK_TYPES } from '../../utils/attendanceStatus';
import { formatTime, formatTimeWithSeconds, toLocalDateKey } from '../../utils/datetime';
import { t as tr, useT } from '../../i18n';
import { StatusBanner } from '../../components/StatusBanner';
import { GeofenceMap, bearingBetween } from '../../components/GeofenceMap';
import { PunchTiles } from './PunchTiles';
import { InfoNote } from '../../components/InfoNote';
import { useConnectivityStore } from '../../stores/connectivityStore';

const today = () => toLocalDateKey();

// Tighter than locationProbe.ts's 5 minutes: that is a background integrity
// check the employee never sees, this feeds a fix they are about to submit
// on a live punch, watching the screen while it happens.
const CACHED_FIX_MAX_AGE_MS = 2 * 60 * 1000;

type Props = {
  // Set by Home's "Start/End shift with live photo" CTA, which already knows
  // the direction from its own attendance query. Consumed at most once --
  // see onAutoPunchStarted.
  autoPunch?: 'clock-in' | 'clock-out';
  // Fired the moment autoPunch is acted on, so the caller can drop it from
  // state it owns. Without this, re-passing the same prop value across an
  // unrelated re-render is indistinguishable from a fresh request to
  // auto-punch again.
  onAutoPunchStarted?: () => void;
};

/** Metres are unreadable past a few hundred; 438636m is 439 km. */
function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  const km = metres / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export function ClockPanel({ autoPunch, onAutoPunchStarted }: Props = {}) {
  const colors = useThemeStore((s) => s.colors);
  // Subscribed purely so a change to the 12/24-hour setting re-renders the
  // times on this screen; the formatters read the store outside React.
  usePreferencesStore((s) => s.clock);
  const t = useT();
  // Whether the server can be reached. Read from what the API client has
  // actually observed, not from a radio flag -- a phone with full bars behind
  // a captive portal cannot record a punch.
  const reachability = useConnectivityStore((s) => s.status);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const employee = useAuthStore((s) => s.employee);
  const store = useAuthStore((s) => s.store);
  const profile = useAuthStore((s) => s.profile);
  const setClockedIn = useShiftStore((s) => s.setClockedIn);
  const setOnBreak = useShiftStore((s) => s.setOnBreak);
  const setOffBreak = useShiftStore((s) => s.setOffBreak);
  const setClockedOut = useShiftStore((s) => s.setClockedOut);
  const queryClient = useQueryClient();

  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState('');
  // 'blocked' means iOS will not show the dialog again -- the only route back
  // is Settings. Distinguishing it matters because the recovery differs.
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'askable' | 'blocked' | 'services-off'>('unknown');
  const [pendingAction, setPendingAction] = useState<'clock-in' | 'clock-out' | null>(null);
  const [banner, setBanner] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null);

  const historyQuery = useQuery({
    queryKey: ['attendance-today', employee?.id],
    queryFn: () => getAttendanceHistory(employee!.id, today(), today()),
    enabled: !!employee,
  });

  // Marks come back most-recent-first. Employees can clock in/out multiple
  // times per day (e.g. lunch breaks), so only the LATEST mark today
  // determines current status -- not "does a clock-in exist today". Shift
  // and break are independent timelines sharing this table, so each status
  // is derived from its OWN type-filtered latest mark, not the overall
  // most-recent mark (which could be a break event either way).
  const marks = historyQuery.data ?? [];

  /**
   * Break used against the allowance, and what that costs.
   *
   * The rule is the server's (shared/shiftPolicy.js) and this mirrors its
   * arithmetic rather than inventing a second one: overrun is owed back minute
   * for minute, never rounded up to a block.
   *
   * profile.shift is null for an employee on no template, and so is the
   * allowance. That means NO POLICY, not zero minutes -- the whole card stays
   * hidden rather than telling somebody unrostered that they owe back their
   * lunch.
   */
  const breakUsage = useMemo(() => {
    const allowance = profile?.shift?.breakAllowanceMinutes ?? null;
    if (allowance === null || allowance === undefined) return null;

    // Closed breaks only. The one running now is not spent yet.
    const today = summariseDay(toLocalDateKey(), marks);
    const used = today.breakMinutes ?? 0;
    const overrun = Math.max(0, used - allowance);

    let endsAt: string | null = profile?.shiftEnd ? String(profile.shiftEnd).slice(0, 5) : null;
    if (endsAt && overrun > 0) {
      const [h, m] = endsAt.split(':').map(Number);
      const total = (h * 60 + m + overrun) % 1440;
      endsAt = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    }
    return { allowance, used, overrun, endsAt, remaining: Math.max(0, allowance - used) };
  }, [marks, profile?.shift?.breakAllowanceMinutes, profile?.shiftEnd]);
  const latestShiftMark = getLatestMarkOfTypes(marks, SHIFT_TYPES);
  const latestBreakMark = getLatestMarkOfTypes(marks, BREAK_TYPES);
  const isCurrentlyClockedIn = latestShiftMark?.mark_type === 'clock-in';
  const isCurrentlyOnBreak = latestBreakMark?.mark_type === 'break-start';
  const lastClockIn = marks.find((m) => m.mark_type === 'clock-in');
  const lastClockOut = marks.find((m) => m.mark_type === 'clock-out');
  const lastBreakStart = marks.find((m) => m.mark_type === 'break-start');
  const lastBreakEnd = marks.find((m) => m.mark_type === 'break-end');

  /**
   * Ask for location, then fix a position.
   *
   * Callable so the screen can retry after the user changes the setting,
   * instead of making them relaunch the app. iOS shows its dialog ONCE per
   * app ever; after that requestForegroundPermissionsAsync returns the
   * recorded answer with no prompt, which is why a phone that has already
   * answered appears to "not ask".
   */
  const acquireLocation = useCallback(async () => {
    setLocationError('');

    // Device-wide Location Services, checked BEFORE asking for permission.
    // While it is off iOS shows no per-app prompt at all, and an app that has
    // never asked has no row in Settings either -- so the phone looks like it
    // simply ignored us, and the usual "allow it in Settings" advice sends
    // people hunting for an entry that is not there yet.
    if (!(await Location.hasServicesEnabledAsync())) {
      setPermission('services-off');
      setLocationError(tr('clock.servicesOff'));
      return;
    }

    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      setPermission(perm.canAskAgain ? 'askable' : 'blocked');
      setLocationError(
        perm.canAskAgain
          ? tr('clock.locationDenied')
          : // Open Settings lands on this app's own page, so the path starts
            // there. Naming the option matters: iOS offers four on that screen
            // and only this one works. In Expo Go the page is Expo Go's -- there
            // is no zip-hrms row to find -- but the steps read the same either way.
            tr('clock.blockedSteps')
      );
      return;
    }
    setPermission('granted');

    // A cached fix (Play Services' fused location, or the device's last GPS
    // lock) resolves in milliseconds; a cold getCurrentPositionAsync call can
    // take several seconds to acquire a signal, which is the delay this is
    // for. Showing the cached one first unblocks the geofence read and
    // enables Start/End Shift immediately -- it is not a lesser answer, since
    // getCurrentPositionAsync below still runs right behind it and overwrites
    // coords the moment a fresh fix lands, so what actually gets submitted on
    // Start/End Shift is never worse than a live-only fetch would have given,
    // only arrived-at sooner. locationProbe.ts's background check uses the
    // same two-step shape for the same reason.
    let hasFix = false;
    try {
      const cached = await Location.getLastKnownPositionAsync({ maxAge: CACHED_FIX_MAX_AGE_MS });
      if (cached) {
        setCoords({ latitude: cached.coords.latitude, longitude: cached.coords.longitude });
        hasFix = true;
      }
    } catch {
      // No cached fix to fall back on -- the live fetch below is still tried.
    }

    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    } catch {
      // Only an error if the cached fix above never landed either -- a
      // screen that is already unblocked should not be knocked back into an
      // error state because the background refresh happened to fail.
      if (!hasFix) setLocationError(tr('clock.locationFailed'));
    }
  }, []);

  useEffect(() => {
    void acquireLocation();
  }, [acquireLocation]);

  const distanceMetres =
    coords && store?.lat && store?.lng
      ? haversineDistance(coords.latitude, coords.longitude, parseFloat(store.lat), parseFloat(store.lng))
      : null;
  const insideFence = distanceMetres != null && store ? distanceMetres <= store.geofence_radius_m : null;
  // The drawing needs a definite inside/outside. Before a fix arrives there
  // is no answer, and `false` would draw the dot as OUT of the fence -- an
  // amber ring and a warning tint for a state that is merely unknown.
  const insideForMap = insideFence === true;

  // Home's one-tap shortcut: open the camera the moment it is safe to, rather
  // than landing here and making the employee press Start/End Shift a second
  // time for a decision they already made by tapping the CTA.
  //
  // "Safe to" is exactly the condition the button below disables itself on --
  // this mirrors that check rather than skipping it, so autoPunch can never
  // fire a punch the manual button would have refused (already clocked in,
  // no fix yet, mid-break on an end-shift). It waits for today's history to
  // load rather than trusting Home's snapshot of it, because the two screens
  // read that state independently and a moment can pass between them.
  //
  // The ref makes this a true one-shot within this mount: without it, every
  // re-render while still waiting on a condition (e.g. no coords yet) would
  // re-enter the effect, and the moment the condition clears it could double
  // fire before React commits the state update that is meant to prevent that.
  const autoPunchFired = useRef(false);
  useEffect(() => {
    if (!autoPunch || autoPunchFired.current || pendingAction) return;
    if (!coords || historyQuery.isLoading) return;
    const wouldBeDisabled =
      autoPunch === 'clock-in' ? isCurrentlyClockedIn : !isCurrentlyClockedIn || isCurrentlyOnBreak;
    if (wouldBeDisabled) return;
    autoPunchFired.current = true;
    onAutoPunchStarted?.();
    setPendingAction(autoPunch);
  }, [autoPunch, coords, historyQuery.isLoading, isCurrentlyClockedIn, isCurrentlyOnBreak, onAutoPunchStarted, pendingAction]);

  const punchMutation = useMutation({
    mutationFn: async (filePath: string) => {
      if (!employee || !store || !coords) throw new Error('Missing required data');
      const input = {
        employee_id: employee.id,
        store_code: store.store_code,
        latitude: coords.latitude,
        longitude: coords.longitude,
        device_id: 'mobile-app',
        selfieFilePath: filePath,
      };
      return pendingAction === 'clock-in' ? clockIn(input) : clockOut(input);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['attendance-today', employee?.id] });
      if (pendingAction === 'clock-in') {
        setClockedIn(result.attendance.store_code, result.attendance.timestamp);
      } else {
        setClockedOut();
      }
      const isPending = result.attendance.approval_status === 'pending-approval';
      // No background location in this runtime means no mid-shift geofence
      // polling for this shift. Said on the receipt rather than left for
      // someone to infer later from an attendance report with holes in it.
      const unverified = supportsBackgroundLocation
        ? ''
        : ' ' + tr('clock.noMidShift', { runtime: runtimeLabel });
      setBanner({
        tone: isPending || !supportsBackgroundLocation ? 'warning' : 'success',
        text:
          (isPending
            ? tr('clock.outsidePending')
            : pendingAction === 'clock-in'
              ? tr('clock.shiftStarted')
              : tr('clock.shiftEnded')) + unverified,
      });
      setPendingAction(null);
    },
    onError: (err) => {
      setBanner({ tone: 'warning', text: getApiErrorMessage(err) });
      setPendingAction(null);
    },
  });

  // Breaks are geofence-only -- no selfie, so no camera step and no
  // background-permission gate (that gate exists to support the mid-shift
  // location poll, which is already running once the employee is clocked in).
  const breakMutation = useMutation({
    mutationFn: async (action: 'break-start' | 'break-end') => {
      if (!employee || !store || !coords) throw new Error('Missing required data');
      const input = {
        employee_id: employee.id,
        store_code: store.store_code,
        latitude: coords.latitude,
        longitude: coords.longitude,
        device_id: 'mobile-app',
      };
      return action === 'break-start' ? startBreak(input) : endBreak(input);
    },
    onSuccess: (result, action) => {
      queryClient.invalidateQueries({ queryKey: ['attendance-today', employee?.id] });
      // Stops/resumes background location polling immediately -- tracking
      // should only run while the employee is expected to be inside the
      // store, not while on a break.
      if (action === 'break-start') {
        setOnBreak();
      } else {
        setOffBreak();
      }
      const isPending = result.attendance.approval_status === 'pending-approval';
      setBanner({
        tone: isPending ? 'warning' : 'success',
        text: isPending
          ? tr('clock.outsidePending')
          : action === 'break-start'
            ? tr('clock.breakStarted')
            : tr('clock.breakEnded'),
      });
    },
    onError: (err) => {
      setBanner({ tone: 'warning', text: getApiErrorMessage(err) });
    },
  });

  // "Allow all the time" location access is mandatory before a punch is
  // accepted -- without it, the periodic mid-shift geofence check
  // (useLocationPollingEffect) can't run once the employee is clocked in.
  // Checked here (after the selfie is already captured) rather than
  // earlier, since Android only lets an app prompt for background access
  // after foreground access is already granted.
  const handleCaptured = async (filePath: string) => {
    // requestBackgroundPermissionsAsync does not resolve to 'denied' when the
    // runtime has no background location at all -- it *throws*
    // (ERR_LOCATION_INFO_PLIST in Expo Go, whose Info.plist carries no
    // NSLocationAlwaysAndWhenInUseUsageDescription). Unhandled, that rejection
    // skipped the mutation and left this modal open with no feedback at all.
    // A runtime that cannot grant the permission has not granted it, so treat
    // the throw as a denial and fall into the same gate.
    let granted = false;
    try {
      const bg = await Location.requestBackgroundPermissionsAsync();
      granted = bg.status === 'granted';
    } catch (err) {
      console.warn('[ClockPanel] background location is unavailable in this runtime', err);
    }

    // The gate binds only where the permission can actually be granted. In a
    // runtime that has no background location at all there is no setting to go
    // and change, so refusing the punch protects nothing -- it just makes
    // punching permanently impossible rather than merely unverified. Native
    // builds are untouched: there the permission is real, a denial is a
    // denial, and the employee is sent to Settings to fix it.
    if (!granted && supportsBackgroundLocation) {
      setPendingAction(null);
      Alert.alert(tr('clock.bgTitle'), tr('clock.bgBodyFull'), [
        { text: tr('common.cancel'), style: 'cancel' },
        { text: tr('common.openSettings'), onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    punchMutation.mutate(filePath);
  };

  if (!employee || !store) return null;

  return (
    <View style={styles.wrap}>
      {banner && (
        <View style={[styles.banner, banner.tone === 'success' ? styles.bannerSuccess : styles.bannerWarning]}>
          <Text style={styles.bannerText}>{banner.text}</Text>
        </View>
      )}

      {/* CAN THIS PUNCH LAND? Two lines, before anything else.
          The connection and the fence are the two things that decide whether a
          mark is recorded cleanly, and both are worth knowing before the
          camera opens rather than after it closes. */}
      <StatusBanner
        tone={reachability === 'offline' ? 'bad' : reachability === 'online' ? 'ok' : 'muted'}
        icon={
          reachability === 'offline'
            ? 'cloud-offline-outline'
            : reachability === 'online'
              ? 'checkmark-circle'
              : 'ellipsis-horizontal-circle-outline'
        }
        title={
          reachability === 'offline'
            ? t('net.offline')
            : reachability === 'online'
              ? t('net.online')
              : t('net.checking')
        }
        detail={reachability === 'offline' ? t('net.offlineDetail') : null}
      />

      {/* Kept, but folded into the shift line below the tiles rather than
          leading the screen -- which shift you are on is context, not the
          question you opened the page to answer. */}
      <View style={[styles.hero, isCurrentlyClockedIn && styles.heroOn, styles.heroCompact]}>
        <View style={styles.heroTop}>
          <View style={[styles.heroDot, isCurrentlyClockedIn ? styles.heroDotOn : styles.heroDotOff]} />
          <Text style={[styles.heroState, isCurrentlyClockedIn && styles.heroStateOn]}>
            {isCurrentlyOnBreak
              ? t('shift.onBreak')
              : isCurrentlyClockedIn
                ? t('shift.onShift')
                : t('shift.notClockedIn')}
          </Text>
        </View>
        <Text style={styles.heroShift}>
          {profile?.shift?.name ??
            (profile?.shiftStart && profile?.shiftEnd
              ? `${String(profile.shiftStart).slice(0, 5)} – ${String(profile.shiftEnd).slice(0, 5)}`
              : t('shift.noRoster'))}
        </Text>
        {lastClockIn && isCurrentlyClockedIn ? (
          <Text style={styles.heroSince}>
            {t('clock.since', { time: formatTime(lastClockIn.timestamp) })}
          </Text>
        ) : null}
      </View>

      <TourTarget id="clock-location">
      <View style={styles.geoBlock}>
        {locationError ? (
          <>
            <StatusBanner
              tone="bad"
              icon="warning-outline"
              title={t('clock.locationUnavailable')}
              detail={locationError}
            />
            <View style={styles.geoFix}>
              <Pressable onPress={() => void acquireLocation()} hitSlop={8}>
                <Text style={styles.geoFixText}>{t('common.retry')}</Text>
              </Pressable>
              {permission === 'blocked' && (
                <Pressable onPress={() => Linking.openSettings()} hitSlop={8}>
                  <Text style={styles.geoFixText}>{t('common.settings')}</Text>
                </Pressable>
              )}
            </View>
          </>
        ) : (
          <>
            <StatusBanner
              tone={distanceMetres == null ? 'muted' : insideFence ? 'ok' : 'warn'}
              icon={
                distanceMetres == null
                  ? 'ellipsis-horizontal-circle-outline'
                  : insideFence
                    ? 'checkmark-circle'
                    : 'location-outline'
              }
              title={
                distanceMetres == null
                  ? t('map.locating')
                  : insideFence
                    ? t('clock.insideFence')
                    : t('clock.outsideFence')
              }
              // Formatted, because "438636m from" is a number nobody can read
              // at a glance and the distance is the whole point of the line.
              detail={
                distanceMetres == null
                  ? null
                  : t(insideFence ? 'clock.insideDetail' : 'clock.outsideDetail', {
                      distance: formatDistance(distanceMetres),
                      site: store?.name ?? t('clock.yourSite'),
                    })
              }
            />

            {/* The fence, drawn. See GeofenceMap for why this is not a map. */}
            <GeofenceMap
              distanceMetres={distanceMetres}
              radiusMetres={store?.geofence_radius_m ?? 0}
              bearingDegrees={
                coords && store?.lat && store?.lng
                  ? bearingBetween(Number(store.lat), Number(store.lng), coords.latitude, coords.longitude)
                  : null
              }
              inside={insideForMap}
              siteName={store?.name ?? t('clock.yourSite')}
            />
          </>
        )}
      </View>
      </TourTarget>

      {/* What the break allowance is, and what it has cost so far. Shown
          whenever a policy exists -- an employee who has not taken a break
          yet still benefits from knowing the ceiling before they start one,
          which is the whole reason this moved here from Profile: it is an
          attendance fact, read where a break is actually taken, not a
          three-part breakdown (lunch/tea/tea) that reads as furniture on a
          profile page nobody opens mid-shift. */}
      {breakUsage && (
        <View style={[styles.breakCard, breakUsage.overrun > 0 && styles.breakCardOver]}>
          <View style={styles.breakCardRow}>
            <Text style={styles.breakCardLabel}>
              {breakUsage.used > 0 ? t('clock.breakUsed') : t('clock.breakMax')}
            </Text>
            <Text style={styles.breakCardValue}>
              {breakUsage.used > 0
                ? t('clock.breakUsedOf', { used: breakUsage.used, allowance: breakUsage.allowance })
                : t('clock.breakMaxMinutes', { allowance: breakUsage.allowance })}
            </Text>
          </View>
          {breakUsage.used > 0 &&
            (breakUsage.overrun > 0 ? (
              <Text style={styles.breakCardOverText}>
                {t('clock.breakOver', { overrun: breakUsage.overrun, endsAt: breakUsage.endsAt ?? '—' })}
              </Text>
            ) : (
              <Text style={styles.breakCardLeft}>
                {t('clock.breakLeft', { remaining: breakUsage.remaining })}
              </Text>
            ))}
        </View>
      )}

      {/* BOTH ENDS OF THE SHIFT, side by side. The finished one keeps its
          answer on screen instead of disappearing -- see PunchTiles. */}
      <TourTarget id="clock-action">
      <PunchTiles
        clockedIn={isCurrentlyClockedIn}
        clockInAt={lastClockIn ? formatTime(lastClockIn.timestamp) : null}
        clockOutAt={lastClockOut ? formatTime(lastClockOut.timestamp) : null}
        onClockIn={() => setPendingAction('clock-in')}
        onClockOut={() => setPendingAction('clock-out')}
        // A break must be ended before the shift can be, and a punch with no
        // fix would be submitted without the location it is judged on.
        disabled={!coords || (isCurrentlyClockedIn && isCurrentlyOnBreak)}
        labels={{
          clockIn: t('day.clockIn'),
          clockOut: t('day.clockOut'),
          doneAt: (time) => t('clock.doneAt', { time }),
          startHint: t('clock.startHint'),
          endHint: t('clock.endHint'),
        }}
      />
      </TourTarget>

      {isCurrentlyClockedIn && (
        <View style={styles.actionsRow}>
          <Button
            title={isCurrentlyOnBreak ? t('clock.endBreak') : t('clock.startBreak')}
            variant="outline"
            onPress={() => breakMutation.mutate(isCurrentlyOnBreak ? 'break-end' : 'break-start')}
            disabled={!coords || breakMutation.isPending}
          />
        </View>
      )}

      {isCurrentlyOnBreak && (
        <Text style={styles.geoWarning}>{t('clock.endBreakFirst')}</Text>
      )}

      {/* WHAT THE RULES ARE, said once, at the bottom.
          The design's version says "two marks a day — nothing else is required
          during your shift", which is not true of this product: breaks are
          punched too, and the shift policy counts them. The lead sentence
          therefore follows whether this employee actually has a break
          allowance, rather than repeating a line that would be wrong for
          anyone on a template. */}
      <InfoNote
        lead={breakUsage ? t('clock.noteLeadBreaks') : t('clock.noteLead')}
        body={t('clock.note', { tab: t('attendance.regularise') })}
      />

      {(lastClockIn || lastClockOut || lastBreakStart || lastBreakEnd) && (
        <Card>
          {lastClockIn && (
            <Text style={styles.lastPunchText}>
              {t('clock.lastShiftStart', { time: formatTimeWithSeconds(lastClockIn.timestamp) })}
            </Text>
          )}
          {lastClockOut && (
            <Text style={styles.lastPunchText}>
              {t('clock.lastShiftEnd', { time: formatTimeWithSeconds(lastClockOut.timestamp) })}
            </Text>
          )}
          {lastBreakStart && (
            <Text style={styles.lastPunchText}>
              {t('clock.lastBreakStart', { time: formatTimeWithSeconds(lastBreakStart.timestamp) })}
            </Text>
          )}
          {lastBreakEnd && (
            <Text style={styles.lastPunchText}>
              {t('clock.lastBreakEnd', { time: formatTimeWithSeconds(lastBreakEnd.timestamp) })}
            </Text>
          )}
        </Card>
      )}

      <Modal visible={!!pendingAction} animationType="slide" onRequestClose={() => setPendingAction(null)}>
        <CameraCaptureScreen
          onCancel={() => setPendingAction(null)}
          onCaptured={handleCaptured}
        />
      </Modal>
    </View>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
  wrap: { gap: 12 },
  banner: { borderRadius: radii.md, padding: 12 },
  bannerSuccess: { backgroundColor: colors.successBg },
  bannerWarning: { backgroundColor: colors.warningBg },
  bannerText: { fontSize: 11, fontWeight: '600', color: colors.slate800 },
  geoCard: { alignItems: 'center' },
  geoActions: { alignSelf: 'stretch', gap: 8, marginTop: 12 },
  geoLoading: { fontSize: 11.5, color: colors.slate500 },
  geoError: { fontSize: 11.5, color: colors.dangerText, textAlign: 'center' },
  geoStatus: { fontSize: 12.5, fontWeight: '800' },
  geoInside: { color: colors.successText },
  geoOutside: { color: colors.dangerText },
  geoDetail: { fontSize: 11, color: colors.slate500, marginTop: 4 },
  geoWarning: { fontSize: 11, color: colors.warningText, marginTop: 8, textAlign: 'center', fontWeight: '600' },
  actionsRow: { width: '100%' },
  breakRow: { flexDirection: 'row', gap: 12 },
  hero: {
    borderRadius: radii.lg, padding: 16, marginBottom: 12,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.slate200,
  },
  heroOn: { borderColor: colors.success, backgroundColor: colors.successBg },
  // Demoted from the lead of the screen to a context row, so it loses the
  // padding that made it read as the headline.
  heroCompact: { padding: 13, marginBottom: 0 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  heroDot: { width: 8, height: 8, borderRadius: 4 },
  heroDotOn: { backgroundColor: colors.success },
  heroDotOff: { backgroundColor: colors.slate300 },
  heroState: { fontSize: 11, fontWeight: '800', color: colors.slate500, textTransform: 'uppercase', letterSpacing: 0.4 },
  heroStateOn: { color: '#047857' },
  heroShift: { fontSize: 17, fontWeight: '800', color: colors.textLight, marginTop: 6, letterSpacing: -0.3 },
  heroSince: { fontSize: 11.5, color: colors.slate500, fontWeight: '600', marginTop: 3 },

  geoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.slate200,
    paddingHorizontal: 12, paddingVertical: 11, marginBottom: 12,
  },
  // The fence banner and its drawing are one unit; the gap is between them,
  // not around each.
  geoBlock: { gap: 10 },
  geoText: { flex: 1 },
  geoTitleOk: { fontSize: 12.5, fontWeight: '800', color: '#047857' },
  geoTitleWarn: { fontSize: 12.5, fontWeight: '800', color: '#B45309' },
  geoTitleBad: { fontSize: 12.5, fontWeight: '800', color: colors.danger },
  geoSub: { fontSize: 10.5, color: colors.slate500, fontWeight: '600', marginTop: 2 },
  geoFix: { flexDirection: 'row', gap: 12 },
  geoFixText: { fontSize: 11.5, fontWeight: '800', color: colors.brand[700] },

  breakCard: {
    borderWidth: 1, borderColor: colors.slate200, borderRadius: radii.md,
    padding: 12, marginBottom: 10, gap: 4,
  },
  breakCardOver: { borderColor: '#B45309', backgroundColor: colors.warningBg },
  breakCardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  breakCardLabel: { fontSize: 11, fontWeight: '700', color: colors.slate500 },
  breakCardValue: { fontSize: 13, fontWeight: '800', color: colors.textLight },
  breakCardLeft: { fontSize: 11, color: colors.slate400, fontWeight: '600' },
  breakCardOverText: { fontSize: 11.5, color: '#B45309', fontWeight: '800' },
  breakButton: { flex: 1 },
  lastPunchText: { fontSize: 11, color: colors.slate500, fontWeight: '600' },
  });
}
