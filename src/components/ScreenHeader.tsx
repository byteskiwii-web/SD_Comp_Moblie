import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { ColorScheme, radii } from '../theme/tokens';
import { useThemeStore } from '../stores/themeStore';
import { useT } from '../i18n';

/**
 * The bar every pushed screen wears.
 *
 * It exists because several screens drew their own centred title and no back
 * control at all. iOS still allows the edge-swipe, so those screens were not
 * literally inescapable — but a gesture nobody is told about is not a way out,
 * and on Android the hardware button is the only route. A person who cannot
 * see how to leave a form assumes they have to finish it.
 *
 * `onBack` exists for screens that must do something before leaving — discard
 * a draft, cancel an in-flight capture. Everything else gets goBack, and the
 * control disappears entirely when there is nothing to go back TO, so a root
 * tab screen using this does not grow a chevron that would pop the tab.
 */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /** Trailing control — a history icon, an action. Balances the chevron. */
  right?: React.ReactNode;
}) {
  const navigation = useNavigation<any>();
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  const canGoBack = typeof navigation?.canGoBack === 'function' ? navigation.canGoBack() : false;
  const showBack = Boolean(onBack) || canGoBack;

  return (
    <View style={styles.bar}>
      {showBack ? (
        <Pressable
          onPress={() => (onBack ? onBack() : navigation.goBack())}
          // Generous, because a 26px glyph is a small target and this is the
          // control somebody reaches for when they feel stuck.
          hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('common.goBack')}
        >
          <Ionicons name="chevron-back" size={22} color={colors.brand[700]} />
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}

      <View style={styles.titleWrap} pointerEvents="none">
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {/* Mirrors the leading control's width so the title stays optically
          centred whether or not there is a trailing one. */}
      <View style={styles.right}>{right ?? null}</View>
    </View>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.slate200,
    },
    back: { flexDirection: 'row', alignItems: 'center', gap: 1, minWidth: 72 },
    backText: { fontSize: 14, fontWeight: '700', color: colors.brand[700] },
    pressed: { opacity: 0.6 },
    spacer: { minWidth: 72 },
    titleWrap: { flex: 1, alignItems: 'center' },
    title: { fontSize: 15, fontWeight: '800', color: colors.textLight, letterSpacing: -0.2 },
    subtitle: { fontSize: 10.5, color: colors.slate400, fontWeight: '600', marginTop: 1 },
    right: { minWidth: 72, alignItems: 'flex-end' },
  });

/** Matches the header's own radius vocabulary for screens that need it. */
export const screenHeaderRadius = radii.md;
