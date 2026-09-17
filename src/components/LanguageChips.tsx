import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ColorScheme, radii } from '../theme/tokens';
import { useThemeStore } from '../stores/themeStore';
import { LANGUAGES, usePreferencesStore, type LanguageCode } from '../stores/preferencesStore';

/**
 * The language, as one row of chips -- for the screens a person meets
 * BEFORE they can reach Profile.
 *
 * The full picker lives under Profile › Language, which a new employee only
 * finds after signing in, setting a password and getting through onboarding,
 * all of it in English. So the choice is offered where it is first needed:
 * on the sign-in screen and on the first-sign-in password screen. The names
 * are in their own script, because somebody looking for Tamil is looking for
 * தமிழ், not the word "Tamil". Picking one changes the whole app at once and
 * is remembered, exactly as the Profile picker does.
 */
export function LanguageChips() {
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const language = usePreferencesStore((s) => s.language);
  const setLanguage = usePreferencesStore((s) => s.setLanguage);

  return (
    <View style={styles.row}>
      <Ionicons name="language-outline" size={16} color={colors.slate500} style={styles.icon} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
        {LANGUAGES.map((l) => {
          const on = language === l.code;
          return (
            <Pressable
              key={l.code}
              onPress={() => setLanguage(l.code as LanguageCode)}
              style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={l.label}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{l.native}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    icon: { marginLeft: 2 },
    chips: { gap: 6, paddingRight: 8 },
    chip: {
      paddingHorizontal: 11, paddingVertical: 6, borderRadius: radii.pill,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.slate200,
    },
    chipOn: { backgroundColor: colors.brand[700], borderColor: colors.brand[700] },
    pressed: { opacity: 0.7 },
    chipText: { fontSize: 12.5, fontWeight: '700', color: colors.slate600 },
    chipTextOn: { color: colors.white },
  });
