import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { getApiErrorMessage } from '../../api/client';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
  type NotificationType,
} from '../../api/notifications.api';
import { SkeletonRows } from '../../components/Skeleton';
import { useT } from '../../i18n';

/** Per-kind icon and tint. `system` is the fallback for anything unrecognised. */
function kindTone(colors: ColorScheme): Record<NotificationType, { icon: keyof typeof Ionicons.glyphMap; tint: string; bg: string }> {
  return {
    regularisation: { icon: 'create-outline', tint: colors.brand[700], bg: colors.brand[50] },
    kudos: { icon: 'trophy-outline', tint: colors.warningText, bg: colors.warningBg },
    policy: { icon: 'document-text-outline', tint: colors.slate600, bg: colors.slate100 },
    onboarding: { icon: 'person-add-outline', tint: colors.successText, bg: colors.successBg },
    system: { icon: 'information-circle-outline', tint: colors.slate600, bg: colors.slate100 },
  };
}

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
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Kept warm continuously rather than fetched only once the sheet opens
  // (`enabled: visible` used to gate this entirely). This component is
  // mounted for as long as Home is -- the Modal's `visible` prop only
  // controls presentation, not whether it stays in the tree -- so this hook
  // was already running the whole time; it just was not allowed to fetch.
  // Home already pays this same round-trip every 60s for the unread badge
  // (`notifications-unread`); polling the list on the same cadence costs
  // nothing beyond what the badge was already spending, and means that by
  // the time someone taps the bell the list has very likely already arrived
  // and the sheet opens on cached data instead of a fresh skeleton.
  const { data, isLoading, error } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications({ limit: 30 }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
  };

  const readOne = useMutation({ mutationFn: markNotificationRead, onSuccess: invalidate });
  const readAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: invalidate });
  const t = useT();

  const items = data?.notifications ?? [];
  const unread = items.filter((n) => !n.isRead).length;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('notif.title')}</Text>
          <View style={styles.headerActions}>
            {unread > 0 && (
              <Pressable onPress={() => readAll.mutate()} hitSlop={6} disabled={readAll.isPending}>
                <Text style={styles.markAll}>{t('notif.markAllRead')}</Text>
              </Pressable>
            )}
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
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
              <Text style={styles.emptyTitle}>{t('notif.empty')}</Text>
              <Text style={styles.emptyBody}>
                {t('notif.emptyBody')}
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
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const KIND = useMemo(() => kindTone(colors), [colors]);
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

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    backdrop: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15,23,42,0.35)',
    },
    sheet: {
      position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '78%',
      backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
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
    error: { color: colors.dangerText, fontSize: 11.5, fontWeight: '600', padding: 20, textAlign: 'center' },

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
}
