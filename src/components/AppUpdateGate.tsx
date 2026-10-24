import React, { useEffect, useMemo, useState } from 'react';
import { AppState, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Updates from 'expo-updates';
import { useIsMutating, useQuery } from '@tanstack/react-query';
import { Button } from './ui';
import { ColorScheme } from '../theme/tokens';
import { useThemeStore } from '../stores/themeStore';
import { useT } from '../i18n';
import { getHealthDeps } from '../api/verification.api';
import { installedAppVersion } from '../api/client';

/**
 * Keeps every phone on the release the client asked for -- before sign-in,
 * over everything else.
 *
 *   A BUILD OLDER THAN app.json's minAppVersion (backend /health/deps): a
 *   blocking "Update the app" screen with the store link. An over-the-air
 *   update cannot fix this -- it only reaches builds of its own runtime -- so
 *   this outranks the restart below. Its punches are refused server-side too
 *   (426 APP_UPDATE_REQUIRED), so the screen cannot be skipped.
 *
 *   AN OVER-THE-AIR UPDATE DOWNLOADED: a blocking "Restart now". Checked when
 *   the app opens and each time it returns to the foreground (at most every
 *   ten minutes); never shown while a request is still in flight, so a punch
 *   being sent is never cut off.
 *
 * Off where updates are off (Expo Go, development builds, web) and when the
 * server's answer is unknown -- an unreachable server never blocks the app.
 */
const CHECK_EVERY_MS = 10 * 60 * 1000;
const VERSION = /^\d+(\.\d+){0,2}$/;

function olderThan(installed: string, min: string): boolean {
  const a = installed.split('.').map(Number);
  const b = min.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d < 0;
  }
  return false;
}

function useOverTheAirReady(): boolean {
  const { isUpdatePending } = Updates.useUpdates();
  const busy = useIsMutating() > 0;
  useEffect(() => {
    if (!Updates.isEnabled) return undefined;
    let last = 0;
    const check = async () => {
      if (Date.now() - last < CHECK_EVERY_MS) return;
      last = Date.now();
      try {
        const found = await Updates.checkForUpdateAsync();
        if (found.isAvailable) await Updates.fetchUpdateAsync();
      } catch {
        // Offline or the update server is down: try again next time.
      }
    };
    void check();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void check(); });
    return () => sub.remove();
  }, []);
  return Updates.isEnabled && isUpdatePending && !busy;
}

function useStoreUpdate(): { required: boolean; url: string | null } {
  const installed = installedAppVersion();
  const deps = useQuery({
    queryKey: ['health-deps'],
    queryFn: getHealthDeps,
    enabled: !!installed,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const os = Platform.OS === 'ios' ? 'ios' : 'android';
  const min = deps.data?.app?.minVersion?.[os];
  const required = !!installed && typeof min === 'string' && VERSION.test(min) && olderThan(installed, min);
  return { required, url: deps.data?.app?.storeUrl?.[os] ?? null };
}

export function AppUpdateGate({ children }: { children: React.ReactNode }) {
  const store = useStoreUpdate();
  const otaReady = useOverTheAirReady();
  if (store.required) return <UpdateScreen kind="store" storeUrl={store.url} />;
  if (otaReady) return <UpdateScreen kind="restart" />;
  return <>{children}</>;
}

function UpdateScreen({ kind, storeUrl }: { kind: 'store' | 'restart'; storeUrl?: string | null }) {
  const t = useT();
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState('');

  const restart = async () => {
    setBusy(true);
    setFailed('');
    try {
      await Updates.reloadAsync();
    } catch {
      setBusy(false);
      setFailed(t('update.restartFailed'));
    }
  };

  return (
    <SafeAreaView style={styles.wrap}>
      <View style={styles.body} accessibilityRole="alert">
        <View style={styles.icon}>
          <Ionicons name={kind === 'store' ? 'cloud-download-outline' : 'refresh-circle-outline'} size={40} color={colors.brand[700]} />
        </View>
        <Text style={styles.title}>{kind === 'store' ? t('update.requiredTitle') : t('update.readyTitle')}</Text>
        <Text style={styles.text}>
          {kind === 'store' ? (storeUrl ? t('update.requiredBody') : t('update.requiredNoLink')) : t('update.readyBody')}
        </Text>
        {failed ? <Text style={styles.failed}>{failed}</Text> : null}
        <View style={styles.action}>
          {kind === 'store' ? (
            storeUrl ? <Button title={t('update.openStore')} onPress={() => void Linking.openURL(storeUrl)} /> : null
          ) : (
            <Button title={t('update.restartNow')} loading={busy} onPress={() => void restart()} />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    wrap: { flex: 1, backgroundColor: colors.bgLight },
    body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
    icon: {
      width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.brand[50], marginBottom: 6,
    },
    title: { fontSize: 19, fontWeight: '800', color: colors.textLight, textAlign: 'center' },
    text: { fontSize: 13.5, lineHeight: 20, color: colors.slate600, textAlign: 'center', maxWidth: 360 },
    failed: { fontSize: 12, color: colors.dangerText, textAlign: 'center' },
    action: { alignSelf: 'stretch', maxWidth: 360, width: '100%', marginTop: 8 },
  });
