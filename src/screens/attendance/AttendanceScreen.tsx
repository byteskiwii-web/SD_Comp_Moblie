import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import type { AttendanceStackParamList } from '../../navigation/types';
import { ColorScheme, radii } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { ClockPanel } from './ClockPanel';
import { HistoryPanel } from './HistoryPanel';
import { RegularisePanel } from './RegularisePanel';
import { useT } from '../../i18n';
import { GreetingHeader } from '../../components/GreetingHeader';
import { TourScrollView } from '../../components/tour/TourTarget';

type Tab = 'clock' | 'history' | 'regularise';

// Labels mirror the reference build. The first tab still covers breaks as well
// as the shift punches -- breaks are a real part of this product even though
// the reference mock-up predates them.
//
// Catalogue KEYS, not text: a module-level constant is evaluated once, so the
// strings it held would be whichever language the app started in and would not
// move when somebody changed it.
const TAB_KEY = {
  clock: 'attendance.clock',
  history: 'attendance.history',
  regularise: 'attendance.regularise',
} as const;

export function AttendanceScreen() {
  const colors = useThemeStore((s) => s.colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const params = useRoute<RouteProp<AttendanceStackParamList, 'AttendanceHome'>>().params;
  const [tab, setTab] = useState<Tab>(params?.tab ?? 'clock');
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Every attendance-shaped query this screen's three tabs read between them,
   * invalidated together rather than per-tab: cheap (a handful of
   * already-cached GETs), and it means switching tabs after a pull doesn't
   * need its own separate refresh logic. Keyed without the employee id --
   * React Query matches by prefix, so this reaches every per-employee variant
   * without this screen needing to read the id itself.
   */
  const refreshAttendanceQueries = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['attendance-today'] }),
        queryClient.invalidateQueries({ queryKey: ['attendance-day'] }),
        queryClient.invalidateQueries({ queryKey: ['attendance-history'] }),
        queryClient.invalidateQueries({ queryKey: ['attendance-month'] }),
        // RegularisePanel's own request list/allowance -- a decision on one of
        // these arrives as a push (see usePushNotifications.ts), but someone
        // simply returning to this tab after a few days away should not have
        // to wait for that to have landed.
        queryClient.invalidateQueries({ queryKey: ['regularisation-mine'] }),
      ]),
    [queryClient]
  );

  // Bottom-tab screens stay mounted, so without this a request approved or a
  // punch recorded elsewhere would only show up here after a cold start.
  useFocusEffect(
    useCallback(() => {
      void refreshAttendanceQueries();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshAttendanceQueries();
    setRefreshing(false);
  }, [refreshAttendanceQueries]);

  // Held here, not read straight off params, on purpose. ClockPanel remounts
  // every time the segmented control leaves 'clock' and comes back (this
  // screen conditionally renders it), which would hand it the same truthy
  // params.autoPunch again and reopen the camera on every return trip to the
  // tab. Owning the flag here, at the level that survives that remount, and
  // clearing it the moment ClockPanel acts on it, makes it fire exactly once
  // per arrival from Home -- never on a tab flip within the same visit.
  const [autoPunch, setAutoPunch] = useState(params?.autoPunch);

  // The day detail sends people here with a tab and a date already chosen.
  // Keyed on the whole params object rather than on params.tab, so arriving
  // a second time for a different day moves the form again instead of
  // silently staying put because the tab name has not changed.
  useEffect(() => {
    if (params?.tab) setTab(params.tab);
    setAutoPunch(params?.autoPunch);
  }, [params]);

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <GreetingHeader />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TourScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand[700]} />}
        >
          <View style={styles.segment}>
            {(['clock', 'history', 'regularise'] as Tab[]).map((id) => (
              <Pressable
                key={id}
                onPress={() => setTab(id)}
                style={[styles.segmentItem, tab === id && styles.segmentItemActive]}
              >
                <Text style={[styles.segmentText, tab === id && styles.segmentTextActive]}>
                  {t(TAB_KEY[id])}
                </Text>
              </Pressable>
            ))}
          </View>

          {tab === 'clock' ? (
            <ClockPanel autoPunch={autoPunch} onAutoPunchStarted={() => setAutoPunch(undefined)} />
          ) : tab === 'history' ? (
            <HistoryPanel />
          ) : (
            <RegularisePanel initialDate={params?.date} />
          )}
        </TourScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgLight },
  content: { padding: 20, paddingTop: 12, gap: 14 },
  segment: {
    flexDirection: 'row', backgroundColor: colors.slate100, borderRadius: radii.md, padding: 4,
  },
  segmentItem: {
    flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radii.sm,
  },
  segmentItemActive: {
    backgroundColor: colors.surface,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: colors.scheme === 'dark' ? 0 : 0.08,
    shadowRadius: 2,
    elevation: colors.scheme === 'dark' ? 0 : 1,
  },
  segmentText: { fontSize: 11, fontWeight: '700', color: colors.slate500 },
  segmentTextActive: { color: colors.brand[700] },
  });
}
