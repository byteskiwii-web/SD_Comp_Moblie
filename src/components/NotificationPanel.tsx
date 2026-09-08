import React, { useEffect } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, IconName } from './Icon';
import { colors, radii } from '../theme/tokens';
import { LocalNotificationType } from '../stores/notificationsStore';
import { ServerNotificationType } from '../api/notifications.api';
import { InboxItem, useNotificationInbox } from '../hooks/useNotificationInbox';

// An explicit pixel cap on the LIST itself, not a percentage on an ancestor.
// A percentage maxHeight on `sheet` plus flexShrink on the FlatList was not
// enough on-device: the list kept measuring itself to fit every row instead
// of being capped, so it had nothing to scroll against. Giving the FlatList
// a concrete number removes any ambiguity in how that percentage resolves
// through the Modal -> Pressable -> Pressable chain above it.
const LIST_MAX_HEIGHT = Dimensions.get('window').height * 0.6;

// Keyed by feed as well as type: the two vocabularies are independent and a
// flat map would silently collide the day the server adds a `general` or the
// device adds a `policy`.
const LOCAL_ICON: Record<LocalNotificationType, IconName> = {
  'clock-out-reminder': 'clock',
  'geofence-alert': 'target',
  'integrity-warning': 'target',
  'integrity-escalated': 'shield',
  general: 'bell',
};
const LOCAL_TINT: Record<LocalNotificationType, { bg: string; fg: string }> = {
  'clock-out-reminder': { bg: colors.warningBg, fg: colors.warning },
  'geofence-alert': { bg: colors.dangerBg, fg: colors.danger },
  'integrity-warning': { bg: colors.warningBg, fg: colors.warning },
  'integrity-escalated': { bg: colors.dangerBg, fg: colors.danger },
  general: { bg: colors.slate100, fg: colors.slate600 },
};

const SERVER_ICON: Record<ServerNotificationType, IconName> = {
  kudos: 'user',
  regularisation: 'calendar',
  policy: 'file',
  onboarding: 'building',
  system: 'bell',
};
const SERVER_TINT: Record<ServerNotificationType, { bg: string; fg: string }> = {
  kudos: { bg: colors.successBg, fg: colors.success },
  regularisation: { bg: colors.brand[50], fg: colors.brand[700] },
  policy: { bg: colors.brand[50], fg: colors.brand[700] },
  onboarding: { bg: colors.slate100, fg: colors.slate600 },
  system: { bg: colors.slate100, fg: colors.slate600 },
};

// A server notification's title is nullable -- several backend callers emit a
// body only. Falling back to a per-type heading keeps every row structurally
// the same rather than leaving a bare, unlabelled line.
const SERVER_FALLBACK_TITLE: Record<ServerNotificationType, string> = {
  kudos: 'Appreciation',
  regularisation: 'Regularisation',
  policy: 'Company policy',
  onboarding: 'Onboarding',
  system: 'Notification',
};

function presentation(item: InboxItem): { icon: IconName; tint: { bg: string; fg: string }; title: string } {
  if (item.source === 'local') {
    return { icon: LOCAL_ICON[item.type], tint: LOCAL_TINT[item.type], title: item.title };
  }
  return {
    icon: SERVER_ICON[item.type],
    tint: SERVER_TINT[item.type],
    title: item.title ?? SERVER_FALLBACK_TITLE[item.type],
  };
}

function fmtTimestamp(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function NotificationRow({ item, onRemove }: { item: InboxItem; onRemove: (id: string) => void }) {
  const { icon, tint, title } = presentation(item);
  return (
    <View style={[styles.row, !item.read && styles.rowUnread]}>
      <View style={[styles.iconCircle, { backgroundColor: tint.bg }]}>
        <Icon name={icon} size={16} color={tint.fg} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowBody}>{item.body}</Text>
        <Text style={styles.rowTime}>{fmtTimestamp(item.timestamp)}</Text>
      </View>
      {/*
        Dismiss is local-only. A server notification has no delete endpoint,
        and removing it from this list alone would desync it from the same
        inbox as seen in the web console -- so those rows get a spacer that
        keeps the text column aligned across both feeds instead.
      */}
      {item.source === 'local' ? (
        <Pressable onPress={() => onRemove(item.id)} hitSlop={10} style={styles.dismissButton}>
          <Icon name="x" size={12} color={colors.slate400} />
        </Pressable>
      ) : (
        <View style={styles.dismissSpacer} />
      )}
    </View>
  );
}

// Bottom-sheet modal, matching the reference prototype's MobileNotifPanel:
// a scrim, a sheet anchored to the bottom, a header with a close button, a
// divided list of rows. Opening the panel is the "you've seen these" signal
// -- it marks everything read immediately, so there is no separate "mark all
// read" affordance (the prototype's own mobile panel has none either).
export function NotificationPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { items, markAllRead, removeLocal, isLoading, isError } = useNotificationInbox();

  useEffect(() => {
    if (visible) markAllRead();
  }, [visible, markAllRead]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/*
        The backdrop is an absolutely-positioned SIBLING behind the sheet, not
        a Pressable wrapping it. Wrapping the sheet in a Pressable (to stop a
        tap on it closing the modal) meant that ancestor claimed the touch
        responder for drags starting anywhere on a row, and never handed it to
        the list -- so the list only scrolled if the drag happened to start on
        the dismiss button, whose own press cancels and releases the responder.
        With the backdrop as a sibling, nothing above the list competes for the
        gesture and the whole sheet scrolls.
      */}
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Notifications</Text>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeButton}>
              <Icon name="x" size={14} color={colors.slate600} />
            </Pressable>
          </View>
          {/*
            A failed server fetch is a footnote when there are still device
            alerts to list -- those are the ones most likely to matter when a
            field employee is out of signal -- and the whole message when there
            are not. It must never appear alongside "No notifications yet":
            that line asserts an empty inbox, which is precisely what a failed
            fetch leaves unknown, so the two together would have the panel
            contradict itself.
          */}
          {isError && (
            <Text style={items.length === 0 ? styles.emptyText : styles.errorText}>
              Could not load newer notifications.
            </Text>
          )}
          {items.length === 0 ? (
            isLoading ? (
              <ActivityIndicator color={colors.brand[700]} style={styles.loadingSpacer} />
            ) : isError ? null : (
              <Text style={styles.emptyText}>No notifications yet.</Text>
            )
          ) : (
            <FlatList
              data={items}
              // Ids are unique per feed but nothing guarantees they are unique
              // ACROSS feeds -- the local ones are locally generated strings,
              // the server ones are database ids.
              keyExtractor={(i) => `${i.source}:${i.id}`}
              renderItem={({ item }) => <NotificationRow item={item} onRemove={removeLocal} />}
              style={[styles.list, { maxHeight: LIST_MAX_HEIGHT }]}
              showsVerticalScrollIndicator
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.4)' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: '75%',
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  sheetTitle: { fontSize: 15, fontWeight: '800', color: colors.textLight },
  closeButton: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.slate100,
  },
  // The real bound is LIST_MAX_HEIGHT, applied inline where this is used --
  // a concrete pixel value, because a percentage maxHeight on `sheet` alone
  // did not reliably constrain the FlatList through the Modal -> Pressable
  // -> Pressable ancestor chain. flexShrink: 1 stays as a second line of
  // defense (Yoga defaults it to 0, unlike web CSS flexbox's default of 1).
  list: { flexGrow: 0, flexShrink: 1 },
  emptyText: { fontSize: 13, color: colors.slate400, textAlign: 'center', padding: 24 },
  errorText: {
    fontSize: 11,
    color: colors.slate500,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 2,
  },
  loadingSpacer: { marginVertical: 24 },

  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  rowUnread: { backgroundColor: colors.brand[50] },
  iconCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 13, fontWeight: '700', color: colors.textLight },
  rowBody: { fontSize: 12, color: colors.slate600, marginTop: 2 },
  rowTime: { fontSize: 10, color: colors.slate400, marginTop: 4 },
  dismissButton: {
    width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.slate100,
  },
  // Matches dismissButton's footprint so a server row's text column ends at
  // the same x as a local row's.
  dismissSpacer: { width: 22, height: 22 },
});
