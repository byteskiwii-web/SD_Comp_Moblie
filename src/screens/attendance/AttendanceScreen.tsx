import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii } from '../../theme/tokens';
import { NotificationBell } from '../../components/NotificationBell';
import { NotificationPanel } from '../../components/NotificationPanel';
import { ClockPanel } from './ClockPanel';
import { HistoryPanel } from './HistoryPanel';
import { RegularisePanel } from './RegularisePanel';

type Tab = 'clock' | 'history' | 'regularise';

const TAB_LABEL: Record<Tab, string> = {
  clock: 'Shift & Breaks',
  history: 'History',
  regularise: 'Regularise',
};

export function AttendanceScreen() {
  const [tab, setTab] = useState<Tab>('clock');
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Attendance</Text>
        <NotificationBell onPress={() => setNotifOpen(true)} />
      </View>
      <NotificationPanel visible={notifOpen} onClose={() => setNotifOpen(false)} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.segment}>
          {(['clock', 'history', 'regularise'] as Tab[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[styles.segmentItem, tab === t && styles.segmentItemActive]}
            >
              <Text style={[styles.segmentText, tab === t && styles.segmentTextActive]}>
                {TAB_LABEL[t]}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'clock' ? <ClockPanel /> : tab === 'history' ? <HistoryPanel /> : <RegularisePanel />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgLight },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: colors.textLight, letterSpacing: -0.3 },
  content: { padding: 20, paddingTop: 12, gap: 14 },
  segment: {
    flexDirection: 'row', backgroundColor: colors.slate100, borderRadius: radii.md, padding: 4,
  },
  segmentItem: {
    flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radii.sm,
  },
  segmentItemActive: {
    backgroundColor: colors.white,
    shadowColor: colors.slate900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: { fontSize: 13, fontWeight: '700', color: colors.slate500 },
  segmentTextActive: { color: colors.brand[700] },
});
