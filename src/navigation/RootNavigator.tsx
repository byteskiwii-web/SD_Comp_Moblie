import React, { useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme, Theme } from '@react-navigation/native';
import { AuthStack } from './AuthStack';
import { AppTabs } from './AppTabs';
import { KycStack } from './KycStack';
import { useAuthStore } from '../stores/authStore';
import { useShiftSync } from '../hooks/useShiftSync';
import { useLocationPollingEffect } from '../hooks/useLocationPollingEffect';
import { useClockOutReminderEffect } from '../hooks/useClockOutReminderEffect';
import { useBreakReminderEffect } from '../hooks/useBreakReminderEffect';
import { useShiftIntegrityWatcher } from '../hooks/useShiftIntegrityWatcher';
import { useKycGate } from '../hooks/useKycGate';
import { useThemeStore } from '../stores/themeStore';

function FullScreenSpinner() {
  const colors = useThemeStore((s) => s.colors);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgLight }}>
      <ActivityIndicator size="large" color={colors.brand[700]} />
    </View>
  );
}

function AuthenticatedApp() {
  useShiftSync();
  useLocationPollingEffect();
  useClockOutReminderEffect();
  useBreakReminderEffect();
  useShiftIntegrityWatcher();
  const { isLoading, gateRequired } = useKycGate();

  if (isLoading) return <FullScreenSpinner />;
  return gateRequired ? <KycStack /> : <AppTabs />;
}

export function RootNavigator() {
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);
  const colors = useThemeStore((s) => s.colors);

  // Base off react-navigation's own themes rather than building one from
  // scratch -- screen-transition chrome and the elements package's own
  // internals read from `colors.card`/`colors.border` in ways this app's
  // token set doesn't otherwise need to model.
  const navTheme: Theme = useMemo(() => {
    const base = colors.scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.brand[700],
        background: colors.bgLight,
        card: colors.surface,
        text: colors.textLight,
        border: colors.slate200,
        notification: colors.danger,
      },
    };
  }, [colors]);

  if (!hydrated) {
    return <FullScreenSpinner />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      {token ? <AuthenticatedApp /> : <AuthStack />}
    </NavigationContainer>
  );
}
