import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { ColorScheme, radii } from '../theme/tokens';
import { useThemeStore } from '../stores/themeStore';
import { useAuthStore } from '../stores/authStore';
import { useTourRegistry, type Band, type Reveal } from './tour/TourTarget';
import { useT, type TKey } from '../i18n';

/**
 * The first-run tour.
 *
 * Shown once automatically after the first sign-in, and replayable from Home
 * or Profile. There is no sign-up in this product — employees are created by
 * HR, so first LOGIN is the only moment that corresponds to "new user".
 *
 * It WALKS you there. Each step navigates to the tab it is describing and cuts
 * a hole in the dimming layer around the actual control, so the words are read
 * against the thing they are about. A tour that describes six screens from a
 * single card leaves somebody to find all six afterwards from memory, which is
 * the same as not having toured them.
 *
 * Everything about the spotlight degrades safely. If a target is not on screen
 * — not mounted yet, scrolled away, a screen changed since this was written —
 * the step falls back to a plain centred card and still reads correctly. The
 * tour is not allowed to be the thing that breaks.
 *
 * The steps describe what this app actually does. It would be easy to lift the
 * prototype's five, but two of those cover payslips and gigs, which have no
 * backend and no screens — a tour that promises features the app does not have
 * is worse than no tour.
 */

const SEEN_KEY = 'zip_hrms_tour_seen_v1';

/** Where a step lives, in the shape `navigate` wants for a nested stack. */
type Destination =
  | { tab: 'Home' }
  | { tab: 'Leave' }
  | { tab: 'Team' }
  | { tab: 'Profile' }
  | { tab: 'Attendance'; panel: 'clock' | 'history' | 'regularise' };

type Step = {
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: TKey;
  bodyKey: TKey;
  to: Destination;
  /** The `TourTarget` id to spotlight. Absent, or absent from the tree, centres the card. */
  target?: string;
  /**
   * Restricts the step to one role.
   *
   * The Team tab only exists for a team lead, so walking an employee to it
   * would navigate nowhere and describe a screen they will never see. Filtered
   * before the walk rather than skipped during it, so "3 of 9" counts the
   * steps this person is actually getting.
   */
  role?: 'team-lead';
  /** Dropped for anyone who already has a profile photo — see AppTour. */
  skipWhenPhotoSet?: boolean;
};

const STEPS: Step[] = [
  /* THE ONE ASK, FIRST AND SKIPPABLE. A photo is how a manager recognises a
     name in the team list, so it is worth asking for -- but it is not worth
     blocking anyone over, and Next is the skip. */
  {
    icon: 'camera-reverse-outline',
    titleKey: 'tour.addPhoto',
    bodyKey: 'tour.addPhotoBody',
    to: { tab: 'Profile' },
    target: 'profile-top',
    skipWhenPhotoSet: true,
  },
  {
    icon: 'phone-portrait-outline',
    titleKey: 'tour.dayHere',
    bodyKey: 'tour.dayHereBody',
    to: { tab: 'Home' },
    target: 'home-hero',
  },
  {
    icon: 'camera-outline',
    titleKey: 'tour.startShift',
    bodyKey: 'tour.startShiftBody',
    to: { tab: 'Attendance', panel: 'clock' },
    target: 'clock-action',
  },
  {
    icon: 'navigate-outline',
    titleKey: 'tour.insideFence',
    bodyKey: 'tour.insideFenceBody',
    to: { tab: 'Attendance', panel: 'clock' },
    target: 'clock-location',
  },
  {
    icon: 'pause-circle-outline',
    titleKey: 'tour.breaks',
    bodyKey: 'tour.breaksBody',
    to: { tab: 'Attendance', panel: 'clock' },
    target: 'clock-action',
  },
  {
    icon: 'time-outline',
    titleKey: 'tour.yourHours',
    bodyKey: 'tour.yourHoursBody',
    to: { tab: 'Attendance', panel: 'history' },
    target: 'history-list',
  },
  {
    icon: 'create-outline',
    titleKey: 'tour.missedPunch',
    bodyKey: 'tour.missedPunchBody',
    to: { tab: 'Attendance', panel: 'regularise' },
    target: 'regularise-form',
  },
  {
    icon: 'arrow-undo-outline',
    titleKey: 'tour.takeItBack',
    bodyKey: 'tour.takeItBackBody',
    to: { tab: 'Attendance', panel: 'regularise' },
    target: 'regularise-list',
  },
  {
    icon: 'calendar-outline',
    titleKey: 'tour.timeOff',
    bodyKey: 'tour.timeOffBody',
    to: { tab: 'Leave' },
    target: 'leave-apply',
  },
  {
    icon: 'list-outline',
    titleKey: 'tour.leaveStatus',
    bodyKey: 'tour.leaveStatusBody',
    to: { tab: 'Leave' },
    target: 'leave-list',
  },
  {
    icon: 'people-outline',
    titleKey: 'tour.yourTeam',
    bodyKey: 'tour.yourTeamBody',
    to: { tab: 'Team' },
    target: 'team-tabs',
    role: 'team-lead',
  },
  {
    icon: 'airplane-outline',
    titleKey: 'tour.whoIsOff',
    bodyKey: 'tour.whoIsOffBody',
    to: { tab: 'Team' },
    target: 'team-tabs',
    role: 'team-lead',
  },
  {
    icon: 'person-circle-outline',
    titleKey: 'tour.everythingElse',
    bodyKey: 'tour.everythingElseBody',
    to: { tab: 'Profile' },
    target: 'profile-top',
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

const PAD = 8;

/**
 * The tab bar the tour runs inside, whose height AppTabs sets to 62 plus the
 * home indicator. Subtracted from the band because a spotlight drawn under the
 * bar highlights something the person cannot see, and because the tour's own
 * card must not sit under it either.
 */
const TAB_BAR_BASE = 62;

/**
 * The shortest the card is ever likely to be: header, three lines of body,
 * dots and a row of buttons. Used only to decide whether the free strip beside
 * a spotlight can hold the card at all -- when it cannot, the step drops the
 * spotlight rather than laying the card over the thing it is describing.
 */
const MIN_CARD_SPACE = 250;

/** The close button's own height plus a gap, so a top-anchored card clears it. */
const ESCAPE_CLEARANCE = 44;

/** Below this much of the target actually on screen, a hole is a lie. */
const MIN_VISIBLE = 0.6;

export function AppTour({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const navigation = useNavigation<any>();
  const registry = useTourRegistry();
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const [index, setIndex] = useState(0);
  // The employee's own role decides which steps exist at all -- see Step.role.
  const role = useAuthStore((st) => st.employee?.role);
  /* Somebody who already has a photo should not be asked for one -- the step
     reads as a chore they have done, and it costs them a tap to dismiss
     advice that does not apply. Dropped from the list rather than skipped
     during the walk, so "1 of 10" counts what they are actually getting. */
  const hasPhoto = Boolean(useAuthStore((st) => st.profile?.photoUpdatedAt));
  const steps = useMemo(
    () => STEPS.filter((st: Step) => (!st.role || st.role === role) && !(st.skipWhenPhotoSet && hasPhoto)),
    [role, hasPhoto]
  );
  const [spot, setSpot] = useState<Reveal | null>(null);
  const cancelled = useRef(false);
  // Live, not read once: a rotation or a fold changes both, and a band
  // computed from stale numbers puts the hole and the card in the wrong place.
  const screen = useWindowDimensions();
  const insets = useSafeAreaInsets();

  /* The strip of screen a spotlight is allowed to live in: under the status
     bar / notch, above the tab bar and home indicator. */
  const band: Band = useMemo(
    () => ({
      top: insets.top + 8,
      bottom: screen.height - (TAB_BAR_BASE + insets.bottom) - 8,
    }),
    [insets.top, insets.bottom, screen.height]
  );

  // Clamped: a role change between renders must not index past the end.
  const step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;

  useEffect(() => {
    if (visible) setIndex(0);
  }, [visible]);

  const finish = useCallback(() => {
    void markTourSeen();
    onClose();
  }, [onClose]);

  // Navigate to the step's home, then find its target.
  //
  // The retry loop is the whole trick: right after a tab change the target is
  // not in the tree yet, so a single measure returns nothing and the step
  // silently loses its spotlight. Re-asking a few times over half a second
  // costs nothing and covers the mount.
  useEffect(() => {
    if (!visible) return;
    cancelled.current = false;
    setSpot(null);

    try {
      if (step.to.tab === 'Attendance') {
        navigation.navigate('Attendance', {
          screen: 'AttendanceHome',
          params: { tab: step.to.panel },
        });
      } else {
        navigation.navigate(step.to.tab);
      }
    } catch {
      // A destination that does not exist should not strand the tour on a
      // blank overlay -- the step still reads, just without the walk.
    }

    if (!step.target || !registry) return;

    let attempt = 0;
    const tick = async () => {
      if (cancelled.current) return;
      // reveal, not measure: it scrolls the target into the band first, so the
      // rectangle it hands back is somewhere the person can actually look.
      const found = await registry.reveal(step.target!, band);
      if (cancelled.current) return;
      if (found) return setSpot(found);
      if (attempt++ < 6) setTimeout(tick, 90);
    };
    const first = setTimeout(tick, 140);

    return () => {
      cancelled.current = true;
      clearTimeout(first);
    };
  }, [visible, index, step, navigation, registry, band]);

  if (!visible) return null;

  /*
   * THE HOLE IS WHAT IS VISIBLE OF THE TARGET, NOT WHERE THE TARGET CLAIMS TO BE.
   *
   * measureInWindow answers for a view scrolled off screen exactly as
   * confidently as for one in front of you, and every misplaced spotlight
   * reported came from trusting that answer: a bright rectangle over the
   * greeting bar while the card it described sat scrolled away above, and a
   * clipped sliver behind the tab bar for one below the fold. `reveal` has
   * already tried to scroll it into the band; this clamps what it reports to
   * the band and then checks how much of the target actually survived. A
   * target mostly outside the band gets no hole at all -- a centred card that
   * says the right words is better than a ring around the wrong thing.
   */
  const padded = spot
    ? {
        top: spot.rect.y - PAD,
        bottom: spot.rect.y + spot.rect.height + PAD,
        left: spot.rect.x - PAD,
        right: spot.rect.x + spot.rect.width + PAD,
      }
    : null;

  const clamped = padded && spot
    ? {
        top: Math.max(spot.viewport.top, padded.top),
        bottom: Math.min(spot.viewport.bottom, padded.bottom),
        left: Math.max(0, padded.left),
        right: Math.min(screen.width, padded.right),
      }
    : null;

  const visibleFraction =
    clamped && padded && padded.bottom > padded.top
      ? Math.max(0, clamped.bottom - clamped.top) / (padded.bottom - padded.top)
      : 0;

  /* Which side of the spotlight the card goes, and whether there is room for
     it there at all. No measuring of the card -- a measured height is always
     one render behind, which is how a card once ended up with its buttons past
     the bottom of the screen. Only "is this strip taller than a card can be". */
  const roomAbove = clamped ? clamped.top - (band.top + ESCAPE_CLEARANCE) : 0;
  const roomBelow = clamped ? band.bottom - clamped.bottom : 0;
  const cardBelow = roomBelow >= roomAbove;
  const cardSpace = cardBelow ? roomBelow : roomAbove;

  const hole =
    clamped && visibleFraction >= MIN_VISIBLE && cardSpace >= MIN_CARD_SPACE
      ? {
          x: clamped.left,
          y: clamped.top,
          width: Math.max(0, clamped.right - clamped.left),
          height: Math.max(0, clamped.bottom - clamped.top),
        }
      : null;

  /* The card is confined to the strip beside the hole, so it cannot overlap
     it however tall its text turns out to be, and is confined to the safe band
     otherwise, so it never hides under a notch or the tab bar. */
  const topOfCardArea = band.top + ESCAPE_CLEARANCE;
  const cardBounds = hole
    ? cardBelow
      ? { top: hole.y + hole.height + 12, bottom: screen.height - band.bottom + 8 }
      : { top: topOfCardArea, bottom: screen.height - hole.y + 12 }
    : { top: topOfCardArea, bottom: screen.height - band.bottom + 8 };

  /*
   * statusBarTranslucent, or ANDROID DRAWS EVERYTHING TOO LOW.
   *
   * Without it a Modal's content starts below the status bar, while the
   * spotlight rectangles come from measureInWindow, which counts from the top
   * of the screen. The two disagree by exactly the status bar's height, so
   * every hole and every card sat that far down -- enough, on a tall phone
   * with an anchor near the bottom, to push the card's buttons off screen.
   * Toast.tsx sets this for the same reason.
   */
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={finish}>
      {hole ? (
        <View style={styles.fill} pointerEvents="box-none">
          {/* Four panes around the cutout. A real mask needs a native shape
              layer; four dim rectangles need nothing and behave identically. */}
          <View style={[styles.dim, { top: 0, left: 0, right: 0, height: hole.y }]} />
          <View style={[styles.dim, { top: hole.y + hole.height, left: 0, right: 0, bottom: 0 }]} />
          <View style={[styles.dim, { top: hole.y, left: 0, width: hole.x, height: hole.height }]} />
          <View
            style={[
              styles.dim,
              { top: hole.y, left: hole.x + hole.width, right: 0, height: hole.height },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.ring,
              { top: hole.y, left: hole.x, width: hole.width, height: hole.height },
            ]}
          />
        </View>
      ) : (
        <View style={[styles.fill, styles.dimAll]} pointerEvents="box-none" />
      )}

      <Pressable
        onPress={finish}
        style={[styles.escape, { top: insets.top + 8 }]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('common.skip')}
      >
        <Ionicons name="close" size={19} color="#FFFFFF" />
      </Pressable>

      <View
        style={[
          styles.cardWrap,
          cardBounds,
          hole ? (cardBelow ? styles.cardToTop : styles.cardToBottom) : styles.cardCentred,
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name={step.icon} size={20} color={colors.white} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.stepCount}>
                {t('tour.stepOf', { current: index + 1, total: steps.length })}
              </Text>
              <Text style={styles.title}>{t(step.titleKey)}</Text>
            </View>
          </View>

          <View style={styles.body}>
            <Text style={styles.bodyText}>{t(step.bodyKey)}</Text>

            <View style={styles.dots}>
              {steps.map((_, i) => (
                <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
              ))}
            </View>

            <View style={styles.actions}>
              <Pressable onPress={finish} hitSlop={8} accessibilityRole="button">
                <Text style={styles.skip}>{t('common.skip')}</Text>
              </Pressable>

              <View style={styles.navButtons}>
                {index > 0 && (
                  <Pressable
                    onPress={() => setIndex((i) => i - 1)}
                    style={[styles.navButton, styles.navBack]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.navBackText}>{t('common.back')}</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => (last ? finish() : setIndex((i) => i + 1))}
                  style={[styles.navButton, styles.navNext]}
                  accessibilityRole="button"
                >
                  <Text style={styles.navNextText}>{last ? t('common.done') : t('common.next')}</Text>
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

const DIM = 'rgba(15,23,42,0.72)';

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    dimAll: { backgroundColor: DIM },
    dim: { position: 'absolute', backgroundColor: DIM },
    ring: {
      position: 'absolute',
      borderRadius: radii.md,
      borderWidth: 2.5,
      borderColor: colors.white,
    },

    /* A full-screen box in every case. Where the card sits inside it is a
       flex decision, which is why it can never be placed off the edge. */
    /* `top` and `bottom` are supplied per step (cardBounds): the card is
       confined to the strip beside the spotlight, so flexbox alone keeps it
       off the thing being highlighted and inside the safe area. */
    cardWrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      paddingHorizontal: 16,
    },
    cardToTop: { justifyContent: 'flex-start' },
    cardToBottom: { justifyContent: 'flex-end' },
    cardCentred: { justifyContent: 'center' },
    /* Pinned to the overlay, not to the card. Whatever else goes wrong with
       the layout, there is always something on screen that ends the tour. */
    /* `top` comes from the safe-area inset at the call site. */
    escape: {
      position: 'absolute',
      right: 16,
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
    },
    card: {
      width: '100%',
      maxWidth: 460,
      alignSelf: 'center',
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      backgroundColor: colors.brand[700],
    },
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: radii.md,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: { flex: 1 },
    stepCount: {
      color: colors.white,
      opacity: 0.8,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.6,
    },
    title: { color: colors.white, fontSize: 15, fontWeight: '800', marginTop: 2, letterSpacing: -0.3 },

    body: { padding: 16 },
    bodyText: { fontSize: 12, lineHeight: 19, color: colors.slate700 },

    dots: { flexDirection: 'row', gap: 5, marginTop: 16 },
    dot: { width: 16, height: 3.5, borderRadius: 2, backgroundColor: colors.slate200 },
    dotActive: { backgroundColor: colors.brand[700], width: 24 },

    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 16,
    },
    skip: { fontSize: 12.5, fontWeight: '700', color: colors.slate500 },
    navButtons: { flexDirection: 'row', gap: 10 },
    navButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: radii.md,
    },
    navBack: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.slate200 },
    navBackText: { fontSize: 12.5, fontWeight: '700', color: colors.slate700 },
    navNext: { backgroundColor: colors.brand[700] },
    navNextText: { fontSize: 12.5, fontWeight: '800', color: colors.white },
  });
}
