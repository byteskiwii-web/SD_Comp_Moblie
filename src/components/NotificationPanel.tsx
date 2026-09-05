import React, { useEffect } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, IconName } from './Icon';
import { colors, radii } from '../theme/tokens';
import { LocalNotification, LocalNotificationType, useNotificationsStore } from '../stores/notificationsStore';

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
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
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
              style={styles.list}
              showsVerticalScrollIndicator
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' },
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
  // flexGrow: 0 alone left this unbounded: React Native's Yoga defaults
  // flexShrink to 0 (unlike web CSS flexbox, where it defaults to 1), so the
  // FlatList measured itself to fit ALL rows rather than shrinking to the
  // sheet's maxHeight -- it never became height-constrained, so it had
  // nothing to scroll against and the earliest notifications were simply
  // rendered past the visible edge of the screen. flexShrink: 1 lets it be
  // squeezed into the remaining space below the header, which is what
  // actually makes its internal scrolling kick in.
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
