import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii } from '../theme/tokens';

export type ToastTone = 'success' | 'warning';

export type ToastState = { tone: ToastTone; text: string } | null;

const AUTO_HIDE_MS = 2600;
const ANIM_MS = 180;

const TONE = {
  success: { bg: colors.success, icon: 'checkmark-circle' as const },
  warning: { bg: colors.warning, icon: 'alert-circle' as const },
};

/**
 * A brief, screen-anchored confirmation — not another Card in the caller's
 * ScrollView.
 *
 * The problem this replaces: an inline banner at the top of a tall form (the
 * Regularise screen's own submit result, previously) sits above whatever the
 * person scrolled down to reach in order to press the button that produced
 * it. The exact moment a submission's outcome most needs to be seen is the
 * moment it is most likely off-screen.
 *
 * Rendered through RN's own Modal instead of inline JSX for the one property
 * that matters here: a Modal paints above the whole screen as its own native
 * layer, independent of the caller's scroll offset, so it is visible
 * regardless of where the caller had scrolled to. `pointerEvents="box-none"`
 * on the host View keeps everything except the toast itself touchable
 * underneath — this is a notice, not a blocking dialog.
 *
 * Owned by the caller (message + onHide), not a global queue: one screen
 * showing its own submission's outcome has no need for a second one to ever
 * interrupt it, and a per-screen instance is simpler to reason about than a
 * shared one that has to arbitrate between callers that do not know about
 * each other.
 */
export function Toast({ state, onHide }: { state: ToastState; onHide: () => void }) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    Animated.timing(opacity, { toValue: 0, duration: ANIM_MS, useNativeDriver: true }).start(({ finished }) => {
      if (finished) onHide();
    });
  };

  useEffect(() => {
    if (!state) return;
    opacity.setValue(0);
    translateY.setValue(12);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: ANIM_MS, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: ANIM_MS, useNativeDriver: true }),
    ]).start();

    hideTimer.current = setTimeout(dismiss, AUTO_HIDE_MS);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.tone, state?.text]);

  if (!state) return null;
  const tone = TONE[state.tone];

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={dismiss}>
      <View style={[styles.host, { paddingBottom: insets.bottom + 16 }]} pointerEvents="box-none">
        <Animated.View style={{ opacity, transform: [{ translateY }] }}>
          <Pressable onPress={dismiss} style={[styles.toast, { backgroundColor: tone.bg }]}>
            <Ionicons name={tone.icon} size={18} color={colors.white} />
            <Text style={styles.text} numberOfLines={2}>
              {state.text}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radii.md,
    paddingVertical: 13,
    paddingHorizontal: 16,
    shadowColor: colors.slate900,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  text: { flex: 1, color: colors.white, fontSize: 12.5, fontWeight: '700', lineHeight: 17 },
});
