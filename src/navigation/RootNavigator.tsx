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
import { usePolicyAcceptanceGate } from '../hooks/usePolicyAcceptanceGate';
import { AcceptPoliciesScreen } from '../screens/onboarding/AcceptPoliciesScreen';
import { SetPasswordScreen } from '../screens/onboarding/SetPasswordScreen';
import { CompleteProfileScreen } from '../screens/onboarding/CompleteProfileScreen';
import { useThemeStore } from '../stores/themeStore';
import { useI18nReady } from '../i18n';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { navigationRef } from './navigationRef';

function FullScreenSpinner() {
  const colors = useThemeStore((s) => s.colors);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgLight }}>
      <ActivityIndicator size="large" color={colors.brand[700]} />
    </View>
  );
}

function AuthenticatedApp() {
  /**
   * The outermost gate, ahead of profile, KYC and policies.
   *
   * Not a matter of taste: while this flag is set the API refuses everything
   * except change-password, so each of those gates would be trying to load
   * data it cannot have. Reading the flag before their hooks run also keeps
   * the screen from flashing a spinner for requests that are going to 403.
   */
  const mustChangePassword = useAuthStore((s) => s.mustChangePassword);
  if (mustChangePassword) return <SetPasswordScreen />;

  return <GatedApp />;
}

function GatedApp() {
  /* Here and not in AuthenticatedApp: registering a push token is a request
     like any other, and while a password change is being forced it would
     403. Past that gate the session is fully usable. */
  usePushNotifications();
  useShiftSync();
  useLocationPollingEffect();
  useClockOutReminderEffect();
  useBreakReminderEffect();
  useShiftIntegrityWatcher();
  const profileGate = useProfileCompletionGate();
  const kycGate = useKycGate();
  const policyGate = usePolicyAcceptanceGate();

  if (profileGate.isLoading || kycGate.isLoading || policyGate.isLoading) return <FullScreenSpinner />;
  // Profile completion comes first, before KYC: date of birth and address
  // are the more basic facts, filled in earlier in a real onboarding
  // conversation than a PAN or Aadhaar number would be. Same ordering
  // LIFECYCLE_STAGES already uses on the backend -- onboarding outranks
  // approval because identity settles before what depends on it.
  if (profileGate.gateRequired) return <CompleteProfileScreen />;
  if (kycGate.gateRequired) return <KycStack />;
  /* Policies last. You cannot meaningfully agree to one before the record
     saying who you are exists and has been verified — signing earlier would be
     signing on behalf of an identity nobody has checked. */
  if (policyGate.gateRequired) return <AcceptPoliciesScreen />;
  return <AppTabs />;
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
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      {token ? <AuthenticatedApp /> : <AuthStack />}
    </NavigationContainer>
  );
}
