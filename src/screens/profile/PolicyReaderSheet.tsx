import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { getApiErrorMessage } from '../../api/client';
import { acknowledgePolicy, type Policy } from '../../api/policies.api';
import { Button } from '../../components/ui';
import { formatDate } from '../../utils/datetime';
import { useT } from '../../i18n';

/**
 * Read a company policy, and acknowledge it here.
 *
 * The profile list used to show a policy's title and nothing else — a row you
 * could see but not open. This is what a tap on it now leads to: the summary
 * the policy carries (which for a text policy IS the document), its version and
 * effective date, whether it still needs your signature, and the button to give
 * it. A policy that also has an attached file says so; the file itself is read
 * in the web console, since a signed-URL PDF viewer is a heavier thing than a
 * field phone needs to acknowledge a policy.
 */
export function PolicyReaderSheet({ policy, onClose }: { policy: Policy | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const t = useT();

  const ack = useMutation({
    mutationFn: (id: string) => acknowledgePolicy(id),
    onSuccess: () => {
      // Both the profile library and the home "to acknowledge" card read this.
      queryClient.invalidateQueries({ queryKey: ['policies-library'] });
      queryClient.invalidateQueries({ queryKey: ['policies-outstanding'] });
      onClose();
    },
  });

  const visible = policy !== null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        {policy ? (
          <>
            <View style={styles.header}>
              <View style={styles.headerText}>
                {policy.category ? <Text style={styles.category}>{policy.category}</Text> : null}
                <Text style={styles.title}>{policy.title}</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
                <Ionicons name="close" size={22} color={colors.slate500} />
              </Pressable>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>{t('policy.version')} {policy.version}</Text>
              </View>
              {policy.effectiveFrom ? (
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>{t('policy.effectiveFrom')} {formatDate(policy.effectiveFrom)}</Text>
                </View>
              ) : null}
              {policy.acknowledgedByMe ? (
                <View style={[styles.metaPill, styles.metaPillDone]}>
                  <Ionicons name="checkmark-circle" size={12} color={colors.successText} />
                  <Text style={[styles.metaPillText, styles.metaPillTextDone]}>{t('policy.acknowledged')}</Text>
                </View>
              ) : null}
            </View>

            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
              <Text style={styles.summary}>{policy.summary?.trim() || t('policy.noSummary')}</Text>

              {policy.hasFile ? (
                <View style={styles.attachment}>
                  <Ionicons name="document-attach-outline" size={16} color={colors.brand[700]} />
                  <Text style={styles.attachmentText} numberOfLines={1}>
                    {policy.fileName || t('policy.attachment')}
                  </Text>
                </View>
              ) : null}
            </ScrollView>

            {ack.isError ? <Text style={styles.error}>{getApiErrorMessage(ack.error)}</Text> : null}

            {policy.requiresAck && !policy.acknowledgedByMe ? (
              <Button
                title={ack.isPending ? t('common.saving') : t('policy.acknowledge')}
                onPress={() => ack.mutate(policy.id)}
                disabled={ack.isPending}
              />
            ) : null}
          </>
        ) : null}
      </View>
    </Modal>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    backdrop: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15,23,42,0.35)',
    },
    sheet: {
      position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '82%',
      backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
      paddingHorizontal: 20, paddingTop: 18,
    },
    header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
    headerText: { flex: 1 },
    category: {
      fontSize: 10, fontWeight: '800', color: colors.brand[700],
      letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4,
    },
    title: { fontSize: 16, fontWeight: '800', color: colors.textLight, letterSpacing: -0.2 },

    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    metaPill: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: colors.slate100, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill,
    },
    metaPillDone: { backgroundColor: colors.successBg },
    metaPillText: { fontSize: 11, fontWeight: '700', color: colors.slate600 },
    metaPillTextDone: { color: colors.successText },

    body: { marginTop: 16, maxHeight: 360 },
    bodyContent: { paddingBottom: 8 },
    summary: { fontSize: 13, lineHeight: 21, color: colors.textLight },

    attachment: {
      flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16,
      backgroundColor: colors.brand[50], padding: 12, borderRadius: radii.md,
    },
    attachmentText: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.brand[700] },

    error: { color: colors.dangerText, fontSize: 12, fontWeight: '600', marginTop: 12, marginBottom: 4 },
  });
}
