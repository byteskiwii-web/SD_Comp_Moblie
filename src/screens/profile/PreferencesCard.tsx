import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card } from '../../components/ui';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { LANGUAGES, usePreferencesStore, type ClockFormat, type LanguageCode } from '../../stores/preferencesStore';

/**
 * Display preferences: language and clock.
 *
 * Both are on-device settings rather than profile fields, because neither is a
 * fact about the employee that HR or payroll has any use for — they are how
 * this person wants to read this app on this phone.
 *
 * LANGUAGE IS HONEST ABOUT WHAT IT DOES TODAY. The backend serves six locales
 * and this sends the choice with every request, so server messages — validation
 * errors, refusals, notification text — come back translated. The app's own
 * labels are still English, because the mobile app has no i18n layer yet. The
 * card says so rather than letting somebody pick Tamil and conclude the
 * feature is broken.
 */
export function PreferencesCard() {
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  const language = usePreferencesStore((s) => s.language);
  const setLanguage = usePreferencesStore((s) => s.setLanguage);
  const clock = usePreferencesStore((s) => s.clock);
  const setClock = usePreferencesStore((s) => s.setClock);

  return (
    <Card>
      <Text style={styles.cardTitle}>Preferences</Text>

      <Text style={styles.label}>Language</Text>
      <View style={styles.langs}>
        {LANGUAGES.map((l) => {
          const on = language === l.code;
          return (
            <Pressable
              key={l.code}
              onPress={() => setLanguage(l.code as LanguageCode)}
              style={({ pressed }) => [styles.lang, on && styles.langOn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={l.label}
            >
              {/* The name in its own script, because somebody looking for
                  Tamil is looking for தமிழ், not for the word "Tamil". */}
              <Text style={[styles.langNative, on && styles.langTextOn]}>{l.native}</Text>
              <Text style={[styles.langLabel, on && styles.langTextOn]}>{l.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={13} color={colors.slate400} />
        <Text style={styles.noteText}>
          Messages from the server use this language now. The app's own labels are still being
          translated.
        </Text>
      </View>

      <View style={styles.divider} />

      <Text style={styles.label}>Time format</Text>
      <View style={styles.segment}>
        {(['12h', '24h'] as ClockFormat[]).map((c) => {
          const on = clock === c;
          return (
            <Pressable
              key={c}
              onPress={() => setClock(c)}
              style={[styles.segmentItem, on && styles.segmentItemOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.segmentText, on && styles.segmentTextOn]}>
                {c === '12h' ? '12-hour' : '24-hour'}
              </Text>
              {/* A worked example, because "12-hour" and "24-hour" are jargon
                  and the sample is the thing people actually recognise. */}
              <Text style={[styles.segmentEg, on && styles.segmentTextOn]}>
                {c === '12h' ? '5:30 PM' : '17:30'}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    cardTitle: {
      fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4,
      color: colors.slate500, marginBottom: 12,
    },
    label: {
      fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3,
      color: colors.slate400, marginBottom: 8,
    },

    langs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    lang: {
      paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.sm,
      borderWidth: 1.5, borderColor: colors.slate200, backgroundColor: colors.surface,
      minWidth: 84,
    },
    langOn: { borderColor: colors.brand[700], backgroundColor: colors.brand[50] },
    pressed: { opacity: 0.75 },
    langNative: { fontSize: 13.5, fontWeight: '800', color: colors.textLight },
    langLabel: { fontSize: 10, fontWeight: '600', color: colors.slate400, marginTop: 2 },
    langTextOn: { color: colors.brand[700] },

    note: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10 },
    noteText: { flex: 1, fontSize: 10.5, color: colors.slate400, lineHeight: 15 },

    divider: { height: 1, backgroundColor: colors.slate100, marginVertical: 16 },

    segment: { flexDirection: 'row', backgroundColor: colors.slate100, borderRadius: radii.md, padding: 4, gap: 4 },
    segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radii.sm },
    segmentItemOn: { backgroundColor: colors.surface },
    segmentText: { fontSize: 12.5, fontWeight: '800', color: colors.slate500 },
    segmentTextOn: { color: colors.brand[700] },
    segmentEg: { fontSize: 10.5, fontWeight: '600', color: colors.slate400, marginTop: 2 },
  });
