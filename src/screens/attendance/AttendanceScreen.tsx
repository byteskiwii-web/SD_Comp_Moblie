import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, type RouteProp } from '@react-navigation/native';
import type { AttendanceStackParamList } from '../../navigation/types';
import { colors, radii } from '../../theme/tokens';
import { ClockPanel } from './ClockPanel';
import { HistoryPanel } from './HistoryPanel';
import { RegularisePanel } from './RegularisePanel';

type Tab = 'clock' | 'history' | 'regularise';

// Labels mirror the reference build. The first tab still covers breaks as well
// as the shift punches -- breaks are a real part of this product even though
// the reference mock-up predates them.
const TAB_LABEL: Record<Tab, string> = {
  clock: 'Clock in/out',
  history: 'History',
  regularise: 'Regularise',
};

export function AttendanceScreen() {
  const params = useRoute<RouteProp<AttendanceStackParamList, 'AttendanceHome'>>().params;
  const [tab, setTab] = useState<Tab>(params?.tab ?? 'clock');

  // The day detail sends people here with a tab and a date already chosen.
  // Keyed on the whole params object rather than on params.tab, so arriving
  // a second time for a different day moves the form again instead of
  // silently staying put because the tab name has not changed.
  useEffect(() => {
    if (params?.tab) setTab(params.tab);
  }, [params]);

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Attendance</Text>
      </View>
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

        {tab === 'clock' ? (
          <ClockPanel />
        ) : tab === 'history' ? (
          <HistoryPanel />
        ) : (
          <RegularisePanel initialDate={params?.date} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgLight },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
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
  segmentText: { fontSize: 12, fontWeight: '700', color: colors.slate500 },
  segmentTextActive: { color: colors.brand[700] },
});
