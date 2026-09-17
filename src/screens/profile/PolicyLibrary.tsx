import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { getPolicies, type Policy as PolicyType } from '../../api/policies.api';
import { Card } from '../../components/ui';
import { newestFirst } from '../../utils/datetime';
import { ColorScheme } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { useT } from '../../i18n';

/**
 * Every policy, newest first, each a row that opens the reader. It used to
 * show the first six on the long Profile page; on a screen of its own there
 * is no reason to hide the seventh.
 */
export function PolicyLibrary({ onOpen }: { onOpen: (p: PolicyType) => void }) {
  const { data } = useQuery({ queryKey: ['policies-library'], queryFn: () => getPolicies(50) });
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const items = newestFirst(data?.items ?? [], 'publishedAt', 'updatedAt', 'createdAt');
  if (items.length === 0) return null;

  const signed = items.filter((p) => p.acknowledgedByMe).length;
  return (
    <Card>
      <Text style={styles.cardTitle}>{t('profile.policies')}</Text>
      <Text style={styles.policySummary}>
        {t('policy.summary', { total: items.length, signed })}
      </Text>
      {items.map((p, i) => (
        <Pressable
          key={p.id}
          onPress={() => onOpen(p)}
          accessibilityRole="button"
          accessibilityLabel={p.title}
          accessibilityHint={t('policy.tapToRead')}
          style={({ pressed }) => [
            styles.row,
            i === items.length - 1 && styles.rowLast,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Ionicons
            name={p.acknowledgedByMe ? 'checkmark-circle' : 'ellipse-outline'}
            size={16}
            color={p.acknowledgedByMe ? colors.success : colors.slate300}
            style={styles.rowIcon}
          />
          <Text style={styles.rowLabel} numberOfLines={1}>
            {p.title}
          </Text>
          <Text style={styles.rowValue}>v{p.version}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.slate300} style={{ marginLeft: 6 }} />
        </Pressable>
      ))}
    </Card>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    cardTitle: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: colors.slate500, marginBottom: 4 },
    row: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: colors.slate100,
    },
    rowLast: { borderBottomWidth: 0 },
    rowIcon: { marginRight: 8 },
    rowLabel: { flex: 1, fontSize: 11, fontWeight: '600', color: colors.slate500 },
    rowValue: { fontSize: 11.5, fontWeight: '700', color: colors.textLight },
    policySummary: { fontSize: 11, color: colors.slate400, fontWeight: '600', marginBottom: 6 },
  });
}
