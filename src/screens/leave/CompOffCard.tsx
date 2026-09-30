import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card } from '../../components/ui';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { useT } from '../../i18n';
import { formatDate } from '../../utils/datetime';
import { useNationalHolidays } from '../../hooks/useNationalHolidays';
import type { LeaveSummary } from '../../api/leave.api';

/** How many upcoming national holidays to list -- the next few, not the year. */
const UPCOMING_SHOWN = 3;

/**
 * Comp off, in one place, always visible.
 *
 * It used to be a green chip that appeared only once there was something to
 * show, so somebody with none had no way to learn it existed, how to earn
 * it, or when the next chance was. The team found exactly that confusing.
 *
 * So the card always answers the three questions in order:
 *   1. what I have   -- days left, with earned / used / waiting beside it
 *   2. how I earn it -- the two rules, in words
 *   3. when I can    -- the next national holidays, with dates
 * plus which holidays earned what is already there.
 */
export function CompOffCard({ summary, onApply }: { summary?: LeaveSummary; onApply: () => void }) {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const { upcoming } = useNationalHolidays();

  const left = summary?.compOffOutstanding ?? 0;
  const earned = summary?.compOffEarned ?? 0;
  const used = summary?.compOffUsed ?? 0;
  const pending = summary?.compOffPending ?? 0;
  const earnedFrom = summary?.compOffHolidays ?? [];

  return (
    <Card>
      <View style={styles.head}>
        <View style={styles.iconWrap}>
          <Ionicons name="gift-outline" size={18} color={colors.successText} />
        </View>
        <Text style={styles.title}>{t('compOff.title')}</Text>
        {left > 0 ? (
          <Pressable onPress={onApply} hitSlop={8} accessibilityRole="button" style={({ pressed }) => [styles.use, pressed && styles.pressed]}>
            <Text style={styles.useText}>{t('compOff.use')}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.balance}>
        <Text style={[styles.big, left > 0 && styles.bigOn]}>{left}</Text>
        <View style={styles.balanceText}>
          <Text style={styles.leftLabel}>{t('compOff.leftLabel')}</Text>
          <Text style={styles.breakdown}>{t('compOff.breakdown', { earned, used, pending })}</Text>
        </View>
      </View>

      {earnedFrom.length > 0 ? (
        <Text style={styles.earnedFrom}>
          {t('leave.compOffHolidays', {
            dates: earnedFrom.map((h) => `${h.name} (${formatDate(`${String(h.date).slice(0, 10)}T00:00:00`)})`).join(', '),
          })}
        </Text>
      ) : null}

      <Text style={styles.section}>{t('compOff.howTitle')}</Text>
      <View style={styles.rule}>
        <Ionicons name="flag-outline" size={14} color={colors.slate500} style={styles.ruleIcon} />
        <Text style={styles.ruleText}>{t('compOff.howHoliday')}</Text>
      </View>
      <View style={styles.rule}>
        <Ionicons name="briefcase-outline" size={14} color={colors.slate500} style={styles.ruleIcon} />
        <Text style={styles.ruleText}>{t('compOff.howUnpaid')}</Text>
      </View>

      <Text style={styles.section}>{t('compOff.nextHolidays')}</Text>
      {upcoming.length === 0 ? (
        <Text style={styles.none}>{t('compOff.noUpcoming')}</Text>
      ) : (
        upcoming.slice(0, UPCOMING_SHOWN).map((h) => (
          <View key={h.id} style={styles.holiday}>
            <Text style={styles.holidayDate}>{formatDate(`${String(h.date).slice(0, 10)}T00:00:00`)}</Text>
            <Text style={styles.holidayName} numberOfLines={1}>{h.name}</Text>
          </View>
        ))
      )}
    </Card>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    iconWrap: {
      width: 32, height: 32, borderRadius: radii.md, backgroundColor: colors.successBg,
      alignItems: 'center', justifyContent: 'center',
    },
    title: { flex: 1, fontSize: 14, fontWeight: '800', color: colors.textLight },
    use: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.sm, backgroundColor: colors.brand[50] },
    useText: { fontSize: 11.5, fontWeight: '800', color: colors.brand[700] },
    pressed: { opacity: 0.75 },

    balance: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
    big: { fontSize: 30, fontWeight: '800', color: colors.slate400, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
    bigOn: { color: colors.successText },
    balanceText: { flex: 1 },
    leftLabel: { fontSize: 12.5, fontWeight: '800', color: colors.textLight },
    breakdown: { fontSize: 11.5, fontWeight: '600', color: colors.slate500, marginTop: 2 },
    earnedFrom: { fontSize: 11.5, lineHeight: 16, color: colors.slate500, marginTop: 8 },

    section: {
      fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3,
      color: colors.slate400, marginTop: 14, marginBottom: 6,
    },
    rule: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 5 },
    ruleIcon: { marginTop: 2 },
    ruleText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: colors.slate600 },
    none: { fontSize: 12, color: colors.slate400 },
    holiday: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 7, borderTopWidth: 1, borderTopColor: colors.slate100,
    },
    holidayDate: { width: 92, fontSize: 12, fontWeight: '800', color: colors.textLight, fontVariant: ['tabular-nums'] },
    holidayName: { flex: 1, fontSize: 12.5, fontWeight: '600', color: colors.slate600 },
  });
