import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '../../theme/tokens';
import { ClockPanel } from './ClockPanel';
import { HistoryPanel } from './HistoryPanel';

type Tab = 'clock' | 'history';

export function AttendanceScreen() {
  const [tab, setTab] = useState<Tab>('clock');

  return (
    <SafeAreaView style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.segment}>
          {(['clock', 'history'] as Tab[]).map((t) => (
            <Text
              key={t}
              onPress={() => setTab(t)}
              style={[styles.segmentItem, tab === t && styles.segmentItemActive]}
            >
              {t === 'clock' ? 'Clock in/out' : 'History'}
            </Text>
          ))}
        </View>

        {tab === 'clock' ? <ClockPanel /> : <HistoryPanel />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgLight },
  content: { padding: 16, gap: 12 },
  segment: {
    flexDirection: 'row', backgroundColor: colors.slate100, borderRadius: radii.md, padding: 3, marginBottom: 4,
  },
  segmentItem: {
    flex: 1, textAlign: 'center', paddingVertical: 8, fontSize: 12, fontWeight: '700', color: colors.slate500,
    borderRadius: radii.sm,
  },
  segmentItemActive: { backgroundColor: colors.white, color: colors.textLight },
});
