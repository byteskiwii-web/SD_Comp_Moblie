import React, { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button } from './ui';
import { ColorScheme, radii } from '../theme/tokens';
import { useThemeStore } from '../stores/themeStore';
import { useT } from '../i18n';

/**
 * The answer to a punch, as a picture first and words second.
 *
 * A one-line toast at the bottom was being ignored: people looked at the
 * screen, saw nothing they recognised, and walked off -- including after a
 * face mismatch, when nothing had been recorded. A big green tick or red
 * cross is understood without reading, the way a UPI payment is.
 *
 *   success  green tick, closes itself after AUTO_CLOSE_MS (or on a tap).
 *   failure  red cross and a shake, and STAYS until tapped: a punch that did
 *            not land must never be missable.
 *
 * Core Animated with the native driver only (scale, opacity, translateX), so
 * it is smooth on low-end Android 10 phones and needs no new native module --
 * it ships over the air. With "reduce motion" on it simply appears.
 */
export type PunchOutcome =
  | { ok: true; title: string; time?: string; note?: string }
  | { ok: false; title: string; reason: string; onRetry?: () => void };

const AUTO_CLOSE_MS = 2200;
const CIRCLE = 96;

export function PunchResult({ outcome, onClose }: { outcome: PunchOutcome; onClose: () => void }) {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  const pop = useRef(new Animated.Value(0)).current;
  const mark = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    const said = outcome.ok
      ? [outcome.title, outcome.time, outcome.note].filter(Boolean).join('. ')
      : `${outcome.title}. ${outcome.reason}`;
    AccessibilityInfo.announceForAccessibility(said);

    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          pop.setValue(1);
          mark.setValue(1);
          return;
        }
        const steps: Animated.CompositeAnimation[] = [
          Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
          Animated.timing(mark, { toValue: 1, duration: 220, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
        ];
        const extra = outcome.ok
          ? Animated.timing(ring, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true })
          : Animated.sequence(
              [10, -10, 7, -7, 0].map((x) => Animated.timing(shake, { toValue: x, duration: 60, useNativeDriver: true }))
            );
        Animated.sequence([...steps, extra]).start();
      });

    const timer = outcome.ok ? setTimeout(onClose, AUTO_CLOSE_MS) : null;
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // Runs once per outcome shown; onClose is stable for its lifetime.
  }, [outcome]);

  const tone = outcome.ok ? colors.success : colors.danger;

  const body = (
    // Announced once by the effect above; a live region too would read it twice on Android.
    <View style={styles.card} accessible={outcome.ok}>
      <Animated.View style={[styles.circleWrap, { transform: [{ translateX: shake }] }]}>
        {outcome.ok ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ring,
              { borderColor: tone },
              {
                opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
                transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }],
              },
            ]}
          />
        ) : null}
        <Animated.View style={[styles.circle, { backgroundColor: tone, transform: [{ scale: pop }] }]}>
          <Animated.View style={{ opacity: mark, transform: [{ scale: mark }] }}>
            <Ionicons name={outcome.ok ? 'checkmark' : 'close'} size={60} color={colors.white} />
          </Animated.View>
        </Animated.View>
      </Animated.View>

      <Text style={[styles.title, { color: outcome.ok ? colors.successText : colors.dangerText }]}>{outcome.title}</Text>
      {outcome.ok && outcome.time ? <Text style={styles.time}>{outcome.time}</Text> : null}
      {outcome.ok && outcome.note ? <Text style={styles.note}>{outcome.note}</Text> : null}
      {!outcome.ok ? <Text style={styles.reason}>{outcome.reason}</Text> : null}

      {!outcome.ok ? (
        <View style={styles.actions}>
          {outcome.onRetry ? <Button title={t('result.tryAgain')} onPress={outcome.onRetry} /> : null}
          <Button title={t('common.close')} variant="outline" onPress={onClose} />
        </View>
      ) : null}
    </View>
  );

  // A success closes on a tap anywhere; a failure only through its buttons.
  return outcome.ok ? (
    <Pressable style={styles.fill} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')}>
      {body}
    </Pressable>
  ) : (
    <View style={styles.fill}>{body}</View>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    fill: { width: '100%', alignItems: 'center' },
    card: {
      width: '100%',
      maxWidth: 320,
      alignItems: 'center',
      gap: 8,
      paddingVertical: 28,
      paddingHorizontal: 24,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
    },
    circleWrap: { width: CIRCLE, height: CIRCLE, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, alignItems: 'center', justifyContent: 'center' },
    ring: { position: 'absolute', width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, borderWidth: 3 },
    title: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
    time: { fontSize: 15, fontWeight: '700', color: colors.textLight, textAlign: 'center' },
    note: { fontSize: 13, lineHeight: 18, color: colors.warningText, textAlign: 'center', marginTop: 2 },
    reason: { fontSize: 13, lineHeight: 19, color: colors.slate500, textAlign: 'center' },
    actions: { alignSelf: 'stretch', gap: 10, marginTop: 10 },
  });
}
