import React, { useMemo } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { ColorScheme } from '../theme/tokens';
import { useThemeStore } from '../stores/themeStore';
import { useT } from '../i18n';

/**
 * Links to the privacy policy and terms.
 *
 * Both stores require the privacy policy to be reachable, and Play requires it
 * from INSIDE the app for anything handling sensitive data — which this app
 * does in quantity: Aadhaar, PAN, bank details, background location and a
 * photograph of the employee's face. A policy that exists only in the store
 * listing does not satisfy that.
 *
 * Shown on the sign-in screen (the one screen every user and every reviewer
 * reaches) and on Profile (where someone goes looking for it later).
 *
 * The pages are served by the web console rather than duplicated here, so the
 * wording has exactly one source and cannot drift between platforms. The base
 * URL is configuration because the console will move to a real domain before
 * submission, and a hardcoded DuckDNS address in a store-listed binary would
 * be awkward to change afterwards.
 */
const WEB_BASE =
  process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/+$/, '') ||
  'https://api-sd-hrms.duckdns.org/web';

export const LEGAL_URLS = {
  privacy: `${WEB_BASE}/privacy`,
  terms: `${WEB_BASE}/terms`,
};

async function open(url: string, failMessage: string) {
  try {
    const ok = await Linking.canOpenURL(url);
    if (!ok) throw new Error('no handler');
    await Linking.openURL(url);
  } catch {
    // A device with no browser, or an offline one. Show the address so the
    // employee can still reach it — failing silently on a legal document is
    // the one outcome worth avoiding.
    Alert.alert(failMessage, url);
  }
}

export function LegalLinks({ compact = false }: { compact?: boolean }) {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      <Pressable
        onPress={() => open(LEGAL_URLS.privacy, t('legal.openFailed'))}
        hitSlop={8}
        accessibilityRole="link"
        accessibilityLabel={t('legal.privacy')}
      >
        <Text style={styles.link}>{t('legal.privacy')}</Text>
      </Pressable>
      <Text style={styles.sep}>·</Text>
      <Pressable
        onPress={() => open(LEGAL_URLS.terms, t('legal.openFailed'))}
        hitSlop={8}
        accessibilityRole="link"
        accessibilityLabel={t('legal.terms')}
      >
        <Text style={styles.link}>{t('legal.terms')}</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, marginTop: 20,
    },
    rowCompact: { marginTop: 8, justifyContent: 'flex-start' },
    link: { fontSize: 11, fontWeight: '600', color: colors.slate500, textDecorationLine: 'underline' },
    sep: { fontSize: 11, color: colors.slate400 },
  });
}
