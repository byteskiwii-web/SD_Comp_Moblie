import React, { useEffect, useState } from 'react';
import { Alert, Linking, Modal, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card } from '../../components/ui';
import { colors, radii } from '../../theme/tokens';
import { useAuthStore } from '../../stores/authStore';
import { useShiftStore } from '../../stores/shiftStore';
import { haversineDistance } from '../../utils/haversine';
import { clockIn, clockOut, getAttendanceHistory } from '../../api/attendance.api';
import { CameraCaptureScreen } from './CameraCaptureScreen';
import { getApiErrorMessage } from '../../api/client';

const today = () => new Date().toISOString().slice(0, 10);

export function ClockPanel() {
  const employee = useAuthStore((s) => s.employee);
  const store = useAuthStore((s) => s.store);
  const setClockedIn = useShiftStore((s) => s.setClockedIn);
  const setClockedOut = useShiftStore((s) => s.setClockedOut);
  const queryClient = useQueryClient();

  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState('');
  const [pendingAction, setPendingAction] = useState<'clock-in' | 'clock-out' | null>(null);
  const [banner, setBanner] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null);

  const historyQuery = useQuery({
    queryKey: ['attendance-today', employee?.id],
    queryFn: () => getAttendanceHistory(employee!.id, today(), today()),
    enabled: !!employee,
  });

  // Marks come back most-recent-first. Employees can clock in/out multiple
  // times per day (e.g. lunch breaks), so only the LATEST mark today
  // determines current status -- not "does a clock-in exist today".
  const marks = historyQuery.data ?? [];
  const latestMark = marks[0];
  const isCurrentlyClockedIn = latestMark?.mark_type === 'clock-in';
  const lastClockIn = marks.find((m) => m.mark_type === 'clock-in');
  const lastClockOut = marks.find((m) => m.mark_type === 'clock-out');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        if (!cancelled) setLocationError('Location permission is needed to clock in/out.');
        return;
      }
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      } catch {
        if (!cancelled) setLocationError('Could not get your location. Try again.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      setBanner({
        tone: isPending ? 'warning' : 'success',
        text: isPending
          ? 'Recorded — you were outside the store radius, so this is pending HR approval.'
          : pendingAction === 'clock-in'
            ? 'Clocked in successfully.'
            : 'Clocked out successfully.',
      });
      setPendingAction(null);
    },
    onError: (err) => {
      setBanner({ tone: 'warning', text: getApiErrorMessage(err) });
      setPendingAction(null);
    },
  });

  // "Allow all the time" location access is mandatory before a punch is
  // accepted -- without it, the periodic mid-shift geofence check
  // (useLocationPollingEffect) can't run once the employee is clocked in.
  // Checked here (after the selfie is already captured) rather than
  // earlier, since Android only lets an app prompt for background access
  // after foreground access is already granted.
  const handleCaptured = async (filePath: string) => {
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== 'granted') {
      setPendingAction(null);
      Alert.alert(
        'Background location required',
        'To clock in or out, you must allow location access "All the time" (not just "While using the app"), so we can periodically confirm you\'re still at the store during your shift.',
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

      <Card style={styles.geoCard}>
        {locationError ? (
          <Text style={styles.geoError}>{locationError}</Text>
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

      <View style={styles.actionsRow}>
        <Button
          title="Clock In"
          onPress={() => setPendingAction('clock-in')}
          disabled={isCurrentlyClockedIn || !coords}
        />
      </View>
      <View style={styles.actionsRow}>
        <Button
          title="Clock Out"
          variant="outline"
          onPress={() => setPendingAction('clock-out')}
          disabled={!isCurrentlyClockedIn || !coords}
        />
      </View>

      {(lastClockIn || lastClockOut) && (
        <Card>
          {lastClockIn && (
            <Text style={styles.lastPunchText}>
              Last clock-in: {new Date(lastClockIn.timestamp).toLocaleTimeString()}
            </Text>
          )}
          {lastClockOut && (
            <Text style={styles.lastPunchText}>
              Last clock-out: {new Date(lastClockOut.timestamp).toLocaleTimeString()}
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
  geoLoading: { fontSize: 13, color: colors.slate500 },
  geoError: { fontSize: 13, color: colors.danger, textAlign: 'center' },
  geoStatus: { fontSize: 14, fontWeight: '800' },
  geoInside: { color: colors.success },
  geoOutside: { color: colors.danger },
  geoDetail: { fontSize: 12, color: colors.slate500, marginTop: 4 },
  geoWarning: { fontSize: 11, color: colors.warning, marginTop: 8, textAlign: 'center', fontWeight: '600' },
  actionsRow: { width: '100%' },
  lastPunchText: { fontSize: 12, color: colors.slate500, fontWeight: '600' },
});
