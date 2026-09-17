import React from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ColorScheme } from '../../theme/tokens';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';

/**
 * The frame every Profile section wears.
 *
 * Profile used to be one page with a dozen cards on it; it is now a hub and a
 * screen per topic. The topic screens are the same cards, one or two each,
 * inside this: a back bar with the topic's name, the same padding and gap the
 * hub uses, and pull-to-refresh that re-reads the profile — the one thing
 * every section shows something from, and the thing HR changes behind the
 * employee's back.
 *
 * `children` are the cards. Anything that must sit outside the scroll (a
 * Modal — see the note in ProfileScreen) goes in `overlay`.
 */
export function SectionScreen({
  title,
  subtitle,
  children,
  overlay,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  overlay?: React.ReactNode;
}) {
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  }, [refreshProfile]);

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <ScreenHeader title={title} subtitle={subtitle} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand[700]} />}
      >
        {children}
      </ScrollView>
      {overlay}
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorScheme) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.bgLight },
    content: { padding: 20, paddingTop: 8, gap: 16, paddingBottom: 32 },
  });
}
