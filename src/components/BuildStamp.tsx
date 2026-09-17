import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import Constants from 'expo-constants';
import { useThemeStore } from '../stores/themeStore';
import { useT } from '../i18n';
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
 * On an installed app, tapping it checks for an update and applies it at
 * once. An update normally lands on the NEXT launch after it downloads, so
 * "close it and open it twice" was the only instruction there was; this
 * replaces it with one tap. Expo Go loads from the dev server and has nothing
 * to apply, so there it is just a label.
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
  const t = useT();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const canUpdate = !inExpoGo && Boolean(Updates?.isEnabled);

  const check = async () => {
    if (!Updates || busy) return;
    setBusy(true);
    setStatus(t('build.checking'));
    try {
      const found = await Updates.checkForUpdateAsync();
      if (!found.isAvailable) {
        setStatus(t('build.upToDate'));
        return;
      }
      await Updates.fetchUpdateAsync();
      setStatus(t('build.applying'));
      await Updates.reloadAsync();
    } catch (err) {
      console.warn('[build] update check failed', err);
      setStatus(t('build.checkFailed'));
    } finally {
      setBusy(false);
    }
  };

  const line = [`Build ${commit}`, runtime, source].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={canUpdate ? check : undefined}
      disabled={!canUpdate || busy}
      style={({ pressed }) => [styles.wrap, pressed && canUpdate && styles.pressed]}
      accessibilityRole={canUpdate ? 'button' : 'text'}
      accessibilityLabel={line}
    >
      <Text style={styles.line} selectable>
        {line}
      </Text>
      {canUpdate ? <Text style={styles.action}>{status ?? t('build.tapToUpdate')}</Text> : null}
    </Pressable>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    wrap: { alignItems: 'center', paddingTop: 18, paddingBottom: 8, gap: 3 },
    pressed: { opacity: 0.6 },
    line: {
      fontSize: 10.5,
      fontWeight: '600',
      color: colors.slate400,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
    action: { fontSize: 11, fontWeight: '700', color: colors.brand[700] },
  });
