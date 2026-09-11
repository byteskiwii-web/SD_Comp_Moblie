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
 *
 * Gender is set ONCE and then locked, the same policy shirt size already
 * follows (see KitCard's shirtSizeLocked) -- it is meant to be captured at
 * onboarding, not something to browse and re-pick from Profile later. There
 * is no server-side genderLocked flag yet (unlike shirt size), so this is a
 * client-only lock for now: once a value has been read back from the server
 * the picker stops being interactive. A correction still routes through HR,
 * same as any other onboarding-time fact nobody but HR may overwrite.
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
  const locked = current !== null;

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
              disabled={save.isPending || locked}
              style={({ pressed }) => [
                styles.option,
                selected && styles.optionOn,
                locked && !selected && styles.optionLocked,
                pressed && !locked && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: locked }}
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
        {locked ? t('personal.genderLocked') : t('personal.genderNote')}
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
    optionLocked: { opacity: 0.45 },
    pressed: { opacity: 0.75 },
    optionText: { fontSize: 12.5, fontWeight: '800', color: colors.slate600 },
    optionTextOn: { color: colors.brand[700] },
    error: { fontSize: 11.5, color: colors.danger, fontWeight: '600', marginTop: 8 },
    hint: { fontSize: 11, color: colors.slate400, marginTop: 8, fontWeight: '600' },
  });
