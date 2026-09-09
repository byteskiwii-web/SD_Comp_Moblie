import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../components/ui';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { BADGE_LABEL, getMyKudos } from '../../api/kudos.api';
import { SkeletonRows } from '../../components/Skeleton';

/**
 * Kudos received, newest first.
 *
 * There is no lifecycle on this resource — no pending, no decision, nothing to
 * accept or dismiss — so this is a feed and nothing more. The card hides itself
 * entirely when empty rather than showing a "no appreciation yet" placeholder,
 * which reads as an accusation.
 */
export function AppreciationCard() {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data, isLoading, error } = useQuery({
    queryKey: ['kudos-mine'],
    queryFn: () => getMyKudos(5),
  });

  const items = data?.items ?? [];
  if (isLoading) {
    return (
      <Card>
        <Text style={styles.title}>Appreciation</Text>
        <SkeletonRows count={2} />
      </Card>
    );
  }
  // A feed nobody has written to yet, or one the server would not give us, are
  // both nothing to show. Neither is worth a slot on the home screen.
  if (error || items.length === 0) return null;

  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.title}>Appreciation</Text>
        {data && data.total > items.length ? (
          <Text style={styles.count}>{data.total}</Text>
        ) : null}
      </View>

      {items.map((k, i) => (
        <View key={k.id} style={[styles.row, i === items.length - 1 && styles.rowLast]}>
          <View style={styles.badgeIcon}>
            <Ionicons name="trophy-outline" size={15} color={colors.warningText} />
          </View>
          <View style={styles.body}>
            <View style={styles.topLine}>
              <Text style={styles.badge}>{BADGE_LABEL[k.badge] ?? k.badge}</Text>
              <Text style={styles.date}>
                {new Date(k.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
              </Text>
            </View>
            {k.message ? <Text style={styles.message}>“{k.message}”</Text> : null}
            <Text style={styles.from}>— {k.fromName}</Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: {
      fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4,
      color: colors.slate500, marginBottom: 4,
    },
    count: { fontSize: 11, fontWeight: '800', color: colors.slate400 },
    spacer: { marginVertical: 12 },

    row: {
      flexDirection: 'row', gap: 10, paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: colors.slate100,
    },
    rowLast: { borderBottomWidth: 0 },
    badgeIcon: {
      width: 30, height: 30, borderRadius: 15, backgroundColor: colors.warningBg,
      alignItems: 'center', justifyContent: 'center',
    },
    body: { flex: 1 },
    topLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    badge: { fontSize: 11.5, fontWeight: '800', color: colors.accentViolet },
    date: { fontSize: 11, color: colors.slate400, fontWeight: '600' },
    message: { fontSize: 11.5, color: colors.slate600, marginTop: 3, lineHeight: 18 },
    from: { fontSize: 10.5, color: colors.slate400, marginTop: 3, fontWeight: '600' },
  });
}
