import React from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = React.useState(false);

  /**
   * Pulling down here used to only call refreshProfile() -- which re-reads
   * the employee record itself, but not any of the section-specific queries
   * that live on top of it. The Identity section's KycCard (profile-kyc-status,
   * kyc-health, face-change-mine, face-status) is the clearest case: pulling
   * down on Profile looked like it refreshed everything, but the KYC card
   * underneath kept showing whatever it last fetched. Invalidated without the
   * employee id suffix -- React Query matches by prefix, so this still reaches
   * every per-employee variant of each key without this generic wrapper
   * needing to know the signed-in employee's id itself.
   */
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refreshProfile();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['profile-kyc-status'] }),
      queryClient.invalidateQueries({ queryKey: ['kyc-health'] }),
      queryClient.invalidateQueries({ queryKey: ['face-change-mine'] }),
      queryClient.invalidateQueries({ queryKey: ['face-status'] }),
    ]);
    setRefreshing(false);
  }, [refreshProfile, queryClient]);

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <ScreenHeader title={title} subtitle={subtitle} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand[700]} />}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
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
