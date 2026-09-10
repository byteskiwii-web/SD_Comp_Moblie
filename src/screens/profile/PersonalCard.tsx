import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { Card } from '../../components/ui';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { getApiErrorMessage } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { GENDERS, updateMyProfile, type Gender } from '../../api/auth.api';
import { useT, type TKey } from '../../i18n';

/**
 * Personal details the employee maintains about themselves.
 *
 * Gender is here rather than in Contact & assignment because that card is a
 * read-only summary of what HR assigned — site, geo-fence, shift — and this is
 * the employee's own to state. Same chip pattern as shirt size, since both are
 * one choice from a short closed set.
 *
 * "Prefer not to say" is an option and not an omission. It writes
 * `undisclosed`, which is a different fact from the field being empty: empty
 * means nobody has asked yet, and treating an unanswered record as a
 * declination would put words in somebody's mouth.
 */
export function PersonalCard() {
  const profile = useAuthStore((s) => s.profile);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (gender: Gender) => updateMyProfile({ gender }),
    onSuccess: async () => {
      setError(null);
      // Re-read rather than assume: HR may have corrected it meanwhile.
      await refreshProfile();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const current = profile?.gender ?? null;

  return (
    <Card>
      <Text style={styles.cardTitle}>{t('personal.title')}</Text>

      <Text style={styles.label}>{t('personal.gender')}</Text>
      <View style={styles.options}>
        {GENDERS.map((g) => {
          const selected = current === g;
          return (
            <Pressable
              key={g}
              onPress={() => save.mutate(g)}
              disabled={save.isPending}
              style={({ pressed }) => [
                styles.option,
                selected && styles.optionOn,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.optionText, selected && styles.optionTextOn]}>
                {t(('gender.' + g) as TKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.hint}>
        {current ? t('personal.changeHint') : t('personal.genderNote')}
      </Text>
    </Card>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    cardTitle: {
      fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4,
      color: colors.slate500, marginBottom: 10,
    },
    label: {
      fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3,
      color: colors.slate400, marginBottom: 8,
    },
    options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    option: {
      paddingHorizontal: 13, paddingVertical: 9, borderRadius: radii.sm,
      borderWidth: 1.5, borderColor: colors.slate200, backgroundColor: colors.surface,
    },
    optionOn: { borderColor: colors.brand[700], backgroundColor: colors.brand[50] },
    pressed: { opacity: 0.75 },
    optionText: { fontSize: 12.5, fontWeight: '800', color: colors.slate600 },
    optionTextOn: { color: colors.brand[700] },
    error: { fontSize: 11.5, color: colors.danger, fontWeight: '600', marginTop: 8 },
    hint: { fontSize: 11, color: colors.slate400, marginTop: 8, fontWeight: '600' },
  });
