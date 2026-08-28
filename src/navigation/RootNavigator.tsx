import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AuthStack } from './AuthStack';
import { AppTabs } from './AppTabs';
import { useAuthStore } from '../stores/authStore';
import { useShiftSync } from '../hooks/useShiftSync';
import { useLocationPollingEffect } from '../hooks/useLocationPollingEffect';
import { colors } from '../theme/tokens';

function AuthenticatedApp() {
  useShiftSync();
  useLocationPollingEffect();
  return <AppTabs />;
}

export function RootNavigator() {
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }}>
        <ActivityIndicator size="large" color={colors.brand[700]} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {token ? <AuthenticatedApp /> : <AuthStack />}
    </NavigationContainer>
  );
}
