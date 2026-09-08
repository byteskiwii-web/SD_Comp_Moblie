import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Modal, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card } from '../../components/ui';
import { TourTarget } from '../../components/tour/TourTarget';
import { colors, radii } from '../../theme/tokens';
import { useAuthStore } from '../../stores/authStore';
import { useShiftStore } from '../../stores/shiftStore';
import { haversineDistance } from '../../utils/haversine';
import { clockIn, clockOut, endBreak, getAttendanceHistory, startBreak } from '../../api/attendance.api';
import { CameraCaptureScreen } from './CameraCaptureScreen';
import { runtimeLabel, supportsBackgroundLocation } from '../../native/runtime';
import { getApiErrorMessage } from '../../api/client';
import { getLatestMarkOfTypes, SHIFT_TYPES, BREAK_TYPES } from '../../utils/attendanceStatus';
import { formatTimeWithSeconds, toLocalDateKey } from '../../utils/datetime';

const today = () => toLocalDateKey();

export function ClockPanel() {
  const employee = useAuthStore((s) => s.employee);
  const store = useAuthStore((s) => s.store);
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
      setLocationError(
        'Location Services is switched off for this phone. Open Settings › Privacy & Security › Location Services and turn it on, then tap Try again.'
      );
      return;
    }

    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      setPermission(perm.canAskAgain ? 'askable' : 'blocked');
      setLocationError(
        perm.canAskAgain
          ? 'Location permission is needed to start or end your shift.'
          : // Open Settings lands on this app's own page, so the path starts
            // there. Naming the option matters: iOS offers four on that screen
            // and only this one works. In Expo Go the page is Expo Go's -- there
            // is no zip-hrms row to find -- but the steps read the same either way.
            'Tap Open Settings, choose Location, then ‘While Using the App’. Come back and tap Try again.'
      );
      return;
    }
    setPermission('granted');
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    } catch {
      setLocationError('Could not get your location. Try again.');
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
        : ` No mid-shift location checks on ${runtimeLabel}.`;
      setBanner({
        tone: isPending || !supportsBackgroundLocation ? 'warning' : 'success',
        text:
          (isPending
            ? 'Recorded — you were outside the store radius, so this is pending HR approval.'
            : pendingAction === 'clock-in'
              ? 'Shift started successfully.'
              : 'Shift ended successfully.') + unverified,
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
          ? 'Recorded — you were outside the store radius, so this is pending HR approval.'
          : action === 'break-start'
            ? 'Break started.'
            : 'Break ended.',
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
      Alert.alert(
        'Background location required',
        'To start or end your shift, you must allow location access "All the time" (not just "While using the app"), so we can periodically confirm you\'re still at the store during your shift.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
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

      <TourTarget id="clock-location">
      <Card style={styles.geoCard}>
        {locationError ? (
          <>
            <Text style={styles.geoError}>{locationError}</Text>
            <View style={styles.geoActions}>
              <Button title="Try again" onPress={() => void acquireLocation()} variant="outline" />
              {permission === 'blocked' && (
                <Button title="Open Settings" onPress={() => Linking.openSettings()} variant="outline" />
              )}
            </View>
          </>
        ) : distanceMetres == null ? (
          <Text style={styles.geoLoading}>Getting your location…</Text>
        ) : (
          <>
            <Text style={[styles.geoStatus, insideFence ? styles.geoInside : styles.geoOutside]}>
              {insideFence ? 'Inside geo-fence' : 'Outside geo-fence'}
            </Text>
            <Text style={styles.geoDetail}>
              {distanceMetres}m from {store.name}
            </Text>
            {!insideFence && (
              <Text style={styles.geoWarning}>
                Punching outside the fence will be sent for HR approval.
              </Text>
            )}
          </>
        )}
      </Card>
      </TourTarget>

      <TourTarget id="clock-action">
      <View style={styles.actionsRow}>
        <Button
          title="Start Shift"
          onPress={() => setPendingAction('clock-in')}
          disabled={isCurrentlyClockedIn || !coords}
        />
      </View>
      <View style={styles.actionsRow}>
        <Button
          title="End Shift"
          variant="outline"
          onPress={() => setPendingAction('clock-out')}
          disabled={!isCurrentlyClockedIn || !coords || isCurrentlyOnBreak}
        />
      </View>
      </TourTarget>
      {isCurrentlyOnBreak && (
        <Text style={styles.geoWarning}>End your break before ending your shift.</Text>
      )}

      <View style={styles.breakRow}>
        <View style={styles.breakButton}>
          <Button
            title="Start Break"
            variant="outline"
            onPress={() => breakMutation.mutate('break-start')}
            disabled={!isCurrentlyClockedIn || isCurrentlyOnBreak || !coords || breakMutation.isPending}
          />
        </View>
        <View style={styles.breakButton}>
          <Button
            title="End Break"
            variant="outline"
            onPress={() => breakMutation.mutate('break-end')}
            disabled={!isCurrentlyOnBreak || !coords || breakMutation.isPending}
          />
        </View>
      </View>

      {(lastClockIn || lastClockOut || lastBreakStart || lastBreakEnd) && (
        <Card>
          {lastClockIn && (
            <Text style={styles.lastPunchText}>
              Last shift start: {formatTimeWithSeconds(lastClockIn.timestamp)}
            </Text>
          )}
          {lastClockOut && (
            <Text style={styles.lastPunchText}>
              Last shift end: {formatTimeWithSeconds(lastClockOut.timestamp)}
            </Text>
          )}
          {lastBreakStart && (
            <Text style={styles.lastPunchText}>
              Last break start: {formatTimeWithSeconds(lastBreakStart.timestamp)}
            </Text>
          )}
          {lastBreakEnd && (
            <Text style={styles.lastPunchText}>
              Last break end: {formatTimeWithSeconds(lastBreakEnd.timestamp)}
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

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  banner: { borderRadius: radii.md, padding: 12 },
  bannerSuccess: { backgroundColor: colors.successBg },
  bannerWarning: { backgroundColor: colors.warningBg },
  bannerText: { fontSize: 12, fontWeight: '600', color: colors.slate800 },
  geoCard: { alignItems: 'center' },
  geoActions: { alignSelf: 'stretch', gap: 8, marginTop: 12 },
  geoLoading: { fontSize: 13, color: colors.slate500 },
  geoError: { fontSize: 13, color: colors.danger, textAlign: 'center' },
  geoStatus: { fontSize: 14, fontWeight: '800' },
  geoInside: { color: colors.success },
  geoOutside: { color: colors.danger },
  geoDetail: { fontSize: 12, color: colors.slate500, marginTop: 4 },
  geoWarning: { fontSize: 11, color: colors.warning, marginTop: 8, textAlign: 'center', fontWeight: '600' },
  actionsRow: { width: '100%' },
  breakRow: { flexDirection: 'row', gap: 12 },
  breakButton: { flex: 1 },
  lastPunchText: { fontSize: 12, color: colors.slate500, fontWeight: '600' },
});
