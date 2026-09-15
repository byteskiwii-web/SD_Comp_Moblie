import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ColorScheme, radii } from '../theme/tokens';
import { useThemeStore } from '../stores/themeStore';
import { useT } from '../i18n';

/**
 * The prominent disclosure for background location.
 *
 * Google Play's location policy requires an in-app disclosure that appears
 * BEFORE the runtime permission prompt, names the background use explicitly,
 * and gives the employee a real way to decline. The app previously requested
 * the permission cold and only explained itself in an alert AFTER a denial,
 * which is the exact sequence the policy prohibits — and it is a rejection
 * on its own, not a warning.
 *
 * It is a screen rather than an Alert for two reasons. Play reviewers look
 * for a disclosure that is part of the app rather than an OS dialog, and an
 * Alert cannot carry the required sentence plus the list of what is and is
 * not collected without becoming a wall of text with an OK button.
 *
 * The sentence in `loc.discloseRule` is close to Google's own prescribed
 * wording ("This app collects location data to enable <feature> even when the
 * app is closed or not in use") on purpose. Reviewers match against it, and
 * paraphrasing it is a common reason this check fails.
 *
 * "Not now" is a genuine decline: it closes without requesting anything. The
 * employee can still clock in from the store — they simply cannot be verified
 * mid-shift, which is the honest consequence and is stated on the screen.
 */
export function BackgroundLocationDisclosure({
  visible,
  onAccept,
  onDecline,
}: {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  const collected = [
    t('loc.discloseDoWhen'),
    t('loc.discloseDoStore'),
    t('loc.discloseDoStop'),
  ];
  const notCollected = [t('loc.discloseNotOff'), t('loc.discloseNotTrack')];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDecline}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.badge}>
              <Ionicons name="navigate-circle-outline" size={26} color={colors.brand[700]} />
            </View>

            <Text style={styles.title}>{t('loc.discloseTitle')}</Text>

            {/* The sentence Play matches on. Kept visually distinct so it is
                the first thing read, and never abbreviated. */}
            <View style={styles.rule}>
              <Text style={styles.ruleText}>{t('loc.discloseRule')}</Text>
            </View>

            <Text style={styles.sectionLabel}>{t('loc.discloseDoLabel')}</Text>
            {collected.map((line) => (
              <View key={line} style={styles.row}>
                <Ionicons name="checkmark" size={15} color={colors.successText} style={styles.tick} />
                <Text style={styles.rowText}>{line}</Text>
              </View>
            ))}

            <Text style={styles.sectionLabel}>{t('loc.discloseNotLabel')}</Text>
            {notCollected.map((line) => (
              <View key={line} style={styles.row}>
                <Ionicons name="close" size={15} color={colors.slate400} style={styles.tick} />
                <Text style={styles.rowText}>{line}</Text>
              </View>
            ))}

            <Text style={styles.consequence}>{t('loc.discloseDecline')}</Text>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              onPress={onDecline}
              accessibilityRole="button"
              style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}
            >
              <Text style={styles.btnGhostText}>{t('loc.discloseNotNow')}</Text>
            </Pressable>
            <Pressable
              onPress={onAccept}
              accessibilityRole="button"
              style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.pressed]}
            >
              <Text style={styles.btnPrimaryText}>{t('loc.discloseContinue')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.55)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      maxHeight: '88%',
    },
    body: { padding: 22, paddingBottom: 8 },
    badge: {
      width: 48, height: 48, borderRadius: radii.pill,
      backgroundColor: colors.brand[50],
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 14,
    },
    title: {
      fontSize: 19, fontWeight: '800', color: colors.textLight,
      letterSpacing: -0.3, marginBottom: 14,
    },
    rule: {
      backgroundColor: colors.brand[50],
      borderLeftWidth: 3, borderLeftColor: colors.brand[700],
      borderRadius: 6, padding: 13, marginBottom: 20,
    },
    ruleText: { fontSize: 14.5, lineHeight: 21, color: colors.textLight, fontWeight: '600' },
    sectionLabel: {
      fontSize: 11, fontWeight: '800', letterSpacing: 0.7,
      textTransform: 'uppercase', color: colors.slate500,
      marginTop: 8, marginBottom: 9,
    },
    row: { flexDirection: 'row', gap: 9, marginBottom: 9, alignItems: 'flex-start' },
    tick: { marginTop: 2 },
    rowText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.textLight },
    consequence: {
      fontSize: 13, lineHeight: 19, color: colors.slate500,
      marginTop: 18, paddingTop: 14,
      borderTopWidth: 1, borderTopColor: colors.slate100,
    },
    actions: {
      flexDirection: 'row', gap: 10, padding: 18, paddingTop: 12,
      borderTopWidth: 1, borderTopColor: colors.slate100,
    },
    btn: { flex: 1, paddingVertical: 14, borderRadius: radii.md, alignItems: 'center' },
    btnGhost: { backgroundColor: colors.slate100 },
    btnGhostText: { fontSize: 14.5, fontWeight: '700', color: colors.textLight },
    btnPrimary: { backgroundColor: colors.brand[700] },
    btnPrimaryText: { fontSize: 14.5, fontWeight: '800', color: colors.white },
    pressed: { opacity: 0.8 },
  });
