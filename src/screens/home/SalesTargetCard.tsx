import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../components/ui';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import { getMyTarget } from '../../api/auth.api';
import { formatDate } from '../../utils/datetime';
import { useT } from '../../i18n';

/** ₹1,60,000 — Indian grouping, no paise. Matches the console's fmtINR. */
function inr(n: number): string {
  const s = String(Math.round(Math.abs(n)));
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  return `${n < 0 ? '-' : ''}₹${grouped}`;
}

/**
 * This month's sales target, and how far along it is.
 *
 * NOT SHOWN AT ALL when no target is filed. An employee whose admin has not
 * set one is not behind, and an empty card saying "₹0" would tell them they
 * are. The whole card is absent until there is something true to put in it.
 *
 * THE BAR ONLY APPEARS ONCE A SALES FIGURE HAS BEEN UPLOADED, and it carries
 * the date that figure was uploaded. If sales arrive monthly, a bar presented
 * as live is a report three weeks stale — and "you are at 20%" read off one is
 * a judgement about somebody's work drawn from a number nobody has refreshed.
 * With no figure, the card shows the target alone and says so plainly.
 *
 * No "on track" badge for the same reason. The prototype's version compares
 * sales against the fraction of the month elapsed, which is only honest when
 * the sales figure is current; until uploads are frequent enough to know that,
 * the app reports and does not judge.
 */
export function SalesTargetCard() {
  const employee = useAuthStore((s) => s.employee);
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  const { data, isError } = useQuery({
    queryKey: ['sales-target', employee?.id],
    queryFn: () => getMyTarget(),
    enabled: !!employee,
    retry: false,
  });

  // Nothing filed, or the request failed: say nothing rather than guess.
  if (isError || !data) return null;

  const pct = data.percent;
  const hasFigure = data.achievedAmount !== null && pct !== null;

  return (
    <Card>
      <View style={styles.headRow}>
        <Text style={styles.label}>{t('target.title')}</Text>
        {hasFigure ? <Text style={styles.pct}>{pct}%</Text> : null}
      </View>

      <View style={styles.amountRow}>
        {hasFigure ? (
          <>
            <Text style={styles.achieved}>{inr(data.achievedAmount!)}</Text>
            <Text style={styles.of}>{t('target.of', { target: inr(data.targetAmount) })}</Text>
          </>
        ) : (
          <Text style={styles.achieved}>{inr(data.targetAmount)}</Text>
        )}
      </View>

      {hasFigure ? (
        <>
          <View style={styles.bar}>
            <View
              style={[
                styles.barFill,
                { width: `${Math.max(2, pct!)}%` },
                pct! >= 100 ? styles.barDone : pct! >= 60 ? styles.barOn : styles.barBehind,
              ]}
            />
          </View>
          {/* The date is not decoration: it is what stops a monthly upload
              being read as today's position. */}
          <Text style={styles.asOf}>{t('target.asOf', { date: formatDate(data.achievedAt ?? '') })}</Text>
        </>
      ) : (
        <Text style={styles.asOf}>{t('target.noSales')}</Text>
      )}
    </Card>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    label: {
      fontSize: 11, fontWeight: '800', color: colors.slate500,
      textTransform: 'uppercase', letterSpacing: 0.4,
    },
    pct: { fontSize: 13, fontWeight: '800', color: colors.brand[700] },
    amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 8 },
    achieved: { fontSize: 22, fontWeight: '800', color: colors.textLight, letterSpacing: -0.4 },
    of: { fontSize: 12, fontWeight: '600', color: colors.slate500 },
    bar: { height: 7, borderRadius: 4, backgroundColor: colors.slate100, marginTop: 12, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 4 },
    barBehind: { backgroundColor: colors.warning },
    barOn: { backgroundColor: colors.brand[700] },
    barDone: { backgroundColor: colors.success },
    asOf: { fontSize: 11, color: colors.slate400, fontWeight: '600', marginTop: 8 },
  });
}
