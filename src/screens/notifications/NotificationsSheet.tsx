import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, radii } from '../../theme/tokens';
import { getApiErrorMessage } from '../../api/client';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
  type NotificationType,
} from '../../api/notifications.api';
import { SkeletonRows } from '../../components/Skeleton';

/** Per-kind icon and tint. `system` is the fallback for anything unrecognised. */
const KIND: Record<NotificationType, { icon: keyof typeof Ionicons.glyphMap; tint: string; bg: string }> = {
  regularisation: { icon: 'create-outline', tint: colors.brand[700], bg: colors.brand[50] },
  kudos: { icon: 'trophy-outline', tint: '#B45309', bg: colors.warningBg },
  policy: { icon: 'document-text-outline', tint: colors.slate600, bg: colors.slate100 },
  onboarding: { icon: 'person-add-outline', tint: '#047857', bg: colors.successBg },
  system: { icon: 'information-circle-outline', tint: colors.slate600, bg: colors.slate100 },
};

function relative(iso: string) {
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function NotificationsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications({ limit: 30 }),
    enabled: visible,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
  };

  const readOne = useMutation({ mutationFn: markNotificationRead, onSuccess: invalidate });
  const readAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: invalidate });

  const items = data?.notifications ?? [];
  const unread = items.filter((n) => !n.isRead).length;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Notifications</Text>
          <View style={styles.headerActions}>
            {unread > 0 && (
              <Pressable onPress={() => readAll.mutate()} hitSlop={6} disabled={readAll.isPending}>
                <Text style={styles.markAll}>Mark all read</Text>
              </Pressable>
            )}
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.slate500} />
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <SkeletonRows count={4} />
          ) : error ? (
            <Text style={styles.error}>{getApiErrorMessage(error)}</Text>
          ) : items.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={26} color={colors.slate300} />
              <Text style={styles.emptyTitle}>Nothing yet</Text>
              <Text style={styles.emptyBody}>
                You'll be told here when a manager decides one of your attendance corrections.
              </Text>
            </View>
          ) : (
            items.map((n) => <Row key={n.id} n={n} onRead={() => readOne.mutate(n.id)} />)
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Row({ n, onRead }: { n: AppNotification; onRead: () => void }) {
  const kind = KIND[n.type] ?? KIND.system;
  return (
    <Pressable
      onPress={() => !n.isRead && onRead()}
      style={({ pressed }) => [styles.row, !n.isRead && styles.rowUnread, pressed && styles.rowPressed]}
    >
      <View style={[styles.icon, { backgroundColor: kind.bg }]}>
        <Ionicons name={kind.icon} size={16} color={kind.tint} />
      </View>
      <View style={styles.rowText}>
        {n.title ? <Text style={styles.rowTitle}>{n.title}</Text> : null}
        <Text style={styles.rowBody}>{n.body}</Text>
        <Text style={styles.rowTime}>{relative(n.createdAt)}</Text>
      </View>
      {!n.isRead && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.35)',
  },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '78%',
    backgroundColor: colors.white, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: colors.slate100,
  },
  title: { fontSize: 15, fontWeight: '800', color: colors.textLight, letterSpacing: -0.2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  markAll: { fontSize: 11.5, fontWeight: '700', color: colors.brand[700] },

  list: { paddingHorizontal: 12, paddingVertical: 8 },
  spacer: { marginVertical: 24 },
  error: { color: colors.danger, fontSize: 11.5, fontWeight: '600', padding: 20, textAlign: 'center' },

  empty: { alignItems: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 13, fontWeight: '800', color: colors.slate600 },
  emptyBody: { fontSize: 11.5, color: colors.slate400, textAlign: 'center', lineHeight: 18 },

  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12, borderRadius: radii.md },
  rowUnread: { backgroundColor: colors.slate50 },
  rowPressed: { opacity: 0.7 },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 12, fontWeight: '800', color: colors.textLight },
  rowBody: { fontSize: 11.5, color: colors.slate600, marginTop: 2, lineHeight: 18 },
  rowTime: { fontSize: 11, color: colors.slate400, marginTop: 4, fontWeight: '600' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand[700], marginTop: 12 },
});
