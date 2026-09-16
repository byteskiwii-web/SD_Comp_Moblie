import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card } from '../../components/ui';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { getApiErrorMessage } from '../../api/client';
import { acknowledgePolicy, getOutstandingPolicies, type Policy } from '../../api/policies.api';
import { PolicyReaderSheet } from '../profile/PolicyReaderSheet';
import { formatDate } from '../../utils/datetime';
import { useT } from '../../i18n';

/**
 * Acknowledge every outstanding policy before the app opens.
 *
 * Shown by RootNavigator INSTEAD of the app, not on top of it — an obligation
 * you can swipe away is not mandatory. There is deliberately no skip, no
 * dismiss and no back gesture out of it; the only way past is to sign, and
 * that is the point.
 *
 * WHAT IS RECORDED is not just a boolean. policy_acknowledgement stores the
 * version signed, the timestamp, the IP and the user agent, so the org can
 * later show WHICH text somebody agreed to and when. That is why a republished
 * policy asks again: the previous signature was for different words.
 *
 * Each policy must be OPENED before it can be signed. A single "I accept all"
 * button over unread documents produces a record that would embarrass anybody
 * asked to defend it.
 */
export function AcceptPoliciesScreen() {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const t = useT();

  const [reading, setReading] = useState<Policy | null>(null);
  /**
   * Policies that have actually been READ on this screen — for a text policy,
   * opening the sheet; for one with a file, opening the file. The sheet reports
   * the second, because the card cannot see whether it happened.
   */
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const markOpened = (id: string) => setOpened((prev) => new Set(prev).add(id));
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['policies-outstanding'],
    queryFn: getOutstandingPolicies,
  });

  const policies = data?.policies ?? [];

  const ack = useMutation({
    mutationFn: (id: string) => acknowledgePolicy(id),
    onSuccess: () => {
      setError(null);
      // Refetching is what re-opens the gate check: when the list empties,
      // usePolicyAcceptanceGate settles on "not required" and the app appears.
      queryClient.invalidateQueries({ queryKey: ['policies-outstanding'] });
      queryClient.invalidateQueries({ queryKey: ['policies-library'] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const open = (p: Policy) => {
    // A file policy is not read by opening the sheet; the sheet says when.
    if (!p.hasFile) markOpened(p.id);
    setReading(p);
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.icon}>
            <Ionicons name="document-text-outline" size={24} color={colors.brand[700]} />
          </View>
          <Text style={styles.title}>{t('policyGate.title')}</Text>
          <Text style={styles.subtitle}>{t('policyGate.body', { count: policies.length })}</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {isLoading ? (
          <Card><Text style={styles.muted}>{t('common.loading')}</Text></Card>
        ) : (
          policies.map((p) => {
            const hasRead = opened.has(p.id);
            return (
              <Card key={p.id}>
                <Pressable onPress={() => open(p)} accessibilityRole="button">
                  <View style={styles.row}>
                    <View style={styles.rowText}>
                      {p.category ? <Text style={styles.category}>{p.category}</Text> : null}
                      <Text style={styles.policyTitle}>{p.title}</Text>
                      <Text style={styles.meta}>
                        {t('policy.version')} {p.version}
                        {p.effectiveFrom ? ` · ${t('policy.effectiveFrom')} ${formatDate(p.effectiveFrom)}` : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.slate400} />
                  </View>
                </Pressable>

                {/* Signing is gated on having opened it. A blanket accept over
                    unread text is a record nobody could defend. */}
                <Button
                  title={hasRead ? t('policy.acknowledge') : t('policyGate.readFirst')}
                  variant={hasRead ? 'primary' : 'outline'}
                  disabled={!hasRead || ack.isPending}
                  onPress={() => (hasRead ? ack.mutate(p.id) : open(p))}
                />
              </Card>
            );
          })
        )}

        <Text style={styles.footnote}>{t('policyGate.footnote')}</Text>
      </ScrollView>

      <PolicyReaderSheet policy={reading} onClose={() => setReading(null)} onFileOpened={markOpened} />
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.bgLight },
    content: { padding: 20, gap: 14, paddingBottom: 40 },
    header: { alignItems: 'center', paddingTop: 16, paddingBottom: 6 },
    icon: {
      width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brand[50],
      alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    },
    title: { fontSize: 19, fontWeight: '800', color: colors.textLight, textAlign: 'center' },
    subtitle: {
      fontSize: 12.5, color: colors.slate500, textAlign: 'center',
      marginTop: 6, lineHeight: 19, paddingHorizontal: 8,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    rowText: { flex: 1 },
    category: {
      fontSize: 10, fontWeight: '800', color: colors.brand[700],
      letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 3,
    },
    policyTitle: { fontSize: 14, fontWeight: '800', color: colors.textLight },
    meta: { fontSize: 11, color: colors.slate500, marginTop: 3 },
    muted: { fontSize: 12.5, color: colors.slate500 },
    error: { color: colors.dangerText, fontSize: 12, fontWeight: '600', textAlign: 'center' },
    footnote: {
      fontSize: 11, color: colors.slate400, textAlign: 'center',
      lineHeight: 17, marginTop: 4, paddingHorizontal: 12,
    },
  });
}
