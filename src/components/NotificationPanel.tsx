import React, { useEffect } from 'react';
import { Dimensions, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, IconName } from './Icon';
import { colors, radii } from '../theme/tokens';
import { LocalNotification, LocalNotificationType, useNotificationsStore } from '../stores/notificationsStore';

// An explicit pixel cap on the LIST itself, not a percentage on an ancestor.
// A percentage maxHeight on `sheet` plus flexShrink on the FlatList was not
// enough on-device: the list kept measuring itself to fit every row instead
// of being capped, so it had nothing to scroll against. Giving the FlatList
// a concrete number removes any ambiguity in how that percentage resolves
// through the Modal -> Pressable -> Pressable chain above it.
const LIST_MAX_HEIGHT = Dimensions.get('window').height * 0.6;

const TYPE_ICON: Record<LocalNotificationType, IconName> = {
  'clock-out-reminder': 'clock',
  'geofence-alert': 'target',
  'integrity-warning': 'target',
  'integrity-escalated': 'shield',
  general: 'bell',
};
const TYPE_TINT: Record<LocalNotificationType, { bg: string; fg: string }> = {
  'clock-out-reminder': { bg: colors.warningBg, fg: colors.warning },
  'geofence-alert': { bg: colors.dangerBg, fg: colors.danger },
  'integrity-warning': { bg: colors.warningBg, fg: colors.warning },
  'integrity-escalated': { bg: colors.dangerBg, fg: colors.danger },
  general: { bg: colors.slate100, fg: colors.slate600 },
};

function fmtTimestamp(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function NotificationRow({ item, onRemove }: { item: LocalNotification; onRemove: (id: string) => void }) {
  const tint = TYPE_TINT[item.type];
  return (
    <View style={[styles.row, !item.read && styles.rowUnread]}>
      <View style={[styles.iconCircle, { backgroundColor: tint.bg }]}>
        <Icon name={TYPE_ICON[item.type]} size={16} color={tint.fg} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{item.title}</Text>
        <Text style={styles.rowBody}>{item.body}</Text>
        <Text style={styles.rowTime}>{fmtTimestamp(item.timestamp)}</Text>
      </View>
      <Pressable onPress={() => onRemove(item.id)} hitSlop={10} style={styles.dismissButton}>
        <Icon name="x" size={12} color={colors.slate400} />
      </Pressable>
    </View>
  );
}

// Bottom-sheet modal, matching the reference prototype's MobileNotifPanel:
// a scrim, a sheet anchored to the bottom, a header with a close button, a
// divided list of rows. Opening the panel is the "you've seen these" signal
// -- it marks everything read immediately, so there is no separate "mark all
// read" affordance (the prototype's own mobile panel has none either).
export function NotificationPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const items = useNotificationsStore((s) => s.items);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const remove = useNotificationsStore((s) => s.remove);

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
          {items.length === 0 ? (
            <Text style={styles.emptyText}>No notifications yet.</Text>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(i) => i.id}
              renderItem={({ item }) => <NotificationRow item={item} onRemove={remove} />}
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
  // Written out rather than spreading StyleSheet.absoluteFillObject, which
  // React Native 0.86 no longer declares on the StyleSheet type.
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.4)',
  },
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
});
