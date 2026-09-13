import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { getApiErrorMessage } from '../../api/client';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from '../../api/notifications.api';
import { useNotificationsStore } from '../../stores/notificationsStore';
import { SkeletonRows } from '../../components/Skeleton';
import { useT } from '../../i18n';
import { resolveLinkTarget } from './linkTarget';
import { FeedBucket, FeedItem, groupByDay, mergeFeed } from './feed';

/**
 * The inbox.
 *
 * Three rules shape this screen, and they are the answers to what was wrong
 * with the version before it:
 *
 *  1. TAPPING GOES SOMEWHERE. Every notification the server writes carries a
 *     linkPath, and this app used to ignore it — a tap marked the row read and
 *     did nothing else, so "read" only ever certified that somebody glanced at
 *     one sentence. Now a tap navigates, which is what makes the read state
 *     mean anything at all.
 *
 *  2. READ AND DONE ARE DIFFERENT. A row that owes an action keeps saying so
 *     after it is read, and "Mark all read" refuses to clear it. The server
 *     enforces this; the UI's job is to make it legible rather than look
 *     broken when the badge does not reach zero.
 *
 *  3. NOTHING IS HIDDEN. Read items stay in the list, styled down but fully
 *     legible. An employee looking for when their leave was approved is
 *     looking for a read notification, and a UI that files it away is a UI
 *     they have to fight.
 */

type Filter = 'all' | 'unread' | 'action';

/** Per-kind icon and tint, across both sources. `system` is the fallback. */
function kindTone(colors: ColorScheme): Record<string, { icon: keyof typeof Ionicons.glyphMap; tint: string; bg: string }> {
  return {
    // Server
    regularisation: { icon: 'create-outline', tint: colors.brand[700], bg: colors.brand[50] },
    kudos: { icon: 'trophy-outline', tint: colors.warningText, bg: colors.warningBg },
    policy: { icon: 'document-text-outline', tint: colors.slate600, bg: colors.slate100 },
    onboarding: { icon: 'person-add-outline', tint: colors.successText, bg: colors.successBg },
    system: { icon: 'information-circle-outline', tint: colors.slate600, bg: colors.slate100 },
    // Device-raised
    'clock-out-reminder': { icon: 'alarm-outline', tint: colors.warningText, bg: colors.warningBg },
    'geofence-alert': { icon: 'navigate-circle-outline', tint: colors.dangerText, bg: colors.dangerBg },
    'integrity-warning': { icon: 'warning-outline', tint: colors.warningText, bg: colors.warningBg },
    'integrity-escalated': { icon: 'shield-outline', tint: colors.dangerText, bg: colors.dangerBg },
    general: { icon: 'notifications-outline', tint: colors.slate600, bg: colors.slate100 },
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

const PAGE = 20;

export function NotificationsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const navigation = useNavigation<any>();
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  const [filter, setFilter] = useState<Filter>('all');
  /** How many pages deep the employee has asked to go. Reset when reopened. */
  const [limit, setLimit] = useState(PAGE);

  const deviceItems = useNotificationsStore((s) => s.items);
  const setDeviceRead = useNotificationsStore((s) => s.setRead);

  // Kept warm continuously rather than fetched only once the sheet opens.
  // Home already pays this same round-trip every 60s for the unread badge, so
  // polling the list on the same cadence costs nothing beyond what the badge
  // was already spending, and means the sheet usually opens on cached data
  // instead of a fresh skeleton.
  const { data, isLoading, error } = useQuery({
    queryKey: ['notifications', limit],
    queryFn: () => getNotifications({ limit }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
  };

  const readOne = useMutation({ mutationFn: markNotificationRead, onSuccess: invalidate });
  const unreadOne = useMutation({ mutationFn: markNotificationUnread, onSuccess: invalidate });
  const readAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: (res) => {
      invalidate();
      // Without this the badge visibly refuses to reach zero and the employee
      // is left to guess why. Saying which ones stayed, and that doing them is
      // what clears them, turns a bug-looking outcome into an instruction.
      if (res?.skipped > 0) {
        Alert.alert(t('notif.markAllRead'), t('notif.skippedBody', { count: res.skipped }));
      }
    },
  });

  const serverItems = data?.notifications ?? [];
  const hasMore = Boolean(data?.nextBefore);

  const feed = useMemo(() => mergeFeed(serverItems, deviceItems), [serverItems, deviceItems]);
  const unreadTotal = feed.filter((n) => !n.isRead).length;
  const actionTotal = feed.filter((n) => n.needsAction).length;

  const shown = useMemo(() => {
    if (filter === 'unread') return feed.filter((n) => !n.isRead);
    if (filter === 'action') return feed.filter((n) => n.needsAction);
    return feed;
  }, [feed, filter]);

  const groups = useMemo(() => groupByDay(shown), [shown]);

  /** Mark read, then go where the notification points — in that order. */
  const open = (item: FeedItem) => {
    if (item.source === 'device') {
      if (!item.isRead) setDeviceRead(item.id.replace(/^local:/, ''), true);
      return; // Device alerts have nowhere to navigate; they ARE the content.
    }
    if (!item.isRead) readOne.mutate(item.id);

    const target = resolveLinkTarget(item.linkPath);
    if (!target) return; // An HR-only destination. Reading it is the whole interaction.

    onClose();
    // Guarded: a linkPath naming a screen this build does not have must not
    // take the app down. The notification is still marked read either way.
    try {
      navigation.navigate(target.tab, target.screen ? { screen: target.screen, params: target.params } : undefined);
    } catch {
      /* The tab is gone or renamed; staying put is the correct failure. */
    }
  };

  /** Long-press: the employee's own correction to a tap that read too much. */
  const toggleRead = (item: FeedItem) => {
    if (item.source === 'device') {
      setDeviceRead(item.id.replace(/^local:/, ''), !item.isRead);
      return;
    }
    if (item.isRead) unreadOne.mutate(item.id);
    else readOne.mutate(item.id);
  };

  const BUCKET_LABEL: Record<FeedBucket, string> = {
    today: t('notif.today'),
    yesterday: t('notif.yesterday'),
    earlier: t('notif.earlier'),
  };

  const FILTERS: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: t('notif.filterAll'), count: feed.length },
    { key: 'unread', label: t('notif.filterUnread'), count: unreadTotal },
    { key: 'action', label: t('notif.filterAction'), count: actionTotal },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('notif.title')}</Text>
          <View style={styles.headerActions}>
            {unreadTotal > 0 && (
              <Pressable onPress={() => readAll.mutate()} hitSlop={6} disabled={readAll.isPending}>
                <Text style={styles.markAll}>{t('notif.markAllRead')}</Text>
              </Pressable>
            )}
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
              <Ionicons name="close" size={22} color={colors.slate500} />
            </Pressable>
          </View>
        </View>

        {/* Filters, not tabs: one list, three views of it. A separate "Read"
            section would file away exactly what people come here to find. The
            "Needs you" chip only appears when something is outstanding — a
            permanently empty filter trains people to stop looking at it. */}
        <View style={styles.filters}>
          {FILTERS.filter((f) => f.key !== 'action' || actionTotal > 0).map((f) => {
            const on = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[styles.chip, on && styles.chipOn, f.key === 'action' && !on && styles.chipAction]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn, f.key === 'action' && !on && styles.chipTextAction]}>
                  {f.label}{f.count > 0 ? ` ${f.count}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <SkeletonRows count={4} />
          ) : error ? (
            <Text style={styles.error}>{getApiErrorMessage(error)}</Text>
          ) : shown.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons
                name={filter === 'all' ? 'notifications-off-outline' : 'checkmark-circle-outline'}
                size={26}
                color={colors.slate300}
              />
              <Text style={styles.emptyTitle}>
                {filter === 'unread' ? t('notif.emptyUnread')
                  : filter === 'action' ? t('notif.emptyAction')
                  : t('notif.empty')}
              </Text>
              {filter === 'all' ? <Text style={styles.emptyBody}>{t('notif.emptyBody')}</Text> : null}
            </View>
          ) : (
            <>
              {groups.map((g) => (
                <View key={g.bucket}>
                  <Text style={styles.dayHeader}>{BUCKET_LABEL[g.bucket]}</Text>
                  {g.items.map((n) => (
                    <Row key={n.id} n={n} onOpen={() => open(n)} onToggleRead={() => toggleRead(n)} />
                  ))}
                </View>
              ))}

              {/* Only offers more of the SERVER half -- device history is
                  capped at 50 locally and is always fully present. */}
              {filter === 'all' && hasMore && (
                <Pressable style={styles.more} onPress={() => setLimit((n) => n + PAGE)} hitSlop={6}>
                  <Text style={styles.moreText}>{t('notif.loadMore')}</Text>
                </Pressable>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Row({ n, onOpen, onToggleRead }: { n: FeedItem; onOpen: () => void; onToggleRead: () => void }) {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const KIND = useMemo(() => kindTone(colors), [colors]);
  const t = useT();
  const kind = KIND[n.kind] ?? KIND.system;
  const goes = n.source === 'server' && resolveLinkTarget(n.linkPath) !== null;

  return (
    <Pressable
      onPress={onOpen}
      onLongPress={onToggleRead}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={`${n.title ? `${n.title}. ` : ''}${n.body}`}
      accessibilityHint={n.isRead ? t('notif.a11yMarkUnread') : t('notif.a11yMarkRead')}
      style={({ pressed }) => [styles.row, !n.isRead && styles.rowUnread, pressed && styles.rowPressed]}
    >
      {/* The unread marker is a solid edge, not a background wash. The wash
          this replaced was one step off the surface colour and effectively
          invisible -- worse in dark mode, where the token nearly matches. */}
      <View style={[styles.edge, !n.isRead && styles.edgeUnread]} />

      <View style={[styles.icon, { backgroundColor: kind.bg }]}>
        <Ionicons name={kind.icon} size={16} color={kind.tint} />
      </View>

      <View style={styles.rowText}>
        {n.title ? (
          <Text style={[styles.rowTitle, n.isRead && styles.rowTitleRead]} numberOfLines={2}>
            {n.title}
          </Text>
        ) : null}
        <Text style={[styles.rowBody, n.isRead && styles.rowBodyRead]}>{n.body}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.rowTime}>{relative(n.at)}</Text>
          {goes ? <Ionicons name="chevron-forward" size={11} color={colors.slate400} /> : null}
          {n.needsAction ? (
            <View style={styles.actionPill}>
              <Text style={styles.actionPillText}>{t('notif.needsYou')}</Text>
            </View>
          ) : null}
        </View>
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
      position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '82%',
      backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
    },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10,
    },
    title: { fontSize: 15, fontWeight: '800', color: colors.textLight, letterSpacing: -0.2 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    markAll: { fontSize: 11.5, fontWeight: '700', color: colors.brand[700] },

    filters: {
      flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: colors.slate100,
    },
    chip: {
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
      backgroundColor: colors.slate100,
    },
    chipOn: { backgroundColor: colors.brand[700] },
    chipAction: { backgroundColor: colors.warningBg },
    chipText: { fontSize: 11, fontWeight: '700', color: colors.slate600 },
    chipTextOn: { color: colors.surface },
    chipTextAction: { color: colors.warningText },

    list: { paddingHorizontal: 12, paddingVertical: 8 },
    error: { color: colors.dangerText, fontSize: 11.5, fontWeight: '600', padding: 20, textAlign: 'center' },

    dayHeader: {
      fontSize: 10, fontWeight: '800', color: colors.slate400,
      letterSpacing: 0.6, textTransform: 'uppercase',
      paddingHorizontal: 12, paddingTop: 14, paddingBottom: 6,
    },

    empty: { alignItems: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 32 },
    emptyTitle: { fontSize: 13, fontWeight: '800', color: colors.slate600, textAlign: 'center' },
    emptyBody: { fontSize: 11.5, color: colors.slate400, textAlign: 'center', lineHeight: 18 },

    row: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      paddingVertical: 12, paddingRight: 12, paddingLeft: 4,
      borderRadius: radii.md,
    },
    rowUnread: { backgroundColor: colors.brand[50] },
    rowPressed: { opacity: 0.7 },

    // 3px of colour down the left edge: the one cue that survives both themes.
    edge: { width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: 'transparent' },
    edgeUnread: { backgroundColor: colors.brand[700] },

    icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginLeft: 5 },
    rowText: { flex: 1 },

    // Read rows step down in weight and colour but stay fully legible -- they
    // are records somebody may come back for, not spent items.
    rowTitle: { fontSize: 12, fontWeight: '800', color: colors.textLight },
    rowTitleRead: { fontWeight: '600', color: colors.slate600 },
    rowBody: { fontSize: 11.5, color: colors.slate600, marginTop: 2, lineHeight: 18 },
    rowBodyRead: { color: colors.slate500 },

    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    rowTime: { fontSize: 11, color: colors.slate400, fontWeight: '600' },

    actionPill: {
      paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999,
      backgroundColor: colors.warningBg,
    },
    actionPillText: { fontSize: 9.5, fontWeight: '800', color: colors.warningText, letterSpacing: 0.3 },

    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand[700], marginTop: 12 },

    more: { alignItems: 'center', paddingVertical: 14 },
    moreText: { fontSize: 11.5, fontWeight: '700', color: colors.brand[700] },
  });
}
