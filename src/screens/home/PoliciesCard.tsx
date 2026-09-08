import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../components/ui';
import { colors, radii } from '../../theme/tokens';
import { getApiErrorMessage } from '../../api/client';
import { acknowledgePolicy, getOutstandingPolicies } from '../../api/policies.api';

/**
 * Policies the employee still has to acknowledge.
 *
 * Asks the endpoint built for exactly this rather than pulling the library and
 * filtering on the device, and acknowledges inline: the whole interaction is
 * one button, so routing to a detail screen to press it would be ceremony.
 *
 * Acknowledgement is per VERSION — a republished policy comes back needing a
 * second signature, which is the point of the feature.
 */
export function PoliciesCard() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['policies-outstanding'],
    queryFn: getOutstandingPolicies,
  });

  const ack = useMutation({
    mutationFn: acknowledgePolicy,
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['policies-outstanding'] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const policies = data?.policies ?? [];
  // Nothing outstanding is the normal state. Saying so every day would train
  // people to ignore the card on the day it does matter.
  if (policies.length === 0) return null;

  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.title}>Policies to acknowledge</Text>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{data?.count ?? policies.length}</Text>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {policies.map((p, i) => (
        <View key={p.id} style={[styles.row, i === policies.length - 1 && styles.rowLast]}>
          <View style={styles.icon}>
            <Ionicons name="document-text-outline" size={15} color={colors.brand[700]} />
          </View>
          <View style={styles.body}>
            <Text style={styles.name}>{p.title}</Text>
            {p.summary ? (
              <Text style={styles.summary} numberOfLines={2}>
                {p.summary}
              </Text>
            ) : null}
            <Text style={styles.meta}>
              v{p.version}
              {p.category ? ` · ${p.category}` : ''}
            </Text>
          </View>
          <Pressable
            onPress={() => ack.mutate(p.id)}
            disabled={ack.isPending}
            style={({ pressed }) => [styles.ackButton, pressed && styles.ackPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Acknowledge ${p.title}`}
          >
            <Text style={styles.ackText}>Acknowledge</Text>
          </Pressable>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title: {
    fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4,
    color: colors.slate500,
  },
  pill: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6,
    backgroundColor: colors.warning, alignItems: 'center', justifyContent: 'center',
  },
  pillText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  error: { color: colors.danger, fontSize: 11, fontWeight: '600', paddingVertical: 6 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: colors.slate100,
  },
  rowLast: { borderBottomWidth: 0 },
  icon: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brand[50],
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1 },
  name: { fontSize: 12, fontWeight: '800', color: colors.textLight },
  summary: { fontSize: 11, color: colors.slate500, marginTop: 2, lineHeight: 16 },
  meta: { fontSize: 11, color: colors.slate400, marginTop: 3, fontWeight: '600' },

  ackButton: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.sm,
    backgroundColor: colors.brand[700],
  },
  ackPressed: { opacity: 0.85 },
  ackText: { color: colors.white, fontSize: 11, fontWeight: '800' },
});
