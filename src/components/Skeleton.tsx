import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';
import { ColorScheme, radii } from '../theme/tokens';
import { useThemeStore } from '../stores/themeStore';

/**
 * Loading placeholders shaped like the content that is coming.
 *
 * A spinner says "something is happening"; a skeleton says "a list of days is
 * about to appear here", which stops the screen jumping when it does and gives
 * the eye somewhere to rest. Used everywhere a query is pending.
 *
 * The pulse is opacity-only via useNativeDriver, so it costs nothing on the JS
 * thread — worth caring about here, since these render while the device is
 * already busy fetching and parsing.
 */
export function Skeleton({ width, height = 12, radius = 6, style }: {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        styles.block,
        { height, borderRadius: radius, opacity: pulse },
        width !== undefined ? ({ width } as ViewStyle) : styles.grow,
        style,
      ]}
    />
  );
}

/** One card-shaped placeholder: a heading, two values, a footer line. */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.card}>
      <Skeleton width="45%" height={13} />
      <View style={styles.cardRow}>
        <Skeleton width="30%" height={17} />
        <Skeleton width="30%" height={17} />
      </View>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '60%' : '85%'} height={10} />
      ))}
    </View>
  );
}

/** A stack of them, for a list that is still loading. */
export function SkeletonList({ count = 3, lines = 2 }: { count?: number; lines?: number }) {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </View>
  );
}

/** Rows inside an existing card, where a whole card placeholder would nest badly. */
export function SkeletonRows({ count = 3 }: { count?: number }) {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.rows}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.row}>
          <Skeleton width={22} height={22} radius={11} />
          <Skeleton height={11} />
          <Skeleton width={44} height={11} />
        </View>
      ))}
    </View>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
  block: { backgroundColor: colors.slate200 },
  grow: { alignSelf: 'stretch' },
  list: { gap: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 14,
    gap: 10,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between' },
  rows: { gap: 14, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  });
}
