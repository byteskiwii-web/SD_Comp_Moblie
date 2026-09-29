import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useThemeStore } from '../stores/themeStore';
import { formatDate, formatTime } from '../utils/datetime';
import type { ColorScheme } from '../theme/tokens';

/**
 * WHICH CODE IS THIS PHONE RUNNING?
 *
 * The question that kept coming back, and could never be answered from a
 * screenshot. An Android phone showed the old one-page Profile hours after
 * the hub shipped, and three rounds of photo fixes were "not working" on it
 * because none of them had ever reached it. Every stale device looked exactly
 * like a bug.
 *
 * So the bottom of Profile says it plainly: the commit the bundle was built
 * from, what is running it (Expo Go or the installed app), and where the code
 * came from (the dev server, a published update and when, or the bundle built
 * into the APK). The commit is stamped into the app config at build, publish
 * or serve time -- see buildCommit in app.config.js.
 *
 * It is only a label. It used to be a "tap to check for updates" button, and
 * that was removed (29 Sep 2026): installed APKs are never sent over-the-air
 * updates on their runtime (a new APK is how changes reach them), so the
 * check could only ever answer "up to date" -- a button that does nothing
 * reads as broken. expo-updates still checks by itself at launch, which
 * covers any update that does exist.
 *
 * Deliberately not translated: a commit hash and a runtime name are the same
 * in every language, and the people reading them are the ones fixing it.
 */
type UpdatesModule = typeof import('expo-updates');

// Lazily, and allowed to be absent: nothing else on this screen should fail
// because the updates module could not load in some runtime.
function loadUpdates(): UpdatesModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-updates') as UpdatesModule;
  } catch {
    return null;
  }
}

export function BuildStamp() {
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  const inExpoGo = Constants.executionEnvironment === 'storeClient';
  const extra = Constants.expoConfig?.extra as { buildCommit?: string | null } | undefined;
  const commit = extra?.buildCommit || 'unknown';
  const Updates = loadUpdates();

  const runtime = inExpoGo ? 'Expo Go' : Platform.OS === 'android' ? 'Android app' : 'iOS app';
  let source = '';
  if (Updates?.updateId && !Updates.isEmbeddedLaunch) {
    const at = Updates.createdAt ? ` (${formatDate(Updates.createdAt)} ${formatTime(Updates.createdAt)})` : '';
    source = `update ${Updates.updateId.slice(0, 8)}${at}`;
  } else if (inExpoGo) {
    source = 'dev server';
  } else if (Updates?.isEmbeddedLaunch) {
    source = 'built-in bundle';
  }

  const line = [`Build ${commit}`, runtime, source].filter(Boolean).join(' · ');

  return (
    <View style={styles.wrap} accessibilityRole="text" accessibilityLabel={line}>
      <Text style={styles.line} selectable>
        {line}
      </Text>
    </View>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    wrap: { alignItems: 'center', paddingTop: 18, paddingBottom: 8 },
    line: {
      fontSize: 10.5,
      fontWeight: '600',
      color: colors.slate400,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
  });
