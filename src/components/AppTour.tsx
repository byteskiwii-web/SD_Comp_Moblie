import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii } from '../theme/tokens';

/**
 * The first-run tour.
 *
 * Shown once automatically after the first sign-in, and replayable from Profile
 * for anyone who skipped it or forgot. There is no sign-up in this product —
 * employees are created by HR, so first LOGIN is the only moment that
 * corresponds to "new user".
 *
 * The steps describe what this app actually does. It would be easy to lift the
 * prototype's five, but two of those cover payslips and gigs, which have no
 * backend and no screens — a tour that promises features the app does not have
 * is worse than no tour.
 */

const SEEN_KEY = 'zip_hrms_tour_seen_v1';

type Step = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    icon: 'phone-portrait-outline',
    title: 'Your field app',
    body: 'Start and end your shift, take breaks, check your hours and raise corrections — all from here.',
  },
  {
    icon: 'camera-outline',
    title: 'Shift with a live photo',
    body: 'Starting or ending a shift takes a live selfie and captures your location. Gallery photos are not accepted.',
  },
  {
    icon: 'navigate-outline',
    title: 'Inside the geo-fence',
    body: 'You are checked against your assigned store. Punching from outside still works, but it goes to HR for approval.',
  },
  {
    icon: 'create-outline',
    title: 'Missed a punch?',
    body: 'Attendance › Regularise. Pick the day, adjust the times that are wrong, add a note. Your manager approves it.',
  },
  {
    icon: 'time-outline',
    title: 'Your hours',
    body: 'Attendance › History groups every day with your effective and gross hours. Tap a day to see each stamp.',
  },
  {
    icon: 'person-circle-outline',
    title: 'Profile',
    body: 'Your KYC, documents, shift and company policies live here — along with this tour, if you want it again.',
  },
];

/** Resolves false when storage is unavailable, so the tour simply does not run. */
export async function hasSeenTour(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SEEN_KEY)) === '1';
  } catch {
    return true;
  }
}

export async function markTourSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(SEEN_KEY, '1');
  } catch {
    // A tour that cannot record being seen is an annoyance, not a failure.
  }
}

export function AppTour({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const last = index === STEPS.length - 1;

  useEffect(() => {
    if (visible) setIndex(0);
  }, [visible]);

  const finish = useCallback(() => {
    void markTourSeen();
    onClose();
  }, [onClose]);

  const step = STEPS[index];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={finish}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name={step.icon} size={22} color={colors.white} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.stepCount}>
                STEP {index + 1} OF {STEPS.length}
              </Text>
              <Text style={styles.title}>{step.title}</Text>
            </View>
          </View>

          <View style={styles.body}>
            <Text style={styles.bodyText}>{step.body}</Text>

            <View style={styles.dots}>
              {STEPS.map((_, i) => (
                <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
              ))}
            </View>

            <View style={styles.actions}>
              <Pressable onPress={finish} hitSlop={8} accessibilityRole="button">
                <Text style={styles.skip}>Skip</Text>
              </Pressable>

              <View style={styles.navButtons}>
                {index > 0 && (
                  <Pressable
                    onPress={() => setIndex((i) => i - 1)}
                    style={[styles.navButton, styles.navBack]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.navBackText}>Back</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => (last ? finish() : setIndex((i) => i + 1))}
                  style={[styles.navButton, styles.navNext]}
                  accessibilityRole="button"
                >
                  <Text style={styles.navNextText}>{last ? 'Done' : 'Next'}</Text>
                  <Ionicons name="chevron-forward" size={15} color={colors.white} />
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radii.xl,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 20,
    backgroundColor: colors.brand[700],
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  stepCount: {
    color: colors.white,
    opacity: 0.8,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  title: { color: colors.white, fontSize: 19, fontWeight: '800', marginTop: 3, letterSpacing: -0.3 },

  body: { padding: 20 },
  bodyText: { fontSize: 14.5, lineHeight: 21, color: colors.slate700 },

  dots: { flexDirection: 'row', gap: 6, marginTop: 20 },
  dot: { width: 18, height: 4, borderRadius: 2, backgroundColor: colors.slate200 },
  dotActive: { backgroundColor: colors.brand[700], width: 26 },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  skip: { fontSize: 14.5, fontWeight: '700', color: colors.slate500 },
  navButtons: { flexDirection: 'row', gap: 10 },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: radii.md,
  },
  navBack: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.slate200 },
  navBackText: { fontSize: 14.5, fontWeight: '700', color: colors.slate700 },
  navNext: { backgroundColor: colors.brand[700] },
  navNextText: { fontSize: 14.5, fontWeight: '800', color: colors.white },
});
