import React, { useEffect, useMemo, useState } from 'react';
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
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  NOTIFICATION_POLL_MS,
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
 *  1. TAPPING GOES SOMEWHERE, AND CLEARING IS ITS OWN CONTROL. Every
 *     notification the server writes carries a linkPath, and this app used to
 *     ignore it — a tap marked the row read and did nothing else, so "read"
 *     only ever certified that somebody glanced at one sentence. Now a tap
 *     navigates. Because that also takes you off the list, marking something
 *     read has its own button on every row: one job, done in place, next to
 *     "Mark all read" in the header. The long-press that used to be the only
 *     way to do it was undiscoverable, which made the feature effectively
 *     absent.
 *
 *  2. READ AND DONE ARE DIFFERENT. A row that owes an action keeps saying so
 *     after it is read, and "Mark all read" refuses to clear it. The server
 *     enforces this; the UI's job is to make it legible rather than look
 *     broken when the badge does not reach zero.
 *
 *  3. READ MEANS DEALT WITH, SO IT LEAVES. The default 'active' view shows
 *     only what still wants attention — unread, or an unresolved action — so
 *     reading a notification clears it from view rather than growing a pile.
 *     Nothing is deleted here: 'all' keeps the full history until the server
 *     prunes it, so a leave approval read last week is still findable.
 */

/**
 * ONE LIST, AND READ MEANS GONE.
 *
 * There were two chips here, Active and All, and they are removed. The
 * argument for keeping an archive was that somebody might want to re-read a
 * leave approval from last week — but nobody was asking for that, and the
 * cost was a control on every visit that mostly served to reintroduce the
 * pile the redesign existed to remove. If the history is ever wanted it
 * belongs somewhere it can be searched, not behind a chip that quietly
 * undoes the point of the screen.
 *
 * So the sheet shows what still wants attention and nothing else. Reading a
 * notification removes it from view. Nothing is deleted: the server keeps
 * every row until it prunes them, and the web console can still show the
 * full history.
 *
 * The one thing that survives being read is a row that still owes an ACTION.
 * Reading is not doing, and an obligation that vanished because somebody
 * glanced at it would be the screen losing something real. In practice this
 * is rare to the point of theoretical — the server refuses to mark an
 * unresolved action read, and so does the bulk action below.
 */

/** Per-kind icon and tint, across both sources. `system` is the fallback. */
function kindTone(colors: ColorScheme): Record<string, { icon: keyof typeof Ionicons.glyphMap; tint: string; bg: string }> {
  return {
    // Server
    regularisation: { icon: 'create-outline', tint: colors.brand[700], bg: colors.brand[50] },
    leave: { icon: 'calendar-outline', tint: colors.brand[700], bg: colors.brand[50] },
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

  /** How many pages deep the employee has asked to go. Reset when reopened. */
  const [limit, setLimit] = useState(PAGE);
  /** Ticked rows. Empty means the select bar is not shown at all. */
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const deviceItems = useNotificationsStore((s) => s.items);
  const setDeviceRead = useNotificationsStore((s) => s.setRead);

  /* The badge, read from the SAME query key the header polls -- React Query
     dedupes, so subscribing here costs no extra request and gives this sheet
     the one signal that says something changed. */
  const { data: counts } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: getUnreadCount,
    refetchInterval: NOTIFICATION_POLL_MS,
  });

  /* The list is NOT on a poll of its own.
     It used to refetch every 60s whether or not anything had happened and
     whether or not the sheet was even open -- this component stays mounted for
     as long as Home does, so that timer ran all day. Now the cheap count query
     above is the heartbeat, this refetches when the count moves (see the effect
     below), and the slow interval here is only a backstop for the one case the
     count cannot see: something arriving in the same window as something else
     being read, leaving the total unchanged. */
  const { data, isLoading, error } = useQuery({
    queryKey: ['notifications', limit],
    queryFn: () => getNotifications({ limit }),
    refetchInterval: visible ? 60_000 : false,
    staleTime: 10_000,
  });

  /* Pull the list whenever the badge moves. The count is what changes first --
     it is polled -- so this is how a new notification reaches an open sheet, and
     how a read on another device clears here. */
  const signal = `${counts?.unread ?? 0}:${counts?.needsAction ?? 0}`;
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [signal, queryClient]);

  /* A selection is a thing you are in the middle of, not a setting. Closing
     the sheet ends it — otherwise "Mark as read" would later act on rows that
     are no longer even on screen. */
  useEffect(() => {
    setSelected(new Set());
  }, [visible]);

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

  const shown = useMemo(() => {
    // Read and dealt with means gone. An unresolved action survives being
    // read, because reading is not doing.
    return feed.filter((n) => !n.isRead || n.needsAction);
  }, [feed]);

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

  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /* "Select all" means everything in the view you are looking at, not the
     whole history — ticking it while filtered to "Needs you" and silently
     sweeping up 200 older rows would be the wrong answer. */
  const shownIds = useMemo(() => shown.map((n) => n.id), [shown]);
  const allSelected = shownIds.length > 0 && shownIds.every((id) => selected.has(id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(shownIds));

  const markSelected = useMutation({
    mutationFn: async () => {
      /* Skips anything still owing an action, matching what the server
         already refuses to do in "Mark all read". Without this the bulk
         action could mark an obligation read, and since read now means gone,
         a tick of "select all" would make an outstanding task disappear. */
      const items = feed.filter((n) => selected.has(n.id) && !n.isRead && !n.needsAction);
      // Device alerts live in a local store, server ones behind the API; the
      // employee ticked one list and should not have to know the difference.
      items.filter((n) => n.source === 'device')
        .forEach((n) => setDeviceRead(n.id.replace(/^local:/, ''), true));
      const ids = items.filter((n) => n.source === 'server').map((n) => n.id);
      // Sequential rather than Promise.all: a bulk tick is at most a screenful,
      // and a burst of parallel writes against one row set is not worth it.
      for (const id of ids) await markNotificationRead(id);
    },
    onSettled: () => {
      setSelected(new Set());
      invalidate();
    },
    onError: (e) => Alert.alert(t('notif.markAllRead'), getApiErrorMessage(e)),
  });

  const BUCKET_LABEL: Record<FeedBucket, string> = {
    today: t('notif.today'),
    yesterday: t('notif.yesterday'),
    earlier: t('notif.earlier'),
  };

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

        {/* Appears only once something is ticked. A permanently parked action
            bar costs a row of height on every visit to say nothing. */}
        {selected.size > 0 && (
          <View style={styles.selectBar}>
            <Pressable
              onPress={toggleAll}
              hitSlop={8}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: allSelected }}
              accessibilityLabel={t('notif.selectAll')}
              style={styles.selectAllHit}
            >
              <View style={[styles.box, allSelected && styles.boxOn]}>
                {allSelected ? <Ionicons name="checkmark" size={13} color={colors.white} /> : null}
              </View>
              <Text style={styles.selectAllText}>{t('notif.selectAll')}</Text>
            </Pressable>

            <Text style={styles.selectCount}>{t('notif.selectedCount', { count: selected.size })}</Text>

            <Pressable
              onPress={() => markSelected.mutate()}
              disabled={markSelected.isPending}
              hitSlop={6}
              accessibilityRole="button"
            >
              <Text style={[styles.selectAction, markSelected.isPending && styles.selectActionOff]}>
                {t('notif.markRead')}
              </Text>
            </Pressable>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <SkeletonRows count={4} />
          ) : error ? (
            <Text style={styles.error}>{getApiErrorMessage(error)}</Text>
          ) : shown.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="checkmark-circle-outline" size={26} color={colors.slate300} />
              <Text style={styles.emptyTitle}>{t('notif.emptyActive')}</Text>
            </View>
          ) : (
            <>
              {groups.map((g) => (
                <View key={g.bucket}>
                  <Text style={styles.dayHeader}>{BUCKET_LABEL[g.bucket]}</Text>
                  {g.items.map((n) => (
                    <Row
                      key={n.id}
                      n={n}
                      onOpen={() => open(n)}
                      onToggleRead={() => toggleRead(n)}
                      selected={selected.has(n.id)}
                      onSelect={() => toggleSelected(n.id)}
                      selecting={selected.size > 0}
                    />
                  ))}
                </View>
              ))}

              {/* Older UNREAD rows, for somebody who has been away long
                  enough to have more than a page of them. Only offers more of
                  the SERVER half — device history is capped at 50 locally and
                  is always fully present. */}
              {hasMore && (
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

function Row({
  n, onOpen, onToggleRead, selected, onSelect, selecting,
}: {
  n: FeedItem;
  onOpen: () => void;
  onToggleRead: () => void;
  selected: boolean;
  onSelect: () => void;
  /** True once anything at all is ticked — then a tap ticks instead of opens. */
  selecting: boolean;
}) {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const KIND = useMemo(() => kindTone(colors), [colors]);
  const t = useT();
  const kind = KIND[n.kind] ?? KIND.system;
  const goes = n.source === 'server' && resolveLinkTarget(n.linkPath) !== null;

  return (
    <Pressable
      onPress={selecting ? onSelect : onOpen}
      onLongPress={onToggleRead}
      delayLongPress={350}
      accessibilityRole={selecting ? 'checkbox' : 'button'}
      accessibilityState={selecting ? { checked: selected } : undefined}
      accessibilityLabel={`${n.title ? `${n.title}. ` : ''}${n.body}`}
      style={({ pressed }) => [
        styles.row,
        !n.isRead && styles.rowUnread,
        selected && styles.rowSelected,
        pressed && styles.rowPressed,
      ]}
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

      {/* The checkbox is always here, not revealed by a long-press nobody
          finds. Ticking one row is what raises the bar at the top of the
          sheet, so "select all" and "Mark as read" appear the moment they are
          useful and stay out of the way otherwise. Nested Pressables do not
          bubble in React Native, so this never fires the row's own press. */}
      <Pressable
        onPress={onSelect}
        hitSlop={10}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={t(selected ? 'notif.a11yDeselect' : 'notif.a11ySelect')}
        style={({ pressed }) => [styles.readBtn, pressed && styles.readBtnPressed]}
      >
        <View style={[styles.box, selected && styles.boxOn]}>
          {selected ? <Ionicons name="checkmark" size={13} color={colors.white} /> : null}
        </View>
      </Pressable>
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
    markAll: {
      fontSize: 11.5, fontWeight: '700', color: colors.brand[700],
      paddingHorizontal: 10, paddingVertical: 5,
      backgroundColor: colors.brand[50], borderRadius: radii.pill,
      overflow: 'hidden',
    },

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

    // A 30px tap target, which is the minimum that can be hit reliably with a
    // thumb. The icon inside is smaller; the box is what you actually aim at.
    readBtn: {
      width: 30, height: 30, borderRadius: 15,
      alignItems: 'center', justifyContent: 'center', marginTop: 2,
    },
    readBtnPressed: { backgroundColor: colors.slate100 },
    box: {
      width: 20, height: 20, borderRadius: 6, borderWidth: 1.5,
      borderColor: colors.slate300, alignItems: 'center', justifyContent: 'center',
    },
    boxOn: { backgroundColor: colors.brand[700], borderColor: colors.brand[700] },
    rowSelected: { backgroundColor: colors.brand[50] },

    selectBar: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 20, paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: colors.slate100,
      backgroundColor: colors.brand[50],
    },
    selectAllHit: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    selectAllText: { fontSize: 12.5, fontWeight: '700', color: colors.textLight },
    selectCount: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.slate500, textAlign: 'right' },
    selectAction: {
      fontSize: 11.5, fontWeight: '800', color: colors.brand[700],
      paddingHorizontal: 10, paddingVertical: 6,
    },
    selectActionOff: { color: colors.slate400 },

    more: { alignItems: 'center', paddingVertical: 14 },
    moreText: { fontSize: 11.5, fontWeight: '700', color: colors.brand[700] },
  });
}
