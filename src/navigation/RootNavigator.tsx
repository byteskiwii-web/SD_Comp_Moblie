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
import { useProfileCompletionGate } from '../hooks/useProfileCompletionGate';
import { CompleteProfileScreen } from '../screens/onboarding/CompleteProfileScreen';
import { useThemeStore } from '../stores/themeStore';
import { useI18nReady } from '../i18n';

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
  const profileGate = useProfileCompletionGate();
  const kycGate = useKycGate();

  if (profileGate.isLoading || kycGate.isLoading) return <FullScreenSpinner />;
  // Profile completion comes first, before KYC: date of birth and address
  // are the more basic facts, filled in earlier in a real onboarding
  // conversation than a PAN or Aadhaar number would be. Same ordering
  // LIFECYCLE_STAGES already uses on the backend -- onboarding outranks
  // approval because identity settles before what depends on it.
  if (profileGate.gateRequired) return <CompleteProfileScreen />;
  return kycGate.gateRequired ? <KycStack /> : <AppTabs />;
}

export function RootNavigator() {
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);
  // The chosen language is read back from storage asynchronously, so the
  // first frame after a cold start would otherwise be English -- a flash of
  // the wrong language on every launch for anyone who is not using it.
  const languageReady = useI18nReady();
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

  if (!hydrated || !languageReady) {
    return <FullScreenSpinner />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      {token ? <AuthenticatedApp /> : <AuthStack />}
    </NavigationContainer>
  );
}
