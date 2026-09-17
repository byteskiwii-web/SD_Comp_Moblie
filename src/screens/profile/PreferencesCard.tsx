import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card } from '../../components/ui';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { LANGUAGES, usePreferencesStore, type LanguageCode } from '../../stores/preferencesStore';
import { useT } from '../../i18n';

/**
 * Display preferences: the app's language. (Times are always 12-hour.)
 *
 * Both are on-device settings rather than profile fields, because neither is a
 * fact about the employee that HR or payroll has any use for — they are how
 * this person wants to read this app on this phone.
 *
 * LANGUAGE CHANGES THE WHOLE APP. Every label goes through the catalogues in
 * src/i18n, and the choice also travels as an Accept-Language header, so
 * server messages — validation errors, refusals, notification text — arrive in
 * the same language. This card used to carry a note admitting the app's own
 * labels were still English; that note is gone because the thing it apologised
 * for is fixed.
 */
export function PreferencesCard() {
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  const language = usePreferencesStore((s) => s.language);
  const setLanguage = usePreferencesStore((s) => s.setLanguage);

  return (
    <Card>
      <Text style={styles.cardTitle}>{t('prefs.title')}</Text>

      <Text style={styles.label}>{t('prefs.language')}</Text>
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
          {t('prefs.languageNote')}
        </Text>
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


  });
